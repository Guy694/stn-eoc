// บันทึกข้อมูลจากระบบคลังยาของโรงพยาบาลเข้าบัญชีคลังของเหตุการณ์ EOC
// ยาที่เลือก: ตั้งยอด/ปรับยอดตามยอดคงคลัง · แทนที่ล็อตและวันหมดอายุ · เก็บยอดรับ/จ่ายรายเดือนเป็นอัตราใช้ปกติ
import { query, transaction } from "@/lib/db";
import { recordChange } from "@/lib/recordArchive";
import { normalizeItemCode } from "@/lib/medicalInventory";
import { daysInPeriod } from "@/lib/hospitalDrugFiles";
import { triggerEventAlerts } from "@/lib/eocAlertRunner";
import { planHospitalDay } from "@/lib/hospitalDrugPlan";
import { DailyError, saveDailyEntries } from "@/lib/medicalDailyServer";
import { todayKey } from "@/lib/medicalDaily";
import { toDateKey } from "@/lib/sessionDateRange";
import { ImportError, prepareSuppliesImport } from "@/lib/imports/server";
import { facilityOrderSql } from "@/lib/facilityOrder";

export const MAX_ITEMS = 3000;
const MAX_LOTS = 300;
const MAX_MONTHS = 24;

const text = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
const num = (value) => {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const isoDate = (value) => (/^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : null);

/** รหัสรายการในคลัง: รหัสโรงพยาบาล + WORKING_CODE (รหัสยาของแต่ละ รพ. ซ้ำกันข้ามโรงพยาบาลได้) */
export function hospitalItemCode(hospCode, workingCode) {
  return normalizeItemCode(`${text(hospCode, 20) || "HOSP"}:${text(workingCode, 40)}`, "");
}

/** ตรวจและทำความสะอาดข้อมูลที่ส่งมาจากเบราว์เซอร์ */
export function sanitizeItems(items) {
  if (!Array.isArray(items) || !items.length) throw new ImportError("ยังไม่ได้เลือกรายการยา");
  if (items.length > MAX_ITEMS) throw new ImportError(`เลือกได้ไม่เกิน ${MAX_ITEMS.toLocaleString("th-TH")} รายการต่อครั้ง`);
  const seen = new Set();
  const clean = [];
  for (const item of items) {
    const code = text(item?.working_code, 40);
    const name = text(item?.name, 255);
    if (!code || !name || seen.has(code)) continue;
    seen.add(code);
    const onhand = num(item.onhand);
    clean.push({
      working_code: code,
      name,
      unit: text(item.unit, 50) || "หน่วย",
      onhand: onhand !== null && onhand >= 0 ? onhand : null,
      received_on: Math.max(0, num(item.received_on) ?? 0),
      lots: (Array.isArray(item.lots) ? item.lots : []).slice(0, MAX_LOTS).map((lot) => ({
        lot_no: text(lot?.lot_no, 60) || null,
        expire_date: isoDate(lot?.expire_date),
        qty: Math.max(0, num(lot?.qty) ?? 0),
        value: num(lot?.value)
      })),
      usage: (Array.isArray(item.usage) ? item.usage : []).slice(0, MAX_MONTHS)
        .filter((month) => /^\d{6}$/.test(String(month?.period || "")))
        .map((month) => ({ period: String(month.period), used: Math.max(0, num(month.used) ?? 0), received: Math.max(0, num(month.received) ?? 0) }))
    });
  }
  if (!clean.length) throw new ImportError("ไม่มีรายการยาที่ใช้ได้");
  return clean;
}

async function loadFacilities() {
  return query(`SELECT id, name, typecode, district_name FROM health_facilities WHERE is_active = 1 ORDER BY ${facilityOrderSql()}`);
}

/** ข้อมูลประกอบหน้าต่างนำเข้า: หน่วยบริการ หน่วยที่จับคู่ไว้กับรหัส รพ. และรายการที่ติดตามอยู่แล้ว */
export async function hospitalImportContext({ user, eocType, sessionId, hospCode }) {
  const { session, event } = await prepareSuppliesImport({ user, eocType, sessionId });
  const [facilities, mapped, tracked] = await Promise.all([
    loadFacilities(),
    hospCode ? query(`SELECT health_facility_id FROM hospital_drug_sources WHERE hosp_code = ?`, [text(hospCode, 20)]).catch(() => []) : [],
    query(`SELECT health_facility_id, item_code FROM medical_inventory_stock WHERE inventory_event_id = ?`, [event.id])
  ]);
  const trackedByFacility = {};
  for (const row of tracked) {
    const key = String(row.health_facility_id);
    (trackedByFacility[key] ||= []).push(row.item_code);
  }
  return {
    session_id: session.id,
    facilities: facilities.map((row) => ({ value: row.id, label: row.name, district: row.district_name || "", typecode: row.typecode || "" })),
    mapped_facility_id: mapped[0]?.health_facility_id || null,
    tracked: trackedByFacility
  };
}

/** สถานะคลังของหน่วยบริการหนึ่ง: รายการ รายงานประจำวัน และการปรับ/รับ/เบิกอื่นต่อวัน */
async function facilityState(exec, eventId, facilityId, lock = false) {
  const stocks = await exec(
    `SELECT id, item_code, item_name, unit, opening_qty, received_qty, issued_qty, balance_qty, DATE_FORMAT(created_at, '%Y-%m-%d') AS created_day
       FROM medical_inventory_stock WHERE inventory_event_id = ? AND health_facility_id = ?${lock ? " FOR UPDATE" : ""}`,
    [eventId, facilityId]
  );
  if (!stocks.length) return { stocks, reports: [], adjustments: [] };
  const ids = stocks.map((stock) => stock.id);
  const marks = ids.map(() => "?").join(",");
  const [reports, adjustments] = [
    await exec(
      `SELECT stock_id, DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, received_qty, used_qty, counted_qty, source
         FROM medical_inventory_daily_reports WHERE stock_id IN (${marks})`,
      ids
    ),
    await exec(
      `SELECT stock_id, DATE_FORMAT(movement_at, '%Y-%m-%d') AS day, SUM(COALESCE(balance_after, 0) - COALESCE(balance_before, 0)) AS net
         FROM medical_inventory_movements WHERE stock_id IN (${marks}) GROUP BY stock_id, day`,
      ids
    )
  ];
  return { stocks, reports, adjustments };
}

async function buildPlan(exec, { session, event, facility, hospCode, onhandDate, inventoryComplete, items, lock = false }) {
  const state = await facilityState(exec, event.id, facility.id, lock);
  return planHospitalDay({
    hospCode,
    onhandDate,
    inventoryComplete,
    sessionOpened: toDateKey(session.opened_at),
    today: todayKey(),
    ...state,
    items
  });
}

async function resolveInput({ user, eocType, sessionId, facilityId, hospCode, onhandDate, items }) {
  const { session, event } = await prepareSuppliesImport({ user, eocType, sessionId });
  const facility = (await query(`SELECT id, name, typecode FROM health_facilities WHERE id = ? LIMIT 1`, [Number(facilityId)]))[0];
  if (!facility) throw new ImportError("ไม่พบหน่วยบริการที่เลือก");
  return { session, event, facility, hosp: text(hospCode, 20), asOf: isoDate(onhandDate), clean: sanitizeItems(items) };
}

/** ตรวจก่อนบันทึก: คืนแผนรายรายการ (เพิ่มใหม่ / รายงานประจำวัน / หมด / ยังไม่รายงาน) โดยยังไม่เขียนอะไร */
export async function previewHospitalImport(input) {
  const { session, event, facility, hosp, asOf, clean } = await resolveInput(input);
  try {
    return await buildPlan(query, { session, event, facility, hospCode: hosp, onhandDate: asOf, inventoryComplete: Boolean(input.inventoryComplete), items: clean });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "WARN_DATA_TRUNCATED") throw new ImportError("ยังไม่ได้อัปเดตฐานข้อมูลสำหรับข้อมูลคลังยา รพ. (รัน npm run db:migrate)", 503);
    throw error;
  }
}

export async function commitHospitalImport(input) {
  const { user, request, filenames = [] } = input;
  const { session, event, facility, hosp, asOf, clean } = await resolveInput(input);
  const source = text(filenames.join(", "), 255) || "ไฟล์ระบบคลังยา";
  const byCode = new Map(clean.map((item) => [item.working_code.toUpperCase(), item]));

  const counts = await transaction(async (execute) => {
    const plan = await buildPlan(execute, { session, event, facility, hospCode: hosp, onhandDate: asOf, inventoryComplete: Boolean(input.inventoryComplete), items: clean, lock: true });
    if (plan.blocking) throw new ImportError(plan.blocking, 409);
    const result = { created: 0, opening: 0, reported: 0, out: 0, unchanged: 0, missing: 0, skipped: 0, lots: 0, months: 0 };
    if (hosp) {
      await execute(
        `INSERT INTO hospital_drug_sources (hosp_code, health_facility_id, updated_by) VALUES (?, ?, ?)
         ON DUPLICATE KEY UPDATE health_facility_id = VALUES(health_facility_id), updated_by = VALUES(updated_by)`,
        [hosp, facility.id, user?.id ?? null]
      );
    }
    const entries = [];
    const note = (row) => `ยอดคงคลังจากระบบคลังยา รพ. ณ ${asOf}${row.extra_received ? " · คงคลังเพิ่มเกินยอดรับในไฟล์ RECEIPT นับส่วนต่างเป็นรับเข้า" : ""}${row.action === "out" ? " · ไม่มีในไฟล์ (หมด)" : ""}`;
    const stockOf = new Map();
    for (const row of plan.rows) {
      if (row.action === "create") {
        const item = byCode.get(String(row.working_code).toUpperCase());
        const inserted = await execute(
          `INSERT INTO medical_inventory_stock
             (inventory_event_id, inventory_agency_id, health_facility_id, agency_name, agency_name_original, agency_type,
              item_code, item_name, unit, movement_tracked, opening_qty, received_qty, issued_qty, balance_qty, data_status, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 0, 0, ?, 'recorded', ?)`,
          [event.id, facility.id, facility.id, facility.name, facility.name, facility.typecode || "", hospitalItemCode(hosp, row.working_code),
            item?.name || row.name, item?.unit || row.unit, row.opening, row.opening, `${asOf} 12:00:00`]
        );
        stockOf.set(String(row.working_code).toUpperCase(), inserted.insertId);
        if (row.received > 0) entries.push({ stock_id: inserted.insertId, report_date: asOf, value: { received_qty: row.received, used_qty: 0, counted_qty: row.end, note: note(row) } });
        result.created += 1;
      } else if (row.action === "opening") {
        await execute(`UPDATE medical_inventory_stock SET opening_qty = ?, balance_qty = ?, data_status = 'recorded' WHERE id = ?`, [row.opening, row.opening, row.stock_id]);
        result.opening += 1;
      } else if (row.action === "report" || row.action === "out") {
        entries.push({ stock_id: row.stock_id, report_date: asOf, value: { ...row.value, note: note(row) } });
        result[row.action === "out" ? "out" : "reported"] += 1;
      } else if (row.action === "unchanged") result.unchanged += 1;
      else if (row.action === "missing") result.missing += 1;
      else result.skipped += 1;
      if (row.stock_id) stockOf.set(String(row.working_code).toUpperCase(), row.stock_id);
    }
    if (entries.length) await saveDailyEntries(execute, { eventId: event.id, user, source: "hospital", entries });

    // ล็อต/วันหมดอายุ (ยาที่มียอดคงคลังในไฟล์ หรือหมดแล้ว) และยอดรับ/จ่ายรายเดือน
    const lotRows = plan.rows.filter((row) => ["create", "opening", "report", "out", "unchanged"].includes(row.action));
    for (const row of lotRows) {
      const stockId = stockOf.get(String(row.working_code).toUpperCase());
      if (!stockId) continue;
      const item = byCode.get(String(row.working_code).toUpperCase());
      await execute(`DELETE FROM medical_inventory_lots WHERE stock_id = ?`, [stockId]);
      for (const lot of item?.lots || []) {
        await execute(
          `INSERT INTO medical_inventory_lots (stock_id, lot_no, expire_date, qty, value, onhand_date, source_file) VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [stockId, lot.lot_no, lot.expire_date, lot.qty, lot.value, asOf, source]
        );
        result.lots += 1;
      }
    }
    for (const item of clean) {
      const stockId = stockOf.get(item.working_code.toUpperCase());
      if (!stockId) continue;
      for (const month of item.usage) {
        await execute(
          `INSERT INTO medical_inventory_usage_baseline (stock_id, period, used_qty, received_qty, days_in_period, source_file)
           VALUES (?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE used_qty = VALUES(used_qty), received_qty = VALUES(received_qty), days_in_period = VALUES(days_in_period), source_file = VALUES(source_file)`,
          [stockId, month.period, month.used, month.received, daysInPeriod(month.period), source]
        );
        result.months += 1;
      }
    }
    return result;
  }).catch((error) => {
    if (error instanceof DailyError) throw new ImportError(error.message, error.status || 400);
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "WARN_DATA_TRUNCATED" || error?.code === "ER_TRUNCATED_WRONG_VALUE_FOR_FIELD") {
      throw new ImportError("ยังไม่ได้อัปเดตฐานข้อมูลสำหรับข้อมูลคลังยา รพ. (รัน npm run db:migrate)", 503);
    }
    throw error;
  });

  await recordChange({
    request, user, action: "data_update", table: "medical_inventory_daily_reports", id: event.id, sessionId: session.id,
    description: `นำเข้าคลังยา ${facility.name}${hosp ? ` (${hosp})` : ""} ยอด ณ ${asOf || "-"}: เพิ่ม ${counts.created} รายงาน ${counts.reported} หมด ${counts.out} ยังไม่รายงาน ${counts.missing}`
  });
  triggerEventAlerts(session.id);
  return counts;
}
