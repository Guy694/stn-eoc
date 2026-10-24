// ความสดของข้อมูลบนหน้าสาธารณะ: เกินเวลาที่กำหนด = "ล่าช้า" (การ์ดเป็นสีเทา + บอกเวลาล่าสุด)
// ไม่มีการเรียกเครือข่ายในไฟล์นี้

/** นาทีสูงสุดที่ยังถือว่าสด แยกตามชนิดข้อมูล (สถานีโทรมาตรส่งทุก 10–60 นาที) */
export const FRESHNESS_LIMIT_MINUTES = {
  water: 120, // ระดับน้ำในคลอง ThaiWater
  rain: 120, // ฝนที่วัดได้ ThaiWater
  sea: 180, // ระดับน้ำทะเลที่วัดได้จริง
  forecast: 12 * 60 // พยากรณ์ (ออกรอบละ 6–12 ชม.)
};

const BANGKOK = "Asia/Bangkok";

function dayKey(ms) {
  return new Date(ms).toLocaleDateString("en-CA", { timeZone: BANGKOK });
}

function clockText(ms) {
  return new Date(ms).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: BANGKOK });
}

function ageText(minutes) {
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} ชม.`;
  return `${Math.floor(hours / 24)} วัน`;
}

/**
 * @param {string|number|Date|null} at เวลาของข้อมูล
 * @param {keyof FRESHNESS_LIMIT_MINUTES} kind
 * @returns {{ known: boolean, stale: boolean, ageMinutes: number|null, time: string, label: string }}
 */
export function freshness(at, kind = "water", now = Date.now()) {
  const ms = at instanceof Date ? at.getTime() : typeof at === "number" ? at : Date.parse(at || "");
  if (!Number.isFinite(ms) || ms <= 0) return { known: false, stale: false, ageMinutes: null, time: "", label: "" };
  const ageMinutes = Math.max(0, Math.round((now - ms) / 60000));
  const limit = FRESHNESS_LIMIT_MINUTES[kind] ?? FRESHNESS_LIMIT_MINUTES.water;
  const stale = ageMinutes > limit;
  const sameDay = dayKey(ms) === dayKey(now);
  const time = sameDay
    ? `${clockText(ms)} น.`
    : `${new Date(ms).toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: BANGKOK })} ${clockText(ms)} น.`;
  return {
    known: true,
    stale,
    ageMinutes,
    time,
    label: stale ? `ข้อมูลล่าสุด ${time} • ล่าช้า ${ageText(ageMinutes)}` : `อัปเดต ${time}`
  };
}

/** เวลาล่าสุดจากรายการ (ISO) */
export function latestTime(values = []) {
  let best = null;
  for (const value of values) {
    const ms = Date.parse(value || "");
    if (Number.isFinite(ms) && (best === null || ms > best)) best = ms;
  }
  return best;
}
