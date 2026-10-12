import { NextResponse } from "next/server";
import { modulePermissions, requireModuleEdit } from "@/lib/eocModuleAccess";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { recordChange } from "@/lib/recordArchive";
import { MOVEMENT_TYPES, applyMovement, missingPresetItems, normalizeItemCode, stockLevel, summarizeStock } from "@/lib/medicalInventory";
import { triggerEventAlerts } from "@/lib/eocAlertRunner";

// คลังเวชภัณฑ์ของ "เหตุการณ์ EOC ครั้งนี้" (ผูกกับ eoc_type + ครั้งที่ ผ่าน medical_inventory_events)
const SUPPORTED = ["flood", "disease"];

const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const num = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
};
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

async function findEvent(session) {
  const rows = await query(
    `SELECT id, event_name, eoc_type, session_number FROM medical_inventory_events WHERE eoc_type = ? AND session_number = ? LIMIT 1`,
    [session.eoc_type, session.session_number]
  );
  return rows[0] || null;
}

async function findPreviousEvent(session) {
  const rows = await query(
    `SELECT e.id, e.event_name, e.session_number, COUNT(s.id) AS item_rows
     FROM medical_inventory_events e JOIN medical_inventory_stock s ON s.inventory_event_id = e.id
     WHERE e.eoc_type = ? AND (e.session_number IS NULL OR e.session_number <> ?)
     GROUP BY e.id, e.event_name, e.session_number
     ORDER BY e.session_number DESC, e.id DESC LIMIT 1`,
    [session.eoc_type, session.session_number]
  );
  return rows[0] || null;
}

async function loadContext(searchParams) {
  const eocType = searchParams.get("eoc") || "flood";
  if (!SUPPORTED.includes(eocType)) return { error: bad("ประเภท EOC ไม่ถูกต้อง") };
  const session = await resolveSession(eocType, searchParams.get("session_id"));
  if (!session) return { eocType, session: null };
  const event = await findEvent(session);
  return { eocType, session, event };
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const ctx = await loadContext(new URL(request.url).searchParams);
    if (ctx.error) return ctx.error;
    if (!ctx.session) {
      return NextResponse.json({ success: true, session: null, message: `ยังไม่เคยเปิด EOC ${getEocTypeLabel(ctx.eocType)}` });
    }

    const [stock, movements, facilities, previous] = await Promise.all([
      ctx.event ? query(
        `SELECT s.id, s.inventory_agency_id, s.health_facility_id, s.agency_name, s.agency_type, s.item_code, s.item_name, s.unit,
                s.opening_qty, s.received_qty, s.issued_qty, s.balance_qty, s.data_status, s.updated_at, hf.district_name
         FROM medical_inventory_stock s LEFT JOIN health_facilities hf ON hf.id = s.health_facility_id
         WHERE s.inventory_event_id = ? ORDER BY s.item_name, s.agency_name`, [ctx.event.id]) : [],
      ctx.event ? query(
        `SELECT m.id, m.movement_type, m.movement_qty, m.balance_before, m.balance_after, m.requested_by, m.requested_team, m.note,
                m.movement_at, s.item_name, s.unit, s.agency_name
         FROM medical_inventory_movements m JOIN medical_inventory_stock s ON s.id = m.stock_id
         WHERE s.inventory_event_id = ? ORDER BY m.movement_at DESC, m.id DESC LIMIT 300`, [ctx.event.id]) : [],
      query(`SELECT id, name, district_name FROM health_facilities WHERE is_active = 1 ORDER BY district_name, name`),
      ctx.event ? null : findPreviousEvent(ctx.session)
    ]);

    const rows = stock.map((row) => ({ ...row, level: stockLevel(row) }));
    const isActive = ctx.session.status === "active";
    return NextResponse.json({
      success: true,
      session: ctx.session,
      event: ctx.event,
      previous_event: previous,
      summary: summarizeStock(rows),
      stock: rows,
      movements,
      facilities,
      // บันทึกได้เฉพาะกลุ่มภารกิจ LOGISTICS (และแอดมิน/ผู้บัญชาการ) — ทีมอื่นดูคงคลังได้อย่างเดียว
      permissions: await (async () => {
        const perms = await modulePermissions(auth.user, ctx.session.id, "supplies");
        const allowed = isActive && perms.can_edit;
        return { can_open: allowed, can_add_item: allowed, can_move: allowed, read_only_message: allowed ? null : perms.read_only_message };
      })()
    });
  } catch (error) {
    console.error("Supplies GET error:", error);
    return publicInternalError("ไม่สามารถโหลดข้อมูลคลังเวชภัณฑ์ได้");
  }
}

async function openEvent(auth, ctx, body) {
  if (ctx.event) return bad("เหตุการณ์นี้เปิดบัญชีคลังแล้ว", 409);
  const previous = body.carry_over ? await findPreviousEvent(ctx.session) : null;
  const name = `${getEocTypeLabel(ctx.eocType)} ครั้งที่ ${ctx.session.session_number}`;
  const result = await transaction(async (execute) => {
    const created = await execute(
      `INSERT INTO medical_inventory_events (eoc_type, session_number, event_name, source_file) VALUES (?, ?, ?, ?)`,
      [ctx.eocType, ctx.session.session_number, name, previous ? `ยกยอดจาก: ${previous.event_name}` : null]
    );
    let copied = 0;
    if (previous) {
      const inserted = await execute(
        `INSERT INTO medical_inventory_stock
           (inventory_event_id, inventory_agency_id, health_facility_id, agency_name, agency_name_original, agency_type,
            item_code, item_name, unit, movement_tracked, opening_qty, received_qty, issued_qty, balance_qty, data_status)
         SELECT ?, inventory_agency_id, health_facility_id, agency_name, agency_name_original, agency_type,
                item_code, item_name, unit, movement_tracked, COALESCE(balance_qty, 0), 0, 0, COALESCE(balance_qty, 0), data_status
         FROM medical_inventory_stock WHERE inventory_event_id = ?`,
        [created.insertId, previous.id]
      );
      copied = inserted.affectedRows || 0;
    }
    return { id: created.insertId, copied };
  });
  await recordChange({
    request: ctx.request, user: auth.user, action: "data_create", table: "medical_inventory_events", id: result.id, sessionId: ctx.session.id,
    description: `เปิดบัญชีคลังเวชภัณฑ์ ${name}${previous ? ` (ยกยอด ${result.copied} รายการจาก ${previous.event_name})` : ""}`
  });
  return NextResponse.json({ success: true, message: previous ? `เปิดบัญชีคลังแล้ว ยกยอดมา ${result.copied} รายการ` : "เปิดบัญชีคลังแล้ว" });
}

async function addItem(auth, ctx, body) {
  if (!ctx.event) return bad("ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้", 409);
  const facilityId = Number(body.health_facility_id);
  const itemName = String(body.item_name || "").trim();
  const unit = String(body.unit || "").trim();
  const itemCode = normalizeItemCode(body.item_code, itemName);
  const opening = body.opening_qty === "" || body.opening_qty === undefined ? 0 : num(body.opening_qty);
  if (!Number.isInteger(facilityId) || facilityId <= 0) return bad("กรุณาเลือกหน่วยบริการ/คลัง");
  if (!itemName || !unit) return bad("กรุณาระบุชื่อรายการและหน่วยนับ");
  if (!Number.isFinite(opening) || opening < 0) return bad("ยอดตั้งต้นต้องเป็นตัวเลขไม่ติดลบ");
  const facilities = await query(`SELECT id, name, typecode FROM health_facilities WHERE id = ? LIMIT 1`, [facilityId]);
  if (!facilities.length) return bad("ไม่พบหน่วยบริการ");
  const exists = await query(
    `SELECT id FROM medical_inventory_stock WHERE inventory_event_id = ? AND health_facility_id = ? AND item_code = ? LIMIT 1`,
    [ctx.event.id, facilityId, itemCode]
  );
  if (exists.length) return bad("หน่วยบริการนี้มีรายการนี้แล้ว ใช้ปุ่มรับเข้า/ปรับยอดแทน", 409);
  const result = await query(
    `INSERT INTO medical_inventory_stock
       (inventory_event_id, inventory_agency_id, health_facility_id, agency_name, agency_name_original, agency_type,
        item_code, item_name, unit, movement_tracked, opening_qty, received_qty, issued_qty, balance_qty, data_status)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, ?, 'recorded')`,
    [ctx.event.id, facilityId, facilityId, facilities[0].name, facilities[0].name, facilities[0].typecode || "", itemCode, itemName, unit, opening, opening]
  );
  await recordChange({
    request: ctx.request, user: auth.user, action: "data_create", table: "medical_inventory_stock", id: result.insertId, sessionId: ctx.session.id,
    description: `เพิ่มเวชภัณฑ์ ${itemName} ที่ ${facilities[0].name} ยอดตั้งต้น ${opening} ${unit}`
  });
  return NextResponse.json({ success: true, message: "เพิ่มรายการแล้ว" });
}

// เพิ่มรายการมาตรฐานกรณีอุทกภัยที่หน่วยบริการยังไม่มี (ยอดตั้งต้น 0) ในครั้งเดียว
async function addPresets(auth, ctx, body) {
  if (!ctx.event) return bad("ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้", 409);
  const facilityId = Number(body.health_facility_id);
  if (!Number.isInteger(facilityId) || facilityId <= 0) return bad("กรุณาเลือกหน่วยบริการ/คลัง");
  const facilities = await query(`SELECT id, name, typecode FROM health_facilities WHERE id = ? LIMIT 1`, [facilityId]);
  if (!facilities.length) return bad("ไม่พบหน่วยบริการ");
  const existing = await query(`SELECT item_code FROM medical_inventory_stock WHERE inventory_event_id = ? AND health_facility_id = ?`, [ctx.event.id, facilityId]);
  const missing = missingPresetItems(existing.map((row) => row.item_code));
  if (!missing.length) return NextResponse.json({ success: true, message: "หน่วยบริการนี้มีรายการมาตรฐานครบแล้ว" });
  const facility = facilities[0];
  await transaction(async (execute) => {
    for (const item of missing) {
      await execute(
        `INSERT INTO medical_inventory_stock
           (inventory_event_id, inventory_agency_id, health_facility_id, agency_name, agency_name_original, agency_type,
            item_code, item_name, unit, movement_tracked, opening_qty, received_qty, issued_qty, balance_qty, data_status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, 0, 0, 'recorded')`,
        [ctx.event.id, facilityId, facilityId, facility.name, facility.name, facility.typecode || "", item.item_code, item.item_name, item.unit]
      );
    }
  });
  await recordChange({
    request: ctx.request, user: auth.user, action: "data_create", table: "medical_inventory_stock", id: facilityId, sessionId: ctx.session.id,
    description: `เพิ่มรายการมาตรฐานอุทกภัย ${missing.length} รายการ ที่ ${facility.name}`
  });
  return NextResponse.json({ success: true, message: `เพิ่มรายการมาตรฐาน ${missing.length} รายการแล้ว กด "รับเข้า" เพื่อใส่ยอด` });
}

async function move(auth, ctx, body) {
  if (!ctx.event) return bad("ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้", 409);
  const stockId = Number(body.stock_id);
  const type = String(body.movement_type || "");
  if (!Number.isInteger(stockId) || stockId <= 0) return bad("ไม่พบรายการเวชภัณฑ์");
  const team = String(body.requested_team || "").trim().slice(0, 255) || null;
  const note = String(body.note || "").trim().slice(0, 2000) || null;
  if (type === "issue" && !team) return bad("กรุณาระบุผู้รับ/ทีมที่เบิก");
  if (type === "adjust" && !note) return bad("กรุณาระบุเหตุผลการปรับยอด");

  const outcome = await transaction(async (execute) => {
    const rows = await execute(
      `SELECT id, item_name, unit, agency_name, received_qty, issued_qty, balance_qty FROM medical_inventory_stock
       WHERE id = ? AND inventory_event_id = ? FOR UPDATE`, [stockId, ctx.event.id]
    );
    if (!rows.length) return { error: bad("ไม่พบรายการเวชภัณฑ์ในเหตุการณ์นี้", 404) };
    const result = applyMovement(rows[0], type, body.qty);
    if (!result.ok) return { error: bad(result.error) };
    await execute(
      `UPDATE medical_inventory_stock SET received_qty = ?, issued_qty = ?, balance_qty = ?, data_status = 'recorded' WHERE id = ?`,
      [result.next.received_qty, result.next.issued_qty, result.next.balance_qty, stockId]
    );
    const inserted = await execute(
      `INSERT INTO medical_inventory_movements
         (stock_id, movement_type, movement_qty, balance_before, balance_after, requested_by, requested_team, eoc_session_id, note, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [stockId, type, result.movementQty, result.before, result.after, userName(auth.user), team, ctx.session.id, note, auth.user.id]
    );
    return { stock: rows[0], result, movementId: inserted.insertId };
  });
  if (outcome.error) return outcome.error;
  const { stock, result } = outcome;
  await recordChange({
    request: ctx.request, user: auth.user, action: "data_update", table: "medical_inventory_stock", id: stockId, sessionId: ctx.session.id,
    description: `${MOVEMENT_TYPES[type]} ${stock.item_name} ${result.movementQty} ${stock.unit || ""} (${stock.agency_name}) คงเหลือ ${result.after}${team ? ` → ${team}` : ""}`,
    oldValues: { balance_qty: result.before }, newValues: { balance_qty: result.after }
  });
  triggerEventAlerts(ctx.session.id);
  return NextResponse.json({ success: true, message: `${MOVEMENT_TYPES[type]}แล้ว คงเหลือ ${result.after.toLocaleString("th-TH")} ${stock.unit || ""}`.trim() });
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const body = await request.json().catch(() => ({}));
    const params = new URL(request.url).searchParams;
    const ctx = await loadContext(params);
    if (ctx.error) return ctx.error;
    if (!ctx.session) return bad("ยังไม่มีเหตุการณ์ EOC", 404);
    if (ctx.session.status !== "active") return bad("เหตุการณ์นี้ปิดแล้ว ดูข้อมูลได้อย่างเดียว", 409);
    const gate = await requireModuleEdit(auth.user, ctx.session.id, "supplies");
    if (gate.response) return gate.response;
    ctx.request = request;
    if (body.action === "open_event") return await openEvent(auth, ctx, body);
    if (body.action === "add_item") return await addItem(auth, ctx, body);
    if (body.action === "add_presets") return await addPresets(auth, ctx, body);
    if (body.action === "movement") return await move(auth, ctx, body);
    return bad("ไม่รู้จักคำสั่ง");
  } catch (error) {
    console.error("Supplies POST error:", error);
    return publicInternalError("ไม่สามารถบันทึกข้อมูลคลังเวชภัณฑ์ได้");
  }
}
