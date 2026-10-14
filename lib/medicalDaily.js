// รายงานเวชภัณฑ์ประจำวัน (ไม่แตะฐานข้อมูล ทดสอบได้)
// หลักการ: ยอดตั้งต้นมาจากวันแรกที่นำเข้า แล้วทุกวันหน่วยบริการรายงาน "รับเข้า" และ "ใช้ไป/จ่ายออก" ของแต่ละรายการ
// ระบบคำนวณยอดคงเหลือเอง = ยอดยกมา + รับเข้า − ใช้ไป  ส่วน "นับได้จริง" (ถ้ากรอก) ใช้ตรวจว่าตรงกับที่ระบบคำนวณหรือไม่

export const DAILY_WINDOW_DAYS = 7; // ใช้อัตราใช้เฉลี่ยย้อนหลังกี่วันในการคาดว่ายาจะพอใช้อีกกี่วัน
export const MAX_LEDGER_DAYS = 90;
export const COVER_LEVELS = {
  critical: { label: "พอใช้ไม่ถึง 3 วัน", tone: "red", maxDays: 3 },
  warning: { label: "พอใช้ 3–7 วัน", tone: "amber", maxDays: 7 },
  ok: { label: "พอใช้เกิน 7 วัน", tone: "green" },
  idle: { label: "ยังไม่มีการใช้", tone: "gray" }
};

const toNum = (value) => {
  const parsed = Number(String(value ?? "").replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value) => Math.round(value * 100) / 100;

/** วันที่ปัจจุบันตามเวลาไทย "YYYY-MM-DD" */
export function todayKey(now = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function addDays(dateKey, days) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + days));
  return date.toISOString().slice(0, 10);
}

/** รายการวันที่ from..to (รวมทั้งสองวัน) ไม่เกิน limit วันล่าสุด */
export function dateRange(from, to, limit = MAX_LEDGER_DAYS) {
  if (!from || !to || from > to) return to ? [to] : [];
  let start = from;
  const earliest = addDays(to, -(limit - 1));
  if (start < earliest) start = earliest;
  const days = [];
  for (let day = start; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** "2026-10-14" → "14/10/2569" (รูปแบบที่ใช้ในไฟล์ Excel) */
export function thaiDateText(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!y) return "";
  return `${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}/${y + 543}`;
}

/** "2026-10-14" → "14 ต.ค." */
export function shortThaiDate(dateKey) {
  const [y, m, d] = String(dateKey).split("-").map(Number);
  if (!y) return "";
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "UTC" });
}

/**
 * ตรวจค่าที่กรอกของ 1 รายการ → { ok, value: { received_qty, used_qty, counted_qty, note } } | { ok:false, error }
 * ใช้ไป (used) ต้องกรอกเสมอ ถ้าวันนั้นไม่ได้ใช้ให้ใส่ 0 — เพื่อแยก "ไม่ได้ใช้" ออกจาก "ลืมรายงาน"
 */
export function validateDailyEntry(input = {}) {
  const blank = (value) => value === undefined || value === null || String(value).trim() === "";
  const parse = (value) => Number(String(value).replace(/,/g, "").trim());
  if (blank(input.used_qty)) return { ok: false, error: "กรอกจำนวนที่ใช้ไป (ถ้าไม่ได้ใช้ใส่ 0)" };
  const used = parse(input.used_qty);
  const received = blank(input.received_qty) ? 0 : parse(input.received_qty);
  const counted = blank(input.counted_qty) ? null : parse(input.counted_qty);
  if (!Number.isFinite(used) || used < 0) return { ok: false, error: "จำนวนที่ใช้ไปต้องเป็นตัวเลขไม่ติดลบ" };
  if (!Number.isFinite(received) || received < 0) return { ok: false, error: "จำนวนรับเข้าต้องเป็นตัวเลขไม่ติดลบ" };
  if (counted !== null && (!Number.isFinite(counted) || counted < 0)) return { ok: false, error: "ยอดนับได้จริงต้องเป็นตัวเลขไม่ติดลบ" };
  if (used > 100000000 || received > 100000000 || (counted ?? 0) > 100000000) return { ok: false, error: "จำนวนมากเกินไป" };
  const note = String(input.note ?? "").trim().slice(0, 500) || null;
  return { ok: true, value: { received_qty: round(received), used_qty: round(used), counted_qty: counted === null ? null : round(counted), note } };
}

/**
 * ใช้รายงานของวันหนึ่งกับยอดคลัง (รองรับการแก้รายงานเดิม: หักค่าเดิมออกก่อนแล้วใส่ค่าใหม่)
 * stock: { received_qty, issued_qty, balance_qty } · previous: รายงานเดิมของวันเดียวกัน (หรือ null)
 */
export function applyDailyReport(stock, previous, next) {
  const dReceived = toNum(next.received_qty) - toNum(previous?.received_qty);
  const dUsed = toNum(next.used_qty) - toNum(previous?.used_qty);
  const before = toNum(stock.balance_qty);
  const after = round(before + dReceived - dUsed);
  if (after < 0) {
    return { ok: false, error: `ใช้ไปเกินยอดคงเหลือ (คงเหลือในระบบ ${before.toLocaleString("th-TH")}${stock.unit ? ` ${stock.unit}` : ""})` };
  }
  const unchanged = previous
    && toNum(previous.received_qty) === toNum(next.received_qty)
    && toNum(previous.used_qty) === toNum(next.used_qty)
    && (previous.counted_qty === null || previous.counted_qty === undefined ? null : toNum(previous.counted_qty)) === (next.counted_qty ?? null)
    && (previous.note || null) === (next.note || null);
  return {
    ok: true,
    unchanged: Boolean(unchanged),
    before,
    after,
    next: {
      received_qty: round(toNum(stock.received_qty) + dReceived),
      issued_qty: round(toNum(stock.issued_qty) + dUsed),
      balance_qty: after
    }
  };
}

/** ผลรวมการเปลี่ยนแปลงต่อวันของรายการหนึ่ง: รายงานประจำวัน (รับ−ใช้) + การปรับยอดอื่น (net) */
function dailyNet(reports = [], adjustments = []) {
  const map = new Map();
  const bucket = (day) => {
    if (!map.has(day)) map.set(day, { received: 0, used: 0, adjust: 0, counted: null, reported: false, note: null });
    return map.get(day);
  };
  for (const report of reports) {
    const entry = bucket(report.report_date);
    entry.received += toNum(report.received_qty);
    entry.used += toNum(report.used_qty);
    entry.reported = true;
    if (report.counted_qty !== null && report.counted_qty !== undefined) entry.counted = toNum(report.counted_qty);
    if (report.note) entry.note = report.note;
  }
  for (const adjustment of adjustments) bucket(adjustment.day).adjust += toNum(adjustment.net);
  return map;
}

/**
 * ยอดคงเหลือ ณ ต้นวัน dateKey (ยอดยกมา) ย้อนคำนวณจากยอดปัจจุบัน
 * = ยอดปัจจุบัน − การเปลี่ยนแปลงทั้งหมดตั้งแต่วันนั้นเป็นต้นไป
 */
export function balanceAtStartOf(balance, reports = [], adjustments = [], dateKey) {
  let value = toNum(balance);
  for (const report of reports) {
    if (report.report_date >= dateKey) value -= toNum(report.received_qty) - toNum(report.used_qty);
  }
  for (const adjustment of adjustments) {
    if (adjustment.day >= dateKey) value -= toNum(adjustment.net);
  }
  return round(value);
}

/**
 * บัญชีรายวันของ 1 รายการ: [{ date, start, received, used, adjust, end, counted, diff, reported }]
 * stock.balance_qty คือยอดปัจจุบัน · startDate = วันที่เพิ่มรายการเข้าคลัง (วันก่อนหน้านั้นไม่มีข้อมูล)
 */
export function buildLedger(stock, reports = [], adjustments = [], days = []) {
  if (!days.length) return [];
  const net = dailyNet(reports, adjustments);
  let running = balanceAtStartOf(stock.balance_qty, reports, adjustments, days[0]);
  const createdKey = stock.created_day || null;
  return days.map((day) => {
    const entry = net.get(day) || { received: 0, used: 0, adjust: 0, counted: null, reported: false, note: null };
    const start = running;
    const end = round(start + entry.received - entry.used + entry.adjust);
    running = end;
    const exists = !createdKey || day >= createdKey;
    return {
      date: day,
      exists,
      start,
      received: round(entry.received),
      used: round(entry.used),
      adjust: round(entry.adjust),
      end,
      counted: entry.counted,
      diff: entry.counted === null ? null : round(entry.counted - end),
      reported: entry.reported,
      note: entry.note
    };
  });
}

/**
 * อัตราใช้เฉลี่ยต่อวัน: ใช้วันที่ล่าสุด window วัน นับตั้งแต่วันที่มีรายงานวันแรก (ไม่หารด้วยวันก่อนเริ่มรายงาน)
 */
export function averageDailyUse(ledger = [], window = DAILY_WINDOW_DAYS) {
  const firstReported = ledger.findIndex((day) => day.reported);
  if (firstReported < 0) return 0;
  const span = ledger.slice(firstReported).slice(-window);
  if (!span.length) return 0;
  return round(span.reduce((sum, day) => sum + day.used, 0) / span.length);
}

/** คาดว่ายาจะพอใช้อีกกี่วัน (null = ยังไม่มีการใช้) */
export function daysOfCover(balance, avgUse) {
  const use = toNum(avgUse);
  if (use <= 0) return null;
  return Math.floor((toNum(balance) / use) * 10) / 10;
}

export function coverLevel(days) {
  if (days === null || days === undefined) return "idle";
  if (days < COVER_LEVELS.critical.maxDays) return "critical";
  if (days <= COVER_LEVELS.warning.maxDays) return "warning";
  return "ok";
}

/** สรุปการส่งรายงานของวันหนึ่ง: หน่วยที่มีรายการในคลัง เทียบกับหน่วยที่รายงานครบทุกรายการ */
export function reportingStatus(stockRows = [], reportsOfDay = []) {
  const itemsByFacility = new Map();
  for (const row of stockRows) {
    const key = row.health_facility_id || row.inventory_agency_id;
    if (!itemsByFacility.has(key)) itemsByFacility.set(key, { facility_id: key, name: row.agency_name, district: row.district_name || "", items: 0, reported: 0 });
    itemsByFacility.get(key).items += 1;
  }
  const stockFacility = new Map(stockRows.map((row) => [row.id, row.health_facility_id || row.inventory_agency_id]));
  const reportedStock = new Set(reportsOfDay.map((report) => report.stock_id));
  for (const stockId of reportedStock) {
    const facility = itemsByFacility.get(stockFacility.get(stockId));
    if (facility) facility.reported += 1;
  }
  const facilities = [...itemsByFacility.values()].map((facility) => ({
    ...facility,
    status: facility.reported === 0 ? "missing" : facility.reported < facility.items ? "partial" : "complete"
  })).sort((a, b) => ({ missing: 0, partial: 1, complete: 2 }[a.status] - { missing: 0, partial: 1, complete: 2 }[b.status]) || String(a.name).localeCompare(String(b.name), "th"));
  return {
    facilities,
    total: facilities.length,
    complete: facilities.filter((facility) => facility.status === "complete").length,
    partial: facilities.filter((facility) => facility.status === "partial").length,
    missing: facilities.filter((facility) => facility.status === "missing").length
  };
}
