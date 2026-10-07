// บันทึกพื้นที่น้ำท่วมรายวัน (SAT) — กติกากลางที่ไม่แตะฐานข้อมูล ใช้ทั้งหน้าเว็บและ unit test
// 1 แถว = 1 หมู่บ้าน ต่อ 1 วัน ในเหตุการณ์หนึ่ง

export const FLOOD_LEVELS = [
  { value: "ไม่มี", tone: "gray", hint: "ไม่มีน้ำท่วม/น้ำลดแล้ว" },
  { value: "ต่ำ", tone: "blue", hint: "น้ำท่วมขังเล็กน้อย สัญจรได้" },
  { value: "ปานกลาง", tone: "amber", hint: "น้ำท่วมถนน/ใต้ถุนบ้าน" },
  { value: "สูง", tone: "red", hint: "น้ำเข้าบ้าน ต้องเฝ้าระวังการอพยพ" },
  { value: "สูงมาก", tone: "red", hint: "ต้องอพยพ/ช่วยเหลือเร่งด่วน" }
];

export function levelMeta(value) {
  return FLOOD_LEVELS.find((item) => item.value === value) || FLOOD_LEVELS[0];
}

const pad = (value) => String(value).padStart(2, "0");

// วันที่ (YYYY-MM-DD) ตามเวลาท้องถิ่น — รับได้ทั้งสตริงจาก API และ Date
export function localDateKey(value) {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayKey(now = new Date()) {
  return localDateKey(now);
}

export function shiftDateKey(key, days) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d + days);
  return localDateKey(date);
}

export function clampDateKey(key, min, max) {
  if (min && key < min) return min;
  if (max && key > max) return max;
  return key;
}

export function villageName(record) {
  const name = record?.village || record?.villname || "";
  return String(name).trim();
}

export function recordsOnDate(records, dateKey) {
  return (records || []).filter((record) => localDateKey(record.flood_start_date) === dateKey);
}

// หาข้อมูลของหมู่บ้านในวันเดียวกัน (ใช้เตือนก่อนบันทึกซ้ำ)
export function findDayRecord(records, { date, district, tambon, village }) {
  return (records || []).find((record) =>
    localDateKey(record.flood_start_date) === date &&
    record.district === district &&
    record.tambon === tambon &&
    villageName(record) === village
  ) || null;
}

// รายชื่อหมู่บ้าน (ไม่ซ้ำ) ของตำบลจากชั้นข้อมูลขอบเขตหมู่บ้าน
export function villagesOf(polygons, district, tambon) {
  const seen = new Map();
  for (const polygon of polygons || []) {
    if (polygon.distname !== district || polygon.subdistnam !== tambon) continue;
    const name = String(polygon.villname || "").trim();
    if (name && !seen.has(name)) seen.set(name, polygon);
  }
  return [...seen.values()];
}

// ความครบของการบันทึกรายตำบลในวันที่เลือก
export function buildTambonCoverage({ districts, polygons, records, date }) {
  const dayRecords = recordsOnDate(records, date);
  const rows = [];
  for (const district of districts || []) {
    for (const tambon of district.tambons || []) {
      const total = villagesOf(polygons, district.name, tambon.name).length;
      if (!total) continue;
      const recorded = new Set(
        dayRecords.filter((record) => record.district === district.name && record.tambon === tambon.name).map(villageName).filter(Boolean)
      ).size;
      rows.push({
        key: `${district.name}-${tambon.name}`,
        district: district.name,
        tambon: tambon.name,
        total,
        recorded: Math.min(recorded, total),
        status: recorded >= total ? "complete" : recorded > 0 ? "partial" : "empty"
      });
    }
  }
  return rows;
}

export function summarizeCoverage(rows) {
  const count = (status) => rows.filter((row) => row.status === status).length;
  const villages = rows.reduce((sum, row) => sum + row.total, 0);
  const recorded = rows.reduce((sum, row) => sum + row.recorded, 0);
  return {
    complete: count("complete"),
    partial: count("partial"),
    empty: count("empty"),
    tambons: rows.length,
    villages,
    recorded,
    percent: villages ? Math.round((recorded / villages) * 100) : 0
  };
}

// ตัวเลขรวมของวันที่เลือก
export function summarizeDay(records) {
  const affected = records.filter((record) => record.flood_level && record.flood_level !== "ไม่มี");
  return {
    villages: affected.length,
    severe: records.filter((record) => ["สูง", "สูงมาก"].includes(record.flood_level)).length,
    households: affected.reduce((sum, record) => sum + (Number(record.affected_households) || 0), 0),
    people: affected.reduce((sum, record) => sum + (Number(record.affected_people) || 0), 0)
  };
}

export const EMPTY_FORM = {
  district: "",
  tambon: "",
  village: "",
  flood_level: "ไม่มี",
  flood_start_date: "",
  water_depth_cm: "",
  affected_area_sqm: "",
  affected_households: "",
  affected_people: "",
  description: ""
};

function toCount(value) {
  if (value === "" || value === null || value === undefined) return 0;
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? Math.round(number) : NaN;
}

// ตรวจฟอร์มก่อนส่ง คืน { ok, errors, value }
export function validateRecordForm(form, { tambonMode = false } = {}) {
  const errors = {};
  if (!form.district) errors.district = "เลือกอำเภอ";
  if (!form.tambon) errors.tambon = "เลือกตำบล";
  if (!tambonMode && !form.village) errors.village = "เลือกหมู่บ้าน";
  if (!form.flood_start_date) errors.flood_start_date = "ระบุวันที่";
  const households = toCount(form.affected_households);
  const people = toCount(form.affected_people);
  if (Number.isNaN(households)) errors.affected_households = "ใส่ตัวเลข 0 ขึ้นไป";
  if (Number.isNaN(people)) errors.affected_people = "ใส่ตัวเลข 0 ขึ้นไป";
  if (!Number.isNaN(households) && !Number.isNaN(people) && people > 0 && households > people) {
    errors.affected_households = "ครัวเรือนมากกว่าจำนวนคนไม่ได้";
  }
  const depth = form.water_depth_cm === "" ? null : Number(form.water_depth_cm);
  if (depth !== null && (!Number.isFinite(depth) || depth < 0 || depth > 1000)) errors.water_depth_cm = "0–1000 ซม.";
  const area = form.affected_area_sqm === "" ? null : Number(form.affected_area_sqm);
  if (area !== null && (!Number.isFinite(area) || area < 0)) errors.affected_area_sqm = "ใส่ตัวเลข 0 ขึ้นไป";
  if (Object.keys(errors).length) return { ok: false, errors };
  return {
    ok: true,
    errors: {},
    value: {
      ...form,
      water_depth_cm: depth,
      affected_area_sqm: area,
      affected_households: households,
      affected_people: people,
      description: String(form.description || "").trim()
    }
  };
}
