// นำเข้า Excel ฝั่งเซิร์ฟเวอร์: โหลดรายการอ้างอิง → ตรวจไฟล์ → วางแผน (เพิ่ม/แก้/ข้าม) → บันทึกในธุรกรรมเดียว
import { query, transaction } from "@/lib/db";
import { recordChange } from "@/lib/recordArchive";
import { modulePermissions, getModuleAccess } from "@/lib/eocModuleAccess";
import { logVulnerableAccess } from "@/lib/vulnerableAccessLog";
import { decodePerson, encodePerson } from "@/lib/vulnerablePersonsCrypto";
import { validatePerson } from "@/lib/vulnerablePersons";
import { checkDateInSession } from "@/lib/sessionDateRange";
import { applyMovement, normalizeItemCode } from "@/lib/medicalInventory";
import { applyDailyReport, thaiDateText, todayKey, validateDailyEntry } from "@/lib/medicalDaily";
import { saveDailyEntries } from "@/lib/medicalDailyServer";
import { triggerEventAlerts } from "@/lib/eocAlertRunner";
import { buildXlsx } from "@/lib/xlsxWriter";
import { readSpreadsheet } from "@/lib/xlsxReader";
import { importSpec } from "@/lib/imports/specs";
import { normalizeKey, parseRows, summarizeCheck, templateSheets } from "@/lib/imports/core";

export class ImportError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const PRIVILEGED = ["admin", "commander"];
const nameKey = (value) => normalizeKey(String(value || "").replace(/^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง)/, ""));
const villageKey = (value) => normalizeKey(String(value || "").replace(/^บ้าน/, ""));
const userName = (user) => [user?.givenName, user?.familyName].filter(Boolean).join(" ") || user?.username || null;

async function resolveSession(eocType, sessionId) {
  const rows = await query(
    sessionId
      ? `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? AND eoc_type = ? LIMIT 1`
      : `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE eoc_type = ?
         ORDER BY (status = 'active') DESC, opened_at DESC LIMIT 1`,
    sessionId ? [sessionId, eocType] : [eocType]
  );
  return rows[0] || null;
}

// ---- รายการอ้างอิง ----
async function loadAreas() {
  const rows = await query(
    `SELECT id, distname, subdistnam, moo, villname FROM satun_village_polygon
     WHERE distname IS NOT NULL AND subdistnam IS NOT NULL ORDER BY distname, subdistnam, CAST(moo AS UNSIGNED), villname`
  );
  const tambonsByDistrict = new Map();
  for (const row of rows) {
    const district = String(row.distname).trim();
    const tambon = String(row.subdistnam).trim();
    if (!tambonsByDistrict.has(district)) tambonsByDistrict.set(district, new Set());
    tambonsByDistrict.get(district).add(tambon);
  }
  const districts = [...tambonsByDistrict.keys()];
  const tambons = [...new Set(rows.map((row) => String(row.subdistnam).trim()))];
  return { villages: rows, tambonsByDistrict, districts, tambons };
}

async function loadFacilities() {
  const rows = await query(`SELECT id, name, district_name FROM health_facilities WHERE is_active = 1 ORDER BY district_name, name`);
  return rows.map((row) => ({ value: row.id, label: String(row.name).trim(), aliases: [String(row.id)] }));
}

/** รายการอ้างอิงของแต่ละชนิด (ใช้ทั้งไฟล์ตัวอย่างและการตรวจ) */
export async function loadRefs(kind) {
  if (kind === "supplies" || kind === "supplies-daily") return { facilities: await loadFacilities() };
  const areas = await loadAreas();
  return { districts: areas.districts, tambons: areas.tambons, _areas: areas };
}

/** แถวเติมล่วงหน้าของแบบรายงานประจำวัน: ทุกรายการในคลังของเหตุการณ์ (หรือเฉพาะหน่วยบริการที่เลือก) วันที่ = วันนี้ */
async function dailyPrefill({ eocType, sessionId, facilityId }, refs) {
  const session = await resolveSession(eocType || "flood", sessionId);
  if (!session) return [];
  const event = await findInventoryEvent(session);
  if (!event) return [];
  const rows = await query(
    `SELECT health_facility_id, item_code, item_name, unit, balance_qty FROM medical_inventory_stock
     WHERE inventory_event_id = ? AND health_facility_id IS NOT NULL ${facilityId ? "AND health_facility_id = ?" : ""}
     ORDER BY agency_name, item_name`,
    facilityId ? [event.id, facilityId] : [event.id]
  );
  const facilityName = new Map((refs.facilities || []).map((option) => [option.value, option.label]));
  const date = thaiDateText(todayKey());
  return rows
    .filter((row) => facilityName.has(row.health_facility_id))
    .map((row) => ({
      date, facility: facilityName.get(row.health_facility_id), item_code: row.item_code, item_name: row.item_name, unit: row.unit,
      system_balance: Number(row.balance_qty || 0)
    }));
}

/** ไฟล์ตัวอย่าง .xlsx พร้อมแผ่นคำอธิบาย รายการให้เลือก และตัวอย่าง (แบบรายงานประจำวันเติมรายการยาไว้ให้) */
export async function buildTemplate(kind, options = {}) {
  const spec = importSpec(kind);
  if (!spec) throw new ImportError("ไม่รู้จักชนิดข้อมูลที่จะนำเข้า", 404);
  const refs = await loadRefs(kind);
  const prefill = kind === "supplies-daily" ? await dailyPrefill(options, refs) : [];
  return { buffer: buildXlsx(templateSheets(spec, refs, { prefill })), filename: spec.filename };
}

const addError = (row, column, message) => row.errors.push({ column, message });

function checkArea(row, areas) {
  const { district, tambon } = row.values;
  if (district && tambon && !areas.tambonsByDistrict.get(district)?.has(tambon)) {
    addError(row, "ตำบล", `ต.${tambon} ไม่อยู่ใน อ.${district}`);
  }
}

// ---- กลุ่มเปราะบาง ----
async function planVulnerable(rows, ctx) {
  const areas = ctx.refs._areas;
  const existing = await query(`SELECT id, vulnerable_type, district, tambon, village, name_enc, phone_enc, address_enc, location_enc, needs_enc, caregiver_enc, clinical_enc, updated_at FROM vulnerable_persons WHERE is_active = 1`);
  const known = new Set();
  for (const row of existing) {
    const person = decodePerson(row);
    if (person?.name) known.add(`${nameKey(person.name)}|${row.district}|${row.tambon}`);
  }
  const seen = new Map();
  for (const row of rows) {
    checkArea(row, areas);
    const v = row.values;
    if ((v.due_date || v.preterm_history) && v.vulnerable_type && v.vulnerable_type !== "pregnant") {
      addError(row, "กำหนดคลอด", "กรอกได้เฉพาะหญิงตั้งครรภ์");
    }
    const checked = validatePerson({ ...v, power_dependent: v.power_dependent ? 1 : 0, preterm_history: v.preterm_history ? 1 : 0, lat: v.lat ?? "", lng: v.lng ?? "" });
    if (checked.error && !row.errors.length) addError(row, "ข้อมูล", checked.error);
    if (!row.errors.length) row.value = checked.value;
    const key = `${nameKey(v.name)}|${v.district}|${v.tambon}`;
    if (v.name && seen.has(key)) addError(row, "ชื่อ-นามสกุล", `ซ้ำกับแถวที่ ${seen.get(key)} ในไฟล์`);
    else seen.set(key, row.row);
    row.action = known.has(key) ? "skip" : "create";
    if (row.action === "skip") row.reason = "มีในทะเบียนแล้ว";
  }
}

async function commitVulnerable(rows, ctx) {
  const ready = rows.filter((row) => row.action === "create");
  const ids = await transaction(async (execute) => {
    const created = [];
    for (const row of ready) {
      const enc = encodePerson(row.value);
      const result = await execute(
        `INSERT INTO vulnerable_persons (vulnerable_type, district, tambon, village, name_enc, phone_enc, address_enc, location_enc, needs_enc, caregiver_enc, clinical_enc, care_group, power_dependent, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [enc.vulnerable_type, enc.district, enc.tambon, enc.village, enc.name_enc, enc.phone_enc, enc.address_enc, enc.location_enc, enc.needs_enc, enc.caregiver_enc, enc.clinical_enc, enc.care_group, enc.power_dependent, ctx.user.id, ctx.user.id]
      );
      created.push(result.insertId);
    }
    return created;
  });
  await logVulnerableAccess({ request: ctx.request, user: ctx.user, action: "import", sessionId: ctx.session?.id ?? null, count: ids.length });
  await recordChange({
    request: ctx.request, user: ctx.user, action: "CREATE", table: "vulnerable_persons", id: ids[0] ?? null, sessionId: ctx.session?.id ?? null,
    description: `นำเข้ากลุ่มเปราะบางจาก Excel ${ids.length} คน (ไฟล์ ${ctx.filename})`
  });
  return { created: ids.length, updated: 0 };
}

// ---- พื้นที่น้ำท่วมรายหมู่บ้าน ----
async function planFlood(rows, ctx) {
  const areas = ctx.refs._areas;
  const existing = await query(
    `SELECT id, DATE_FORMAT(flood_start_date, '%Y-%m-%d') AS day, district, tambon, village FROM flood_records WHERE session_id = ?`,
    [ctx.session.id]
  );
  const existingKey = new Map(existing.map((row) => [`${row.day}|${row.district}|${row.tambon}|${villageKey(row.village)}`, row.id]));
  const seen = new Map();
  for (const row of rows) {
    checkArea(row, areas);
    const v = row.values;
    if (v.date) {
      const inSession = checkDateInSession(ctx.session, v.date);
      if (!inSession.ok) addError(row, "วันที่", inSession.error);
    }
    if (v.affected_people > 0 && v.affected_households > v.affected_people) addError(row, "ครัวเรือนที่ได้รับผลกระทบ", "มากกว่าจำนวนคนไม่ได้");
    if (!v.moo && !v.village) addError(row, "หมู่ที่", "ระบุหมู่ที่หรือชื่อหมู่บ้าน");
    if (row.errors.length) continue;
    const inTambon = areas.villages.filter((item) => String(item.distname).trim() === v.district && String(item.subdistnam).trim() === v.tambon);
    let matches = inTambon;
    if (v.moo) matches = matches.filter((item) => Number(item.moo) === Number(v.moo));
    if (v.village && matches.length !== 1) {
      const byName = (v.moo ? matches : inTambon).filter((item) => villageKey(item.villname) === villageKey(v.village));
      if (byName.length) matches = byName;
      else if (!v.moo) matches = [];
    }
    if (matches.length !== 1) {
      addError(row, v.moo ? "หมู่ที่" : "ชื่อหมู่บ้าน", matches.length ? "พบหลายหมู่บ้าน ระบุชื่อหมู่บ้านเพิ่ม" : `ไม่พบหมู่บ้านนี้ใน ต.${v.tambon}`);
      continue;
    }
    const polygon = matches[0];
    row.polygon = polygon;
    row.villageName = String(polygon.villname).trim();
    const key = `${v.date}|${v.district}|${v.tambon}|${villageKey(row.villageName)}`;
    if (seen.has(key)) { addError(row, "หมู่ที่", `ซ้ำกับแถวที่ ${seen.get(key)} (หมู่บ้านและวันเดียวกัน)`); continue; }
    seen.set(key, row.row);
    row.existingId = existingKey.get(key) || null;
    row.action = row.existingId ? "update" : "create";
  }
}

async function commitFlood(rows, ctx) {
  const ready = rows.filter((row) => row.action === "create" || row.action === "update");
  const year = new Date(ctx.session.opened_at).getFullYear();
  const counts = await transaction(async (execute) => {
    let created = 0;
    let updated = 0;
    for (const row of ready) {
      const v = row.values;
      const values = [v.flood_level, v.date, v.water_depth_cm ?? null, v.affected_households || 0, v.affected_people || 0, v.description || null];
      if (row.existingId) {
        await execute(
          `UPDATE flood_records SET polygon_id = ?, flood_level = ?, flood_start_date = ?, water_depth_cm = ?, affected_households = ?, affected_people = ?, description = ?
           WHERE id = ? AND session_id = ?`,
          [row.polygon.id, ...values, row.existingId, ctx.session.id]
        );
        updated += 1;
      } else {
        await execute(
          `INSERT INTO flood_records (session_id, year, polygon_id, province, district, tambon, village, flood_level, flood_start_date, water_depth_cm,
             affected_area_sqm, affected_households, affected_people, description, damage_amount, relief_amount, status, created_by)
           VALUES (?, ?, ?, 'สตูล', ?, ?, ?, ?, ?, ?, NULL, ?, ?, ?, 0, 0, 'กำลังดำเนินการ', ?)`,
          [ctx.session.id, year, row.polygon.id, v.district, v.tambon, row.villageName, v.flood_level, v.date, v.water_depth_cm ?? null,
            v.affected_households || 0, v.affected_people || 0, v.description || null, ctx.user.username]
        );
        created += 1;
      }
    }
    return { created, updated };
  });
  await recordChange({
    request: ctx.request, user: ctx.user, action: "data_create", table: "flood_records", id: ctx.session.id, sessionId: ctx.session.id,
    description: `นำเข้าพื้นที่น้ำท่วมจาก Excel เพิ่ม ${counts.created} แก้ ${counts.updated} หมู่บ้าน (ไฟล์ ${ctx.filename})`
  });
  return counts;
}

// ---- คลังเวชภัณฑ์ ----
async function findInventoryEvent(session) {
  const rows = await query(`SELECT id, event_name FROM medical_inventory_events WHERE eoc_type = ? AND session_number = ? LIMIT 1`, [session.eoc_type, session.session_number]);
  return rows[0] || null;
}

async function planSupplies(rows, ctx) {
  const stock = await query(
    `SELECT id, health_facility_id, item_code, item_name, unit, received_qty, issued_qty, balance_qty FROM medical_inventory_stock WHERE inventory_event_id = ?`,
    [ctx.event.id]
  );
  const byCode = new Map(stock.map((item) => [`${item.health_facility_id}|${item.item_code}`, item]));
  const byName = new Map(stock.map((item) => [`${item.health_facility_id}|${normalizeKey(item.item_name)}`, item]));
  const facilityName = new Map((ctx.refs.facilities || []).map((option) => [option.value, option.label]));
  const seen = new Map();
  for (const row of rows) {
    if (row.errors.length) continue;
    const v = row.values;
    const code = normalizeItemCode(v.item_code, v.item_name);
    const key = `${v.facility}|${code}`;
    if (seen.has(key)) { addError(row, "ชื่อรายการ", `ซ้ำกับแถวที่ ${seen.get(key)} (หน่วยบริการและรายการเดียวกัน)`); continue; }
    seen.set(key, row.row);
    row.itemCode = code;
    row.facilityName = facilityName.get(v.facility) || "";
    const current = byCode.get(key) || (!v.item_code ? byName.get(`${v.facility}|${normalizeKey(v.item_name)}`) : null);
    if (!current) { row.action = "create"; continue; }
    row.stock = current;
    if (Number(current.balance_qty) === Number(v.balance_qty)) { row.action = "skip"; row.reason = "ยอดเท่าเดิม"; continue; }
    const result = applyMovement(current, "adjust", v.balance_qty);
    if (!result.ok) { addError(row, "ยอดคงเหลือ", result.error); continue; }
    row.action = "update";
  }
}

async function commitSupplies(rows, ctx) {
  const ready = rows.filter((row) => row.action === "create" || row.action === "update");
  const facilities = new Map((await query(`SELECT id, name, typecode FROM health_facilities`)).map((row) => [row.id, row]));
  const counts = await transaction(async (execute) => {
    let created = 0;
    let updated = 0;
    for (const row of ready) {
      const v = row.values;
      if (row.action === "create") {
        const facility = facilities.get(v.facility);
        await execute(
          `INSERT INTO medical_inventory_stock
             (inventory_event_id, inventory_agency_id, health_facility_id, agency_name, agency_name_original, agency_type,
              item_code, item_name, unit, movement_tracked, opening_qty, received_qty, issued_qty, balance_qty, data_status)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, ?, 'recorded')`,
          [ctx.event.id, v.facility, v.facility, facility?.name || row.facilityName, facility?.name || row.facilityName, facility?.typecode || "",
            row.itemCode, v.item_name, v.unit, v.balance_qty, v.balance_qty]
        );
        created += 1;
        continue;
      }
      const locked = await execute(
        `SELECT id, received_qty, issued_qty, balance_qty, unit FROM medical_inventory_stock WHERE id = ? AND inventory_event_id = ? FOR UPDATE`,
        [row.stock.id, ctx.event.id]
      );
      if (!locked.length) continue;
      const result = applyMovement(locked[0], "adjust", v.balance_qty);
      if (!result.ok || result.before === result.after) continue;
      await execute(`UPDATE medical_inventory_stock SET balance_qty = ?, data_status = 'recorded' WHERE id = ?`, [result.after, row.stock.id]);
      await execute(
        `INSERT INTO medical_inventory_movements
           (stock_id, movement_type, movement_qty, balance_before, balance_after, requested_by, requested_team, eoc_session_id, note, created_by)
         VALUES (?, 'adjust', ?, ?, ?, ?, NULL, ?, ?, ?)`,
        [row.stock.id, result.movementQty, result.before, result.after, userName(ctx.user), ctx.session.id,
          `นับยอดจาก Excel: ${ctx.filename}${v.note ? ` — ${v.note}` : ""}`.slice(0, 2000), ctx.user.id]
      );
      updated += 1;
    }
    return { created, updated };
  });
  await recordChange({
    request: ctx.request, user: ctx.user, action: "data_update", table: "medical_inventory_stock", id: ctx.event.id, sessionId: ctx.session.id,
    description: `นำเข้ายอดคงคลังจาก Excel เพิ่ม ${counts.created} ปรับยอด ${counts.updated} รายการ (ไฟล์ ${ctx.filename})`
  });
  return counts;
}

// ---- รายงานเวชภัณฑ์ประจำวัน ----
async function planSuppliesDaily(rows, ctx) {
  const [stock, reports] = await Promise.all([
    query(`SELECT id, health_facility_id, agency_name, item_code, item_name, unit, received_qty, issued_qty, balance_qty FROM medical_inventory_stock WHERE inventory_event_id = ?`, [ctx.event.id]),
    query(`SELECT stock_id, DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, received_qty, used_qty, counted_qty, note FROM medical_inventory_daily_reports WHERE inventory_event_id = ?`, [ctx.event.id])
  ]);
  const byCode = new Map(stock.map((item) => [`${item.health_facility_id}|${item.item_code}`, item]));
  const byName = new Map(stock.map((item) => [`${item.health_facility_id}|${normalizeKey(item.item_name)}`, item]));
  const reportOf = new Map(reports.map((report) => [`${report.stock_id}|${report.report_date}`, report]));
  const facilityName = new Map((ctx.refs.facilities || []).map((option) => [option.value, option.label]));
  const simulated = new Map(stock.map((item) => [item.id, { ...item }]));
  const today = new Date(`${todayKey()}T12:00:00`);
  const seen = new Map();
  for (const row of rows) {
    if (row.errors.length) continue;
    const v = row.values;
    const inSession = checkDateInSession(ctx.session, v.date, today);
    if (!inSession.ok) { addError(row, "วันที่รายงาน", inSession.error); continue; }
    const code = normalizeItemCode(v.item_code, v.item_name);
    const current = byCode.get(`${v.facility}|${code}`) || byName.get(`${v.facility}|${normalizeKey(v.item_name)}`);
    if (!current) { addError(row, "ชื่อรายการ", `ไม่มีรายการนี้ในคลังของ ${facilityName.get(v.facility) || "หน่วยบริการนี้"} — เพิ่มรายการหรือนำเข้ายอดตั้งต้นก่อน`); continue; }
    const key = `${current.id}|${v.date}`;
    if (seen.has(key)) { addError(row, "ชื่อรายการ", `ซ้ำกับแถวที่ ${seen.get(key)} (รายการและวันเดียวกัน)`); continue; }
    seen.set(key, row.row);
    const checked = validateDailyEntry(v);
    if (!checked.ok) { addError(row, "ใช้ไป/จ่ายออก", checked.error); continue; }
    const previous = reportOf.get(key) || null;
    const sim = simulated.get(current.id);
    const result = applyDailyReport(sim, previous, checked.value);
    if (!result.ok) { addError(row, "ใช้ไป/จ่ายออก", result.error); continue; }
    row.entry = { stock_id: current.id, report_date: v.date, value: checked.value };
    if (result.unchanged) { row.action = "skip"; row.reason = "ค่าเท่าเดิม"; continue; }
    Object.assign(sim, result.next);
    reportOf.set(key, checked.value);
    row.action = previous ? "update" : "create";
  }
}

async function commitSuppliesDaily(rows, ctx) {
  const entries = rows.filter((row) => row.action === "create" || row.action === "update").map((row) => row.entry);
  const counts = await transaction((execute) => saveDailyEntries(execute, { eventId: ctx.event.id, user: ctx.user, source: "excel", entries }));
  await recordChange({
    request: ctx.request, user: ctx.user, action: "data_update", table: "medical_inventory_daily_reports", id: ctx.event.id, sessionId: ctx.session.id,
    description: `นำเข้ารายงานเวชภัณฑ์ประจำวันจาก Excel เพิ่ม ${counts.created} แก้ ${counts.updated} รายการ (ไฟล์ ${ctx.filename})`
  });
  triggerEventAlerts(ctx.session.id);
  return { created: counts.created, updated: counts.updated };
}

// ---- สิทธิ์และบริบท ----
async function prepare(kind, { user, eocType, sessionId }) {
  if (kind === "vulnerable") {
    const session = await resolveSession(eocType || "flood", sessionId);
    const perms = session ? await modulePermissions(user, session.id, "vulnerable") : { can_edit: false };
    if (!PRIVILEGED.includes(user.role) && !perms.can_edit) throw new ImportError(perms.read_only_message || "ไม่มีสิทธิ์แก้ไขทะเบียนกลุ่มเปราะบาง", 403);
    return { session };
  }
  if (kind === "flood-records") {
    const session = await resolveSession("flood", sessionId);
    if (!session) throw new ImportError("ยังไม่มีเหตุการณ์อุทกภัย", 404);
    const access = await getModuleAccess(user, session.id, "records");
    if (!access.ok) throw new ImportError(access.message, access.status);
    if (!access.canEdit) throw new ImportError(access.readOnlyMessage || "ไม่มีสิทธิ์บันทึกข้อมูลในเหตุการณ์นี้", 403);
    return { session };
  }
  if (kind === "supplies" || kind === "supplies-daily") {
    const session = await resolveSession(eocType || "flood", sessionId);
    if (!session) throw new ImportError("ยังไม่มีเหตุการณ์ EOC", 404);
    if (session.status !== "active") throw new ImportError("เหตุการณ์นี้ปิดแล้ว ดูข้อมูลได้อย่างเดียว", 409);
    const access = await getModuleAccess(user, session.id, "supplies");
    if (!access.ok) throw new ImportError(access.message, access.status);
    if (!access.canEdit) throw new ImportError(access.readOnlyMessage || "ไม่มีสิทธิ์บันทึกคลังเวชภัณฑ์", 403);
    const event = await findInventoryEvent(session);
    if (!event) throw new ImportError("ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้ — กด \"เปิดบัญชีคลัง\" ในหน้าคลังก่อน", 409);
    return { session, event };
  }
  throw new ImportError("ไม่รู้จักชนิดข้อมูลที่จะนำเข้า", 404);
}

const PLAN = { vulnerable: planVulnerable, "flood-records": planFlood, supplies: planSupplies, "supplies-daily": planSuppliesDaily };
const COMMIT = { vulnerable: commitVulnerable, "flood-records": commitFlood, supplies: commitSupplies, "supplies-daily": commitSuppliesDaily };

/**
 * ตรวจไฟล์ (commit=false) หรือบันทึก (commit=true)
 * onlyValid: บันทึกเฉพาะแถวที่ไม่มีปัญหา (ไม่งั้นต้องไม่มีปัญหาเลยจึงบันทึกได้)
 */
export async function runImport(kind, { buffer, filename, user, request, eocType, sessionId, commit = false, onlyValid = false }) {
  const spec = importSpec(kind);
  if (!spec) throw new ImportError("ไม่รู้จักชนิดข้อมูลที่จะนำเข้า", 404);
  const context = await prepare(kind, { user, eocType, sessionId });
  const refs = await loadRefs(kind);
  const parsed = parseRows(readSpreadsheet(buffer, filename), spec, refs);
  if (parsed.error) throw new ImportError(parsed.error);
  const ctx = { ...context, refs, user, request, filename: String(filename || "ไฟล์").slice(0, 120) };
  await PLAN[kind](parsed.rows, ctx);

  const check = summarizeCheck(parsed.rows);
  const valid = parsed.rows.filter((row) => !row.errors.length);
  const plan = {
    create: valid.filter((row) => row.action === "create").length,
    update: valid.filter((row) => row.action === "update").length,
    skip: valid.filter((row) => row.action === "skip").length,
    skipped: valid.filter((row) => row.action === "skip").slice(0, 50).map((row) => ({ row: row.row, reason: row.reason }))
  };
  const base = { success: true, kind, sheet: parsed.sheetName, session: context.session ? { id: context.session.id, session_number: context.session.session_number } : null, check, plan };
  if (!commit) return { ...base, committed: false };
  if (check.invalid && !onlyValid) throw new ImportError(`ไฟล์ยังมีปัญหา ${check.invalid} แถว — แก้ไฟล์ หรือเลือกนำเข้าเฉพาะแถวที่ถูกต้อง`);
  if (!plan.create && !plan.update) return { ...base, committed: true, result: { created: 0, updated: 0 } };
  const result = await COMMIT[kind](valid, ctx);
  return { ...base, committed: true, result };
}
