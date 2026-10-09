// พยากรณ์จุดเสี่ยงน้ำท่วม 7 วันรายตำบล ฉบับประชาชน (ไม่มีการเรียกเครือข่าย ทดสอบได้)
// ตัดข้อมูลที่ไม่ควรเผยแพร่ออก: คะแนน/ความเปราะบาง จำนวนกลุ่มเปราะบาง รายชื่อหมู่บ้าน/ครัวเรือน
import { areaKey } from "@/lib/areaRisk";

const LEVELS = new Set(["normal", "watch", "high", "critical"]);
const RANK = { normal: 0, watch: 1, high: 2, critical: 3 };

function publicDay(day) {
  return {
    date: day.date,
    level: LEVELS.has(day.level) ? day.level : "normal",
    rain24: Math.round(Number(day.rain24) || 0),
    sea: day.sea || "normal",
    canal: day.canal || "normal",
    // เหตุผลเป็นข้อความสภาพแวดล้อม (ฝน/คลอง/น้ำทะเล) ไม่มีตัวเลขความเปราะบาง
    reasons: (day.factors || []).map((f) => String(f.label || "")).filter(Boolean).slice(0, 4)
  };
}

export function publicOutlookFor(forecast, district, tambon) {
  if (!forecast?.areas?.length) return null;
  const key = areaKey(district, tambon);
  const area = forecast.areas.find((a) => a.key === key);
  if (!area) return null;
  const days = (area.forecast?.days || []).map(publicDay);
  const worst = days.reduce((best, d) => (!best || RANK[d.level] > RANK[best.level] ? d : best), null);
  return {
    key: area.key,
    district: area.district,
    tambon: area.tambon,
    coastal: Boolean(area.coastal),
    riverine: Boolean(area.riverine),
    days,
    worst: worst && worst.level !== "normal" ? worst : null,
    calibrated: forecast.calibration?.source === "backtest"
  };
}

/** ภาพรวมทั้งจังหวัด: ระดับรายวันของแต่ละตำบล (สำหรับแผนที่/รายการ) */
export function publicOutlookSummary(forecast) {
  if (!forecast?.areas?.length) return null;
  return {
    dates: forecast.dates || [],
    areas: forecast.areas.map((a) => ({ key: a.key, district: a.district, tambon: a.tambon, levels: (a.forecast?.days || []).map((d) => (LEVELS.has(d.level) ? d.level : "normal")) }))
  };
}
