// ออกซิเจนเหลวของโรงพยาบาล (ไม่แตะฐานข้อมูล ทดสอบได้)
// รายงานรายวันต่อหน่วยบริการ: ถังเหลวหลัก (psi) + ถังสำรองใหญ่/เล็ก (ถัง) → ใช้ได้อีกกี่วัน

export const OXYGEN_SOURCES = [
  { key: "tank", label: "ถังออกซิเจนเหลว", unit: "psi", hint: "ปริมาณคงเหลือในถังหลัก" },
  { key: "big", label: "ถังสำรองขนาดใหญ่", unit: "ถัง", hint: "จำนวนถังสำรองที่มี" },
  { key: "small", label: "ถังสำรองขนาดเล็ก", unit: "ถัง", hint: "จำนวนถังสำรองที่มี" }
];

/** ใช้ได้น้อยกว่า 1 วัน = วิกฤต, น้อยกว่า 3 วัน = ต้องจัดหาเพิ่ม */
export const OXYGEN_CRITICAL_DAYS = 1;
export const OXYGEN_LOW_DAYS = 3;

export const OXYGEN_LEVELS = {
  critical: { label: "วิกฤต (<1 วัน)", short: "วิกฤต", tone: "red" },
  low: { label: "ต้องจัดหาเพิ่ม (<3 วัน)", short: "ต้องจัดหา", tone: "amber" },
  ok: { label: "เพียงพอ", short: "เพียงพอ", tone: "green" },
  unknown: { label: "ยังไม่รายงาน", short: "ยังไม่รายงาน", tone: "gray" }
};

const toNumber = (value) => {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const parsed = Number(String(value).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : NaN;
};

/** จำนวนวันที่ใช้ได้ = คงเหลือ / ใช้ต่อวัน (ทศนิยม 1 ตำแหน่ง) — ไม่มีข้อมูลการใช้ = null */
export function daysLeft(qty, perDay) {
  const q = toNumber(qty);
  const u = toNumber(perDay);
  if (q === null || u === null || !Number.isFinite(q) || !Number.isFinite(u) || u <= 0) return null;
  return Math.round((Math.max(0, q) / u) * 10) / 10;
}

export function oxygenDays(row = {}) {
  const result = {};
  let total = null;
  for (const source of OXYGEN_SOURCES) {
    const days = daysLeft(row[`${source.key}_qty`], row[`${source.key}_use_per_day`]);
    result[source.key] = days;
    if (days !== null) total = Math.round(((total || 0) + days) * 10) / 10;
  }
  result.total = total;
  return result;
}

export function oxygenLevel(row) {
  const total = row?.days?.total ?? oxygenDays(row).total;
  if (total === null || total === undefined) return "unknown";
  if (total < OXYGEN_CRITICAL_DAYS) return "critical";
  if (total < OXYGEN_LOW_DAYS) return "low";
  return "ok";
}

/** ตรวจค่าที่กรอก คืน { ok, value } หรือ { ok:false, error } */
export function validateOxygenReport(body = {}) {
  const value = {};
  let anyQty = false;
  for (const source of OXYGEN_SOURCES) {
    for (const field of ["qty", "use_per_day"]) {
      const key = `${source.key}_${field}`;
      const parsed = toNumber(body[key]);
      if (Number.isNaN(parsed) || (parsed !== null && parsed < 0)) {
        return { ok: false, error: `${source.label}: ${field === "qty" ? "คงเหลือ" : "ใช้ต่อวัน"} ต้องเป็นตัวเลขไม่ติดลบ` };
      }
      value[key] = parsed;
      if (field === "qty" && parsed !== null) anyQty = true;
    }
    if (value[`${source.key}_qty`] !== null && value[`${source.key}_use_per_day`] === null) {
      return { ok: false, error: `${source.label}: กรุณาระบุปริมาณที่ใช้ต่อวัน เพื่อคำนวณวันที่ใช้ได้` };
    }
  }
  if (!anyQty) return { ok: false, error: "กรุณากรอกคงเหลืออย่างน้อย 1 รายการ" };
  value.procurement_problem = body.procurement_problem === true || body.procurement_problem === 1 || body.procurement_problem === "1" ? 1 : 0;
  value.problem_note = String(body.problem_note || "").trim().slice(0, 500) || null;
  if (value.procurement_problem && !value.problem_note) return { ok: false, error: "กรุณาระบุปัญหาการจัดหา" };
  return { ok: true, value };
}

const LEVEL_RANK = { critical: 0, low: 1, unknown: 2, ok: 3 };

/** เติม days/level ให้รายงานล่าสุดของแต่ละหน่วย แล้วสรุปภาพรวม */
export function summarizeOxygen(rows = []) {
  const items = rows
    .map((row) => {
      const days = oxygenDays(row);
      return { ...row, days, level: oxygenLevel({ days }) };
    })
    .sort((a, b) => LEVEL_RANK[a.level] - LEVEL_RANK[b.level] || (a.days.total ?? 1e9) - (b.days.total ?? 1e9));
  const count = (level) => items.filter((item) => item.level === level).length;
  const known = items.filter((item) => item.days.total !== null);
  return {
    facilities: items.length,
    critical: count("critical"),
    low: count("low"),
    ok: count("ok"),
    problems: items.filter((item) => Number(item.procurement_problem) === 1).length,
    minDays: known.length ? Math.min(...known.map((item) => item.days.total)) : null,
    items
  };
}

export function formatDays(days) {
  if (days === null || days === undefined) return "-";
  return Number(days).toLocaleString("th-TH", { maximumFractionDigits: 1 });
}
