// รายงานเวชภัณฑ์ประจำวัน ฝั่งเซิร์ฟเวอร์: โหลดข้อมูลเหตุการณ์ → บันทึกรายงาน (ฟอร์ม/Excel) → สรุป dashboard
import { query } from "@/lib/db";
import { stockLevel } from "@/lib/medicalInventory";
import {
  applyDailyReport, averageDailyUse, balanceAtStartOf, buildLedger, coverLevel, dateRange, daysOfCover, reportingStatus, todayKey
} from "@/lib/medicalDaily";
import { toDateKey } from "@/lib/sessionDateRange";
import { expiryStatus } from "@/lib/hospitalDrugFiles";

// ใช้อัตราใช้ปกติจากระบบของโรงพยาบาลจนกว่าจะมีรายงานรายวันครบกี่วัน
export const BASELINE_UNTIL_DAYS = 3;

/** อัตราใช้ปกติต่อวันจากยอดจ่ายเดือนล่าสุดที่มีข้อมูลการจ่าย */
export function usageBaseline(rows = []) {
  const month = (rows || []).find((row) => Number(row.used_qty) > 0);
  if (!month) return null;
  const days = Number(month.days_in_period) || 30;
  return { period: month.period, used: Number(month.used_qty), days, avg_daily: Math.round((Number(month.used_qty) / days) * 100) / 100 };
}

export class DailyError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

const num = (value) => Number(value || 0);
const round = (value) => Math.round(value * 100) / 100;
const userName = (user) => [user?.givenName, user?.familyName].filter(Boolean).join(" ") || user?.username || null;

export async function resolveSupplySession(eocType, sessionId) {
  const rows = await query(
    sessionId
      ? `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? AND eoc_type = ? LIMIT 1`
      : `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE eoc_type = ?
         ORDER BY (status = 'active') DESC, opened_at DESC LIMIT 1`,
    sessionId ? [sessionId, eocType] : [eocType]
  );
  return rows[0] || null;
}

export async function findSupplyEvent(session) {
  const rows = await query(
    `SELECT id, event_name, eoc_type, session_number FROM medical_inventory_events WHERE eoc_type = ? AND session_number = ? LIMIT 1`,
    [session.eoc_type, session.session_number]
  );
  return rows[0] || null;
}

/** ข้อมูลทั้งหมดของบัญชีคลังเหตุการณ์หนึ่ง: รายการคลัง รายงานประจำวัน และการปรับยอดอื่น (net ต่อวัน) */
export async function loadDailyData(eventId) {
  const [stock, reports, adjustments] = await Promise.all([
    query(
      `SELECT s.id, s.inventory_agency_id, s.health_facility_id, s.agency_name, s.item_code, s.item_name, s.unit,
              s.opening_qty, s.received_qty, s.issued_qty, s.balance_qty, s.data_status,
              DATE_FORMAT(s.created_at, '%Y-%m-%d') AS created_day, s.updated_at, hf.district_name
       FROM medical_inventory_stock s LEFT JOIN health_facilities hf ON hf.id = s.health_facility_id
       WHERE s.inventory_event_id = ? ORDER BY s.agency_name, s.item_name`,
      [eventId]
    ),
    query(
      `SELECT id, stock_id, DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, received_qty, used_qty, counted_qty, note,
              reported_by_name, source, updated_at
       FROM medical_inventory_daily_reports WHERE inventory_event_id = ? ORDER BY report_date, id`,
      [eventId]
    ),
    query(
      `SELECT m.stock_id, DATE_FORMAT(m.movement_at, '%Y-%m-%d') AS day,
              SUM(COALESCE(m.balance_after, 0) - COALESCE(m.balance_before, 0)) AS net
       FROM medical_inventory_movements m JOIN medical_inventory_stock s ON s.id = m.stock_id
       WHERE s.inventory_event_id = ? GROUP BY m.stock_id, day`,
      [eventId]
    )
  ]);
  const group = (rows, key) => {
    const map = new Map();
    for (const row of rows) {
      if (!map.has(row[key])) map.set(row[key], []);
      map.get(row[key]).push(row);
    }
    return map;
  };
  // ล็อต/วันหมดอายุ และอัตราใช้ปกติจากระบบคลังยาของโรงพยาบาล (ตารางอาจยังไม่ถูกสร้าง)
  const optionalRows = (sql) => query(sql, [eventId]).catch((error) => {
    if (error?.code === "ER_NO_SUCH_TABLE") return [];
    throw error;
  });
  const [lots, baseline] = await Promise.all([
    optionalRows(
      `SELECT l.stock_id, l.lot_no, DATE_FORMAT(l.expire_date, '%Y-%m-%d') AS expire_date, l.qty, l.value, DATE_FORMAT(l.onhand_date, '%Y-%m-%d') AS onhand_date
       FROM medical_inventory_lots l JOIN medical_inventory_stock s ON s.id = l.stock_id
       WHERE s.inventory_event_id = ? ORDER BY l.expire_date IS NULL, l.expire_date`
    ),
    optionalRows(
      `SELECT b.stock_id, b.period, b.used_qty, b.received_qty, b.days_in_period
       FROM medical_inventory_usage_baseline b JOIN medical_inventory_stock s ON s.id = b.stock_id
       WHERE s.inventory_event_id = ? ORDER BY b.period DESC`
    )
  ]);
  return {
    stock, reports, reportsByStock: group(reports, "stock_id"), adjustmentsByStock: group(adjustments, "stock_id"),
    lotsByStock: group(lots, "stock_id"), baselineByStock: group(baseline, "stock_id")
  };
}

/** ช่วงวันของเหตุการณ์ (เปิด EOC → วันนี้/วันปิด) ไม่เกิน 90 วันล่าสุด */
export function sessionDays(session, reports = [], now = new Date()) {
  const today = todayKey(now);
  const end = toDateKey(session?.closed_at) || today;
  const firstReport = reports.reduce((min, report) => (!min || report.report_date < min ? report.report_date : min), null);
  const opened = toDateKey(session?.opened_at) || firstReport || end;
  const start = firstReport && firstReport < opened ? firstReport : opened;
  return dateRange(start, end > today ? today : end);
}

/** แบบฟอร์มรายงานประจำวันของหน่วยบริการหนึ่ง: ทุกรายการพร้อมยอดยกมา และค่าที่เคยรายงานของวันนั้น */
export function dailyForm(data, facilityId, dateKey) {
  const rows = data.stock
    .filter((row) => String(row.health_facility_id || row.inventory_agency_id) === String(facilityId))
    .map((row) => {
      const reports = data.reportsByStock.get(row.id) || [];
      const adjustments = data.adjustmentsByStock.get(row.id) || [];
      const existing = reports.find((report) => report.report_date === dateKey) || null;
      return {
        stock_id: row.id,
        item_code: row.item_code,
        item_name: row.item_name,
        unit: row.unit,
        start_qty: balanceAtStartOf(row.balance_qty, reports, adjustments, dateKey),
        balance_qty: num(row.balance_qty),
        report: existing ? {
          received_qty: num(existing.received_qty), used_qty: num(existing.used_qty),
          counted_qty: existing.counted_qty === null ? null : num(existing.counted_qty), note: existing.note || "",
          reported_by_name: existing.reported_by_name, updated_at: existing.updated_at, source: existing.source || "form"
        } : null
      };
    })
    .sort((a, b) => String(a.item_name).localeCompare(String(b.item_name), "th"));
  return rows;
}

/**
 * บันทึกรายงานประจำวัน (ใช้ทั้งฟอร์มและ Excel) ภายในธุรกรรมเดียว
 * entries: [{ stock_id, report_date, value: { received_qty, used_qty, counted_qty, note } }]
 * คืน { created, updated, unchanged } หรือ throw DailyError พร้อมรายการที่ผิด
 */
export async function saveDailyEntries(execute, { eventId, user, source = "form", entries }) {
  const stockIds = [...new Set(entries.map((entry) => entry.stock_id))];
  if (!stockIds.length) return { created: 0, updated: 0, unchanged: 0 };
  const locked = await execute(
    `SELECT id, item_name, unit, agency_name, received_qty, issued_qty, balance_qty FROM medical_inventory_stock
     WHERE inventory_event_id = ? AND id IN (${stockIds.map(() => "?").join(",")}) FOR UPDATE`,
    [eventId, ...stockIds]
  );
  const stockById = new Map(locked.map((row) => [row.id, { ...row }]));
  const counts = { created: 0, updated: 0, unchanged: 0 };
  for (const entry of entries) {
    const stock = stockById.get(entry.stock_id);
    if (!stock) throw new DailyError("ไม่พบรายการเวชภัณฑ์ในบัญชีคลังของเหตุการณ์นี้", 404);
    const existingRows = await execute(
      `SELECT id, received_qty, used_qty, counted_qty, note FROM medical_inventory_daily_reports WHERE stock_id = ? AND report_date = ? FOR UPDATE`,
      [entry.stock_id, entry.report_date]
    );
    const existing = existingRows[0] || null;
    const result = applyDailyReport(stock, existing, entry.value);
    if (!result.ok) throw new DailyError(`${stock.item_name} (${stock.agency_name}): ${result.error}`);
    if (result.unchanged) { counts.unchanged += 1; continue; }
    const v = entry.value;
    if (existing) {
      await execute(
        `UPDATE medical_inventory_daily_reports SET received_qty = ?, used_qty = ?, counted_qty = ?, note = ?, source = ?, reported_by = ?, reported_by_name = ?
         WHERE id = ?`,
        [v.received_qty, v.used_qty, v.counted_qty, v.note, source, user.id, userName(user), existing.id]
      );
      counts.updated += 1;
    } else {
      await execute(
        `INSERT INTO medical_inventory_daily_reports
           (inventory_event_id, stock_id, report_date, received_qty, used_qty, counted_qty, note, source, reported_by, reported_by_name)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [eventId, entry.stock_id, entry.report_date, v.received_qty, v.used_qty, v.counted_qty, v.note, source, user.id, userName(user)]
      );
      counts.created += 1;
    }
    await execute(
      `UPDATE medical_inventory_stock SET received_qty = ?, issued_qty = ?, balance_qty = ?, data_status = 'recorded' WHERE id = ?`,
      [result.next.received_qty, result.next.issued_qty, result.next.balance_qty, entry.stock_id]
    );
    Object.assign(stock, result.next);
  }
  return counts;
}

/** สรุปทั้งหมดสำหรับ dashboard วิเคราะห์ */
export function buildSupplyDashboard(data, session, now = new Date()) {
  const today = todayKey(now);
  const days = sessionDays(session, data.reports, now);
  const lastDay = days[days.length - 1] || today;

  const stocks = data.stock.map((row) => {
    const reports = data.reportsByStock.get(row.id) || [];
    const ledger = buildLedger(row, reports, data.adjustmentsByStock.get(row.id) || [], days);
    const dailyAvg = averageDailyUse(ledger);
    const reportedDays = ledger.filter((day) => day.reported).length;
    // รายงานรายวันยังไม่ถึง 3 วัน → ใช้อัตราใช้ปกติจากระบบของโรงพยาบาล (เดือนล่าสุด) แทน
    const baseline = usageBaseline(data.baselineByStock?.get(row.id));
    const useBaseline = baseline && reportedDays < BASELINE_UNTIL_DAYS;
    const avgUse = useBaseline ? baseline.avg_daily : dailyAvg;
    const cover = daysOfCover(row.balance_qty, avgUse);
    const lots = (data.lotsByStock?.get(row.id) || []).map((lot) => ({ lot_no: lot.lot_no, expire_date: lot.expire_date, qty: num(lot.qty), value: lot.value === null ? null : num(lot.value) }));
    const lastReport = reports.length ? reports[reports.length - 1] : null;
    const lastCounted = [...ledger].reverse().find((day) => day.counted !== null) || null;
    return {
      id: row.id,
      facility_id: row.health_facility_id || row.inventory_agency_id,
      agency_name: row.agency_name,
      district: row.district_name || "ไม่ระบุอำเภอ",
      item_code: row.item_code,
      item_name: row.item_name,
      unit: row.unit,
      opening: num(row.opening_qty),
      received: num(row.received_qty),
      used: num(row.issued_qty),
      balance: num(row.balance_qty),
      level: stockLevel(row),
      avg_use: avgUse,
      avg_source: useBaseline ? "baseline" : "daily",
      baseline,
      nearest_expiry: lots.find((lot) => lot.expire_date)?.expire_date || null,
      lots,
      days_cover: cover,
      cover_level: coverLevel(cover),
      last_report: lastReport?.report_date || null,
      reported_today: reports.some((report) => report.report_date === lastDay),
      last_diff: lastCounted ? { date: lastCounted.date, counted: lastCounted.counted, end: lastCounted.end, diff: lastCounted.diff } : null,
      ledger
    };
  });

  // สรุปรายเวชภัณฑ์ทั้งจังหวัด (รวมทุกหน่วยบริการ หน่วยนับเดียวกัน)
  const itemMap = new Map();
  for (const stock of stocks) {
    if (!itemMap.has(stock.item_code)) {
      itemMap.set(stock.item_code, {
        item_code: stock.item_code, item_name: stock.item_name, unit: stock.unit, facilities: 0,
        opening: 0, received: 0, used: 0, balance: 0, avg_use: 0, out: 0, low: 0, critical: 0, series: new Map()
      });
    }
    const item = itemMap.get(stock.item_code);
    item.facilities += 1;
    item.opening += stock.opening;
    item.received += stock.received;
    item.used += stock.used;
    item.balance += stock.balance;
    item.avg_use += stock.avg_use;
    if (stock.level === "out") item.out += 1;
    if (stock.level === "low") item.low += 1;
    if (stock.cover_level === "critical") item.critical += 1;
    for (const day of stock.ledger) {
      if (!day.exists) continue;
      const point = item.series.get(day.date) || { date: day.date, received: 0, used: 0, end: 0, reported: 0 };
      point.received += day.received;
      point.used += day.used;
      point.end += day.end;
      point.reported += day.reported ? 1 : 0;
      item.series.set(day.date, point);
    }
  }
  const items = [...itemMap.values()].map((item) => {
    const avg = round(item.avg_use);
    const cover = daysOfCover(item.balance, avg);
    return {
      ...item,
      opening: round(item.opening), received: round(item.received), used: round(item.used), balance: round(item.balance), avg_use: avg,
      days_cover: cover, cover_level: coverLevel(cover),
      series: [...item.series.values()].map((point) => ({ ...point, received: round(point.received), used: round(point.used), end: round(point.end) }))
    };
  }).sort((a, b) => b.used - a.used || String(a.item_name).localeCompare(String(b.item_name), "th"));

  // การส่งรายงาน 14 วันล่าสุด
  const reportsByDay = new Map();
  for (const report of data.reports) {
    if (!reportsByDay.has(report.report_date)) reportsByDay.set(report.report_date, []);
    reportsByDay.get(report.report_date).push(report);
  }
  const reportingSeries = days.slice(-14).map((day) => {
    const existing = data.stock.filter((row) => !row.created_day || row.created_day <= day);
    const status = reportingStatus(existing, reportsByDay.get(day) || []);
    return { date: day, total: status.total, complete: status.complete, partial: status.partial, missing: status.missing };
  });
  const reportingToday = reportingStatus(data.stock, reportsByDay.get(lastDay) || []);

  // ยอดคงเหลือรายอำเภอ × เวชภัณฑ์
  const districtMap = new Map();
  for (const stock of stocks) {
    const key = stock.district;
    if (!districtMap.has(key)) districtMap.set(key, { district: key, facilities: new Set(), items: {} });
    const district = districtMap.get(key);
    district.facilities.add(stock.facility_id);
    const cell = district.items[stock.item_code] || { balance: 0, used: 0, avg_use: 0, out: 0 };
    cell.balance = round(cell.balance + stock.balance);
    cell.used = round(cell.used + stock.used);
    cell.avg_use = round(cell.avg_use + stock.avg_use);
    cell.out += stock.level === "out" ? 1 : 0;
    district.items[stock.item_code] = cell;
  }
  const districts = [...districtMap.values()]
    .map((district) => ({ ...district, facilities: district.facilities.size }))
    .sort((a, b) => String(a.district).localeCompare(String(b.district), "th"));

  // ยอดนับจริงไม่ตรงกับที่ระบบคำนวณ
  const discrepancies = [];
  for (const stock of stocks) {
    for (const day of stock.ledger) {
      if (day.diff !== null && day.diff !== 0) {
        discrepancies.push({ stock_id: stock.id, date: day.date, agency_name: stock.agency_name, item_name: stock.item_name, unit: stock.unit, end: day.end, counted: day.counted, diff: day.diff });
      }
    }
  }
  discrepancies.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : Math.abs(b.diff) - Math.abs(a.diff)));

  const urgencyRank = (stock) => (stock.level === "out" ? 0 : stock.cover_level === "critical" ? 1 : stock.level === "low" ? 2 : stock.cover_level === "warning" ? 3 : 9);
  const urgent = stocks
    .filter((stock) => urgencyRank(stock) < 9)
    .sort((a, b) => urgencyRank(a) - urgencyRank(b) || (a.days_cover ?? 0) - (b.days_cover ?? 0))
    .slice(0, 40);

  const slim = (stock) => {
    const { ledger, lots, ...rest } = stock;
    return rest;
  };

  // ยาใกล้หมดอายุ (จากล็อตที่นำเข้าจากระบบคลังยาของโรงพยาบาล)
  const expiring = [];
  let lotCount = 0;
  for (const stock of stocks) {
    for (const lot of stock.lots) {
      lotCount += 1;
      const status = expiryStatus(lot.expire_date, today);
      if (!status || status.key === "ok" || !(lot.qty > 0)) continue;
      expiring.push({ stock_id: stock.id, agency_name: stock.agency_name, item_name: stock.item_name, unit: stock.unit, lot_no: lot.lot_no, expire_date: lot.expire_date, qty: lot.qty, value: lot.value, status: status.key, days: status.days });
    }
  }
  expiring.sort((a, b) => a.expire_date.localeCompare(b.expire_date));

  return {
    today: lastDay,
    days,
    summary: {
      items: items.length,
      facilities: new Set(stocks.map((stock) => stock.facility_id)).size,
      stock_rows: stocks.length,
      out: stocks.filter((stock) => stock.level === "out").length,
      low: stocks.filter((stock) => stock.level === "low").length,
      critical_cover: stocks.filter((stock) => stock.cover_level === "critical").length,
      warning_cover: stocks.filter((stock) => stock.cover_level === "warning").length,
      discrepancies: discrepancies.filter((item) => item.date === lastDay).length,
      reports_total: data.reports.length,
      lots: lotCount,
      expired: expiring.filter((lot) => lot.status === "expired").length,
      expiring_90: expiring.filter((lot) => lot.status === "within90").length,
      expiring_180: expiring.filter((lot) => lot.status === "within180").length,
      baseline_items: stocks.filter((stock) => stock.avg_source === "baseline").length,
      first_report: data.reports[0]?.report_date || null
    },
    items,
    stocks: stocks.map(slim),
    urgent: urgent.map(slim),
    reporting: { today: reportingToday, series: reportingSeries },
    districts,
    discrepancies: discrepancies.slice(0, 60),
    expiring: expiring.slice(0, 80)
  };
}
