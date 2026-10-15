// วางแผนการนำเข้าไฟล์คลังยาของโรงพยาบาลแบบรายวัน (ไม่มีการเรียกฐานข้อมูลในไฟล์นี้)
// ยอดคงคลังในไฟล์ INVENTORY ของวันที่ D = ยอดนับ ณ สิ้นวัน D ของแต่ละยา
//   ใช้ไป = ยอดในระบบก่อนรายงานวัน D (ยกมา + การปรับ/เบิกที่บันทึกไว้ในวัน D) + รับเข้า − คงคลังในไฟล์
//   ยาที่ยังไม่เคยติดตาม → เพิ่มใหม่ ใช้คงคลังเป็นยอดตั้งต้นของวัน D
//   ยาที่ติดตามอยู่แต่ไม่มีในไฟล์ → ไฟล์ครบทุกหน้า = หมด (คงเหลือ 0) · ไฟล์ไม่ครบ = ยังไม่รายงาน

export const PLAN_ACTIONS = {
  create: { label: "เพิ่มใหม่", tone: "blue" },
  opening: { label: "แก้ยอดตั้งต้น", tone: "blue" },
  report: { label: "รายงานประจำวัน", tone: "green" },
  out: { label: "หมด (ไม่มีในไฟล์)", tone: "red" },
  unchanged: { label: "เท่าเดิม", tone: "gray" },
  missing: { label: "ยังไม่รายงาน (ไฟล์ไม่ครบ)", tone: "amber" },
  skip: { label: "ข้าม", tone: "gray" },
  error: { label: "ต้องตรวจ", tone: "red" }
};

const toNum = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};
const round = (value) => Math.round(value * 100) / 100;
const SOURCE_LABEL = { form: "แบบฟอร์ม", excel: "Excel", hospital: "ไฟล์คลังยา รพ." };

export function hospitalPrefix(hospCode) {
  return `${String(hospCode || "HOSP").trim().toUpperCase().replace(/\s+/g, "_")}:`;
}

/** ชื่อยาแบบเทียบได้ (ตัวพิมพ์เล็ก ตัดช่องว่างและเครื่องหมาย) */
export function drugNameKey(value) {
  return String(value || "").toLowerCase().replace(/[^a-z0-9ก-๙]/g, "");
}

// คำแรกภาษาอังกฤษที่ยาวพอใช้เทียบชื่อสามัญ เช่น "doxycycline"
function firstWord(value) {
  const match = String(value || "").toLowerCase().match(/[a-z]{5,}/);
  return match ? match[0] : "";
}

/**
 * stocks: รายการคลังของหน่วยบริการนี้ในเหตุการณ์ { id, item_code, item_name, unit, balance_qty, received_qty, issued_qty, created_day }
 * reports: รายงานประจำวันของรายการเหล่านั้น · adjustments: [{ stock_id, day, net }] การปรับ/รับ/เบิกอื่นต่อวัน
 * items: รายการจากไฟล์ (ที่ติดตามอยู่ + ที่เลือกเพิ่ม) { working_code, name, unit, onhand, received_on }
 */
export function planHospitalDay({ hospCode, onhandDate, inventoryComplete = false, sessionOpened = null, today, stocks = [], reports = [], adjustments = [], items = [] }) {
  const prefix = hospitalPrefix(hospCode);
  const D = onhandDate || null;
  const result = { date: D, rows: [], blocking: null, manual: [], summary: {} };
  const hospitalStocks = stocks.filter((stock) => String(stock.item_code).toUpperCase().startsWith(prefix));
  const manualStocks = stocks.filter((stock) => !String(stock.item_code).toUpperCase().startsWith(prefix));
  const stockByCode = new Map(hospitalStocks.map((stock) => [String(stock.item_code).toUpperCase().slice(prefix.length), stock]));
  const reportsOf = new Map();
  for (const report of reports) {
    if (!reportsOf.has(report.stock_id)) reportsOf.set(report.stock_id, []);
    reportsOf.get(report.stock_id).push(report);
  }
  const adjustOf = new Map();
  for (const row of adjustments) {
    if (!adjustOf.has(row.stock_id)) adjustOf.set(row.stock_id, []);
    adjustOf.get(row.stock_id).push(row);
  }

  if (D && today && D > today) result.blocking = `วันที่ของยอดคงคลังในไฟล์ (${D}) อยู่ในอนาคต`;
  const latestHospitalReport = hospitalStocks.flatMap((stock) => (reportsOf.get(stock.id) || []).map((report) => report.report_date)).sort().pop() || null;
  if (D && latestHospitalReport && D < latestHospitalReport) {
    result.blocking = `มีรายงานของวันที่ ${latestHospitalReport} แล้ว ไฟล์นี้เป็นยอด ณ ${D} ซึ่งเก่ากว่า — นำเข้าไฟล์ของวันล่าสุดแทน`;
  }
  const beforeOpen = Boolean(D && sessionOpened && D < sessionOpened);

  const fileCodes = new Set();
  for (const item of items) {
    const code = String(item.working_code).toUpperCase();
    fileCodes.add(code);
    const stock = stockByCode.get(code) || null;
    const onhand = item.onhand === null || item.onhand === undefined ? null : round(toNum(item.onhand));
    const receivedOn = round(Math.max(0, toNum(item.received_on)));
    const base = { working_code: item.working_code, name: stock?.item_name || item.name, unit: stock?.unit || item.unit, stock_id: stock?.id || null, onhand, tracked: Boolean(stock) };

    if (onhand === null || !D) {
      result.rows.push({ ...base, action: stock ? "skip" : "skip", reason: D ? "ไม่มียอดคงคลังในไฟล์ (บันทึกเฉพาะอัตราใช้ปกติ)" : "ไม่มีไฟล์ INVENTORY" });
      continue;
    }
    if (!stock) {
      // ยาใหม่: ยอดตั้งต้นของวัน D (ถ้ามีรับเข้าในวัน D ตาม RECEIPT แยกเป็นรับเข้า)
      const received = !beforeOpen && receivedOn > 0 && receivedOn <= onhand ? receivedOn : 0;
      result.rows.push({ ...base, action: "create", opening: round(onhand - received), received, used: 0, end: onhand });
      continue;
    }
    result.rows.push(planExisting(stock, base, { D, onhand, receivedOn, beforeOpen, reports: reportsOf.get(stock.id) || [], adjustments: adjustOf.get(stock.id) || [] }));
  }

  // ยาที่ติดตามอยู่แต่ไม่มีในไฟล์
  if (D) {
    for (const [code, stock] of stockByCode) {
      if (fileCodes.has(code)) continue;
      const base = { working_code: code, name: stock.item_name, unit: stock.unit, stock_id: stock.id, onhand: null, tracked: true };
      if (!inventoryComplete) {
        result.rows.push({ ...base, action: "missing", reason: "ไม่อยู่ในหน้าที่นำเข้า ระบบยังไม่สรุปว่าหมด" });
        continue;
      }
      const row = planExisting(stock, base, { D, onhand: 0, receivedOn: 0, beforeOpen, reports: reportsOf.get(stock.id) || [], adjustments: adjustOf.get(stock.id) || [] });
      result.rows.push(row.action === "report" ? { ...row, action: "out" } : row);
    }
  }

  // รายการที่เจ้าหน้าที่เพิ่มเองของหน่วยนี้: ไม่ถูกแตะ แต่ยังต้องรายงานเอง และเตือนถ้าน่าจะซ้ำกับยาในไฟล์
  const fileNames = items.map((item) => ({ name: item.name, word: firstWord(item.name) })).filter((item) => item.word);
  result.manual = manualStocks.map((stock) => {
    const word = firstWord(stock.item_name);
    const match = word ? fileNames.find((item) => item.word === word) : null;
    return { stock_id: stock.id, item_name: stock.item_name, unit: stock.unit, possible_duplicate: match ? match.name : null };
  });

  const count = (action) => result.rows.filter((row) => row.action === action).length;
  result.summary = {
    create: count("create"), opening: count("opening"), report: count("report"), out: count("out"), unchanged: count("unchanged"),
    missing: count("missing"), skip: count("skip"), error: count("error"),
    replaces: result.rows.filter((row) => row.replaces && row.replaces !== "hospital").length,
    extra_received: result.rows.filter((row) => row.extra_received).length,
    manual: result.manual.length,
    duplicates: result.manual.filter((row) => row.possible_duplicate).length
  };
  return result;
}

function planExisting(stock, base, { D, onhand, receivedOn, beforeOpen, reports, adjustments }) {
  const created = stock.created_day || null;
  if (created && D < created) return { ...base, action: "skip", reason: `ไฟล์เป็นยอด ณ ${D} ก่อนวันที่เริ่มติดตาม (${created})` };
  const existing = reports.find((report) => report.report_date === D) || null;
  const hasActivity = reports.length > 0 || adjustments.length > 0;
  if (created && D === created && !hasActivity) {
    // วันเดียวกับที่เริ่มติดตามและยังไม่มีความเคลื่อนไหว → แก้ยอดตั้งต้น
    const balance = round(toNum(stock.balance_qty));
    return balance === onhand ? { ...base, action: "unchanged", end: onhand } : { ...base, action: "opening", opening: onhand, before: balance, end: onhand };
  }
  if (beforeOpen) return { ...base, action: "skip", reason: "ยอดคงคลังก่อนวันเปิด EOC ใช้ตั้งยอดได้เฉพาะยาใหม่" };
  // ยอดในระบบ ณ สิ้นวัน D ก่อนรายงานนี้ = ยอดปัจจุบัน − รายงานวัน D เดิม − ทุกอย่างหลังวัน D
  let available = toNum(stock.balance_qty);
  for (const report of reports) {
    if (report.report_date >= D) available -= toNum(report.received_qty) - toNum(report.used_qty);
  }
  for (const adjustment of adjustments) {
    if (adjustment.day > D) available -= toNum(adjustment.net);
  }
  available = round(available);
  let received = receivedOn;
  let used = round(available + received - onhand);
  let extraReceived = false;
  if (used < 0) {
    // คงคลังเพิ่มมากกว่าที่รับตามไฟล์ RECEIPT → นับส่วนต่างเป็นรับเข้า (ไม่ใช้ค่าใช้ไปติดลบ)
    received = round(received - used);
    used = 0;
    extraReceived = true;
  }
  const value = { received_qty: received, used_qty: used, counted_qty: onhand };
  const same = existing
    && round(toNum(existing.received_qty)) === received
    && round(toNum(existing.used_qty)) === used
    && (existing.counted_qty === null || existing.counted_qty === undefined ? null : round(toNum(existing.counted_qty))) === onhand;
  if (same) return { ...base, action: "unchanged", start: available, received, used, end: onhand };
  return {
    ...base,
    action: "report",
    start: available,
    received,
    used,
    end: onhand,
    value,
    extra_received: extraReceived,
    replaces: existing ? (existing.source || "form") : null,
    replaces_label: existing ? SOURCE_LABEL[existing.source] || "แบบฟอร์ม" : null
  };
}
