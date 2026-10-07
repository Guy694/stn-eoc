// แสดงรายงานระดับน้ำจากประชาชน (ที่เจ้าหน้าที่เผยแพร่แล้ว) บนแผนที่: สีตามระดับ จางลงตามเวลา ขอบประเมื่อมีคนแจ้งว่าน้ำลด
import { waterLevelMeta, waterTrendMeta } from "@/lib/waterReport";

export const FRESH_HOURS = 12;
export const AGING_HOURS = 24;

const TRAVEL_TEXT = {
  passable: "รถเก๋ง/กระบะผ่านได้",
  difficult: "เฉพาะรถสูง",
  impassable: "เรือเท่านั้น"
};

export function isWaterReport(incident) {
  return incident?.report_type === "problem_point" && Boolean(waterLevelMeta(incident.water_level));
}

function toTime(value) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) ? time : null;
}

// ข้อมูลล่าสุดของจุดนี้ = เวลาที่รายงาน หรือเวลาที่มีคนกด "ยังท่วมอยู่" ครั้งล่าสุด (อันที่ใหม่กว่า)
export function latestEvidenceAt(incident) {
  const times = [incident?.occurred_at, incident?.confirmations?.still_at].map(toTime).filter((value) => value !== null);
  return times.length ? Math.max(...times) : null;
}

export function hoursAgo(time, now = Date.now()) {
  return time === null ? null : Math.max(0, (now - time) / 3600000);
}

export function timeAgoText(value, now = Date.now()) {
  const time = toTime(value);
  if (time === null) return "";
  const minutes = Math.max(0, Math.round((now - time) / 60000));
  if (minutes < 60) return `${minutes} นาทีก่อน`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ชม.${minutes % 60 ? ` ${minutes % 60} น.` : ""}ก่อน`;
  const days = Math.floor(hours / 24);
  return `${days} วัน${hours % 24 ? ` ${hours % 24} ชม.` : ""}ก่อน`;
}

/** สไตล์วงกลมบนแผนที่ */
export function waterReportStyle(incident, now = Date.now()) {
  const level = waterLevelMeta(incident?.water_level);
  const age = hoursAgo(latestEvidenceAt(incident), now);
  const opacity = age === null || age > AGING_HOURS ? 0.3 : age > FRESH_HOURS ? 0.55 : 0.9;
  const still = Number(incident?.confirmations?.still || 0);
  const normal = Number(incident?.confirmations?.normal || 0);
  // คนแจ้งว่าน้ำลดมากกว่าคนยืนยันว่ายังท่วม → ขอบประ ให้รู้ว่าอาจไม่เป็นปัจจุบัน
  const receding = normal > 0 && normal >= still;
  const deep = level && ["waist_chest", "chest_up", "over_head"].includes(level.value);
  return {
    radius: deep ? 11 : 9,
    color: receding ? "#475569" : "#ffffff",
    weight: receding ? 2.5 : 2,
    dashArray: receding ? "4 3" : null,
    fillColor: level?.color || "#64748b",
    fillOpacity: opacity,
    opacity: Math.min(1, opacity + 0.2),
    receding,
    ageHours: age
  };
}

export function travelText(incident) {
  return TRAVEL_TEXT[incident?.travel_status] || "";
}

export function waterReportSummary(incident) {
  const level = waterLevelMeta(incident?.water_level);
  const trend = waterTrendMeta(incident?.water_trend);
  return {
    level,
    trend,
    travel: travelText(incident)
  };
}
