// ตัวช่วยแสดงผลของหน้าแนวโน้มน้ำและฝน (ไม่มี React — ทดสอบได้)
import { HEAVY_RAIN_MM } from "@/lib/hydroHistory";
import { rainCategory } from "@/lib/thaiWaterRain";

export const C = { navy: "#0b4c86", teal: "#2a9db0", deep: "#0c2f4a", red: "#dc2626", amber: "#d97706", grid: "#e2e8f0", muted: "#64748b", rain: "#38bdf8" };
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

export function dayLabel(date) {
  const [, m, d] = String(date).slice(0, 10).split("-");
  return `${Number(d)} ${TH_MONTH[Number(m) - 1] || ""}`;
}
/** ป้ายเวลาของจุดกราฟ: bucketHours 24 = รายวัน (ไม่แสดงเวลา) */
export function timeLabel(t, bucketHours = 1) {
  const text = String(t);
  return bucketHours >= 24 || text.length < 16 ? dayLabel(text) : `${dayLabel(text)} ${text.slice(11, 16)} น.`;
}
/** ตำแหน่งขีดแกนเวลา: เที่ยงคืนของแต่ละวัน (กราฟรายชั่วโมง/ราย 3 ชม.) — กราฟรายวันให้ recharts จัดเอง */
export function dayTicks(rows = [], bucketHours = 1) {
  if (bucketHours >= 24) return undefined;
  const ticks = rows.map((r) => r.t).filter((t) => String(t).slice(11, 13) === "00");
  return ticks.length ? ticks : undefined;
}
export const fmt = (value, digits = 1) => (value === null || value === undefined || !Number.isFinite(Number(value)) ? "–" : Number(value).toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
export const signed = (value, digits = 2) => (value === null || value === undefined ? "–" : `${value > 0 ? "+" : ""}${fmt(value, digits)}`);
export const bucketText = (hours) => (hours >= 24 ? "รายวัน" : hours > 1 ? `ราย ${hours} ชม.` : "รายชั่วโมง");

/** สถานะสถานีวัดระดับน้ำในช่วงที่เลือก */
export function waterTone(station) {
  if (station.hours_over_bank > 0) return { key: "over", color: "#dc2626", label: "ล้นตลิ่ง" };
  if (station.hours_near_bank > 0) return { key: "near", color: "#d97706", label: "ใกล้ตลิ่ง" };
  return { key: "ok", color: "#0b4c86", label: "ต่ำกว่าตลิ่ง" };
}

// ตัวชี้วัดที่ใช้ระบายสีอำเภอบนแผนที่
export const DISTRICT_METRICS = [
  { key: "max_day_mm", label: "ฝนสูงสุดต่อวัน", unit: "มม." },
  { key: "total_mm", label: "ฝนสะสม", unit: "มม." },
  { key: "heavy_days", label: "วันฝนหนัก", unit: "วัน" }
];
const SEQ_BLUES = ["#e0f2fe", "#bae6fd", "#7dd3fc", "#38bdf8", "#0284c7", "#075985"];
const HEAVY_DAY_STEPS = [
  { min: 0, color: "#cbd5e1", text: "#334155", label: "0" },
  { min: 1, color: "#fcd34d", text: "#1f2937", label: "1" },
  { min: 2, color: "#f59e0b", text: "#1f2937", label: "2–3" },
  { min: 4, color: "#dc2626", text: "#ffffff", label: "4+" }
];

/**
 * สีของอำเภอตามตัวชี้วัด — max_day_mm ใช้เกณฑ์ฝน 24 ชม. ของกรมอุตุฯ (สีเดียวกับแผนที่ประชาชน)
 * total_mm ไล่สีฟ้า 6 ขั้นเทียบค่าสูงสุดของช่วง · heavy_days เป็นขั้นจำนวนวัน
 */
export function districtFill(metric, value, maxValue = 0) {
  if (value === null || value === undefined) return { color: "#94a3b8", text: "#ffffff", missing: true };
  if (metric === "heavy_days") return [...HEAVY_DAY_STEPS].reverse().find((s) => value >= s.min) || HEAVY_DAY_STEPS[0];
  if (metric === "total_mm") {
    if (!(maxValue > 0)) return { color: SEQ_BLUES[0], text: "#0c4a6e" };
    const index = Math.min(SEQ_BLUES.length - 1, Math.floor((value / maxValue) * SEQ_BLUES.length));
    return { color: SEQ_BLUES[index], text: index >= 4 ? "#ffffff" : "#0c4a6e" };
  }
  const cat = rainCategory(value);
  return { color: cat.color, text: cat.text, label: cat.label };
}

/** รายการคำอธิบายสีของตัวชี้วัด */
export function districtLegend(metric, maxValue = 0) {
  if (metric === "heavy_days") return HEAVY_DAY_STEPS.map((s) => ({ color: s.color, label: `${s.label} วัน` }));
  if (metric === "total_mm") {
    if (!(maxValue > 0)) return [{ color: SEQ_BLUES[0], label: "0 มม." }];
    const step = maxValue / SEQ_BLUES.length;
    return SEQ_BLUES.map((color, i) => ({ color, label: i === SEQ_BLUES.length - 1 ? `≥ ${fmt(step * i, 0)}` : `${fmt(step * i, 0)}–${fmt(step * (i + 1), 0)}` }));
  }
  return [
    { color: "#cbd5e1", label: "ไม่มีฝน" }, { color: "#7dd3fc", label: "0.1–10" }, { color: "#2563eb", label: "10.1–35" },
    { color: "#f59e0b", label: "35.1–90" }, { color: "#dc2626", label: "> 90" }
  ];
}

export const isHeavyDay = (mm) => (mm ?? 0) >= HEAVY_RAIN_MM;

/** รวมระดับน้ำของสถานีกับฝนเฉลี่ยของอำเภอ (จุดเวลาเดียวกัน) สำหรับกราฟซ้อน */
export function mergeLevelAndRain(series = [], rain = []) {
  const map = new Map();
  for (const p of series) map.set(p.t, { t: p.t, level: p.level });
  for (const p of rain) map.set(p.t, { ...(map.get(p.t) || { t: p.t }), rain: p.mm });
  return [...map.values()].sort((a, b) => a.t.localeCompare(b.t));
}

/** ระดับน้ำเทียบตลิ่งของหลายสถานีบนแกนเวลาเดียวกัน → [{ t, [code]: level − bank }] */
export function bankDiffSeries(stations = []) {
  const map = new Map();
  for (const s of stations) {
    if (s.bank === null || s.bank === undefined) continue;
    for (const p of s.series || []) {
      if (!Number.isFinite(p.level)) continue;
      const row = map.get(p.t) || { t: p.t };
      row[s.code] = Math.round((p.level - s.bank) * 100) / 100;
      map.set(p.t, row);
    }
  }
  return [...map.values()].sort((a, b) => a.t.localeCompare(b.t));
}

export const LINE_COLORS = ["#0b4c86", "#dc2626", "#16a34a", "#d97706", "#7c3aed", "#0891b2", "#db2777", "#65a30d", "#475569", "#b45309", "#4338ca", "#0f766e"];

/** เรียงตาราง: ค่าว่างอยู่ท้ายเสมอ */
export function sortRows(rows = [], key, dir = "desc") {
  const sign = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    const x = a[key];
    const y = b[key];
    const xn = x === null || x === undefined || x === "";
    const yn = y === null || y === undefined || y === "";
    if (xn || yn) return xn === yn ? 0 : xn ? 1 : -1;
    return typeof x === "number" && typeof y === "number" ? (x - y) * sign : String(x).localeCompare(String(y), "th") * sign;
  });
}
