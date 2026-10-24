// ตัวช่วยของหน้าแรก (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
import { situationMeta } from "@/lib/thaiWater";
import { waterLevelMeta, waterTrendMeta } from "@/lib/waterReport";

// สีของคลอง: แดง = ใกล้/ล้นตลิ่ง · ส้ม = น้ำค่อนข้างสูง · เขียว = ปกติ · น้ำเงิน = เกือบแห้ง
const STATE = {
  overflow: { label: "ล้นตลิ่ง", tone: "#dc2626", soft: "#fee2e2", rank: 4 },
  near: { label: "ใกล้ตลิ่ง", tone: "#dc2626", soft: "#fee2e2", rank: 3 },
  high: { label: "น้ำค่อนข้างสูง", tone: "#ea580c", soft: "#ffedd5", rank: 2 },
  normal: { label: "ต่ำกว่าตลิ่ง", tone: "#16a34a", soft: "#dcfce7", rank: 1 },
  low: { label: "น้ำน้อยมาก", tone: "#2563eb", soft: "#dbeafe", rank: 1 },
  unknown: { label: "ไม่มีข้อมูลตลิ่ง", tone: "#64748b", soft: "#e2e8f0", rank: 0 }
};

// เกณฑ์ (ม. จากตลิ่ง / % ความจุลำน้ำแบบ ThaiWater)
export const CANAL_NEAR_BANK_M = -0.5;
export const CANAL_HIGH_BANK_M = -1.0;
export const CANAL_HIGH_PERCENT = 70;
export const CANAL_LOW_PERCENT = 10;

function canalKey(diff, percent) {
  const hasDiff = Number.isFinite(diff);
  const hasPercent = Number.isFinite(percent);
  if ((hasDiff && diff >= 0) || (hasPercent && percent > 100)) return "overflow";
  if (hasDiff && diff > CANAL_NEAR_BANK_M) return "near";
  if ((hasPercent && percent > CANAL_HIGH_PERCENT) || (hasDiff && diff > CANAL_HIGH_BANK_M)) return "high";
  if (hasPercent && percent <= CANAL_LOW_PERCENT) return "low";
  return hasDiff || hasPercent ? "normal" : "unknown";
}

/** สถานะคลองของสถานีหนึ่ง: ระยะจากตลิ่ง + ความสูงของน้ำในเกจ (% ความจุลำน้ำ) */
export function canalState(station) {
  const raw = station?.bankDiff;
  const diff = raw === null || raw === undefined || raw === "" ? NaN : Number(raw);
  const rawPercent = station?.storagePercent;
  const percent = rawPercent === null || rawPercent === undefined || rawPercent === "" ? NaN : Number(rawPercent);
  const key = canalKey(diff, percent);
  const situation = situationMeta(station?.situationLevel);
  return {
    key,
    ...STATE[key],
    diff: Number.isFinite(diff) ? diff : null,
    // เกจวาดถึง 120% เพื่อให้เห็นส่วนที่ล้นเหนือเส้นตลิ่ง (100%)
    fill: Number.isFinite(percent) ? Math.max(4, Math.min(120, percent)) / 120 : null,
    color: STATE[key].tone,
    situationLabel: situation?.label || null
  };
}

export function sortCanals(stations = []) {
  return [...stations].sort((a, b) => {
    const sa = canalState(a);
    const sb = canalState(b);
    return sb.rank - sa.rank || (sb.diff ?? -99) - (sa.diff ?? -99);
  });
}

/** ประโยคสรุปสถานีทั้งหมด */
export function canalSummary(stations = []) {
  if (stations.length === 0) return "ยังไม่มีข้อมูลจากสถานีวัดระดับน้ำ";
  const counts = { overflow: 0, near: 0, high: 0 };
  for (const station of stations) {
    const { key } = canalState(station);
    if (key in counts) counts[key] += 1;
  }
  if (counts.overflow) return `น้ำล้นตลิ่ง ${counts.overflow} สถานี${counts.near ? ` และใกล้ตลิ่งอีก ${counts.near} สถานี` : ""}`;
  if (counts.near) return `น้ำใกล้ตลิ่ง ${counts.near} สถานี จาก ${stations.length} สถานี`;
  if (counts.high) return `น้ำค่อนข้างสูง ${counts.high} สถานี จาก ${stations.length} สถานี`;
  return `ทุกสถานีต่ำกว่าตลิ่ง (${stations.length} สถานี)`;
}

const ROAD_CATEGORIES = new Set(["road_cut", "tree_down", "landslide"]);
const BLOCKED_TRAVEL = new Set(["impassable", "difficult"]);

/** จุดที่เจ้าหน้าที่ยืนยันและเผยแพร่แล้วว่าถนนผ่านไม่ได้/ผ่านยาก */
export function roadAlerts(incidents = [], limit = 5) {
  return incidents
    // รายงานระดับน้ำแสดงในการ์ด "รายงานน้ำจากประชาชน" แล้ว ไม่ซ้ำในรายการถนน
    .filter((item) => !isWaterReport(item))
    .filter((item) => ROAD_CATEGORIES.has(item.problem_category) || BLOCKED_TRAVEL.has(item.travel_status))
    .map((item) => ({
      id: item.id,
      // API สาธารณะส่ง title/detail (หัวข้อที่เจ้าหน้าที่เขียน) — public_title คงไว้เผื่อข้อมูลรูปแบบเดิม
      title: item.title || item.public_title || (item.travel_status === "impassable" ? "ถนนผ่านไม่ได้" : "ถนนผ่านยาก"),
      detail: item.detail || item.public_detail || null,
      area: [item.village, item.sub_district && `ต.${item.sub_district}`, item.district && `อ.${item.district}`].filter(Boolean).join(" "),
      blocked: item.travel_status === "impassable" || item.problem_category === "road_cut" || item.problem_category === "landslide",
      at: item.verified_at || item.published_at || item.reviewed_at || item.occurred_at || null,
      lat: Number(item.latitude),
      lng: Number(item.longitude)
    }))
    .sort((a, b) => Number(b.blocked) - Number(a.blocked) || new Date(b.at || 0) - new Date(a.at || 0))
    .slice(0, limit);
}

/** สรุปศูนย์พักพิงที่เปิด: จำนวนศูนย์ ที่ว่างรวม และศูนย์ที่ยังรับได้ */
export function shelterSummary(shelters = []) {
  const open = shelters.length;
  const vacancy = shelters.reduce((sum, item) => sum + Math.max(0, Number(item.vacancy) || 0), 0);
  const full = shelters.filter((item) => item.occupancy_status === "full").length;
  return { open, vacancy, full };
}

/** รายงานระดับน้ำจากประชาชน = จุดน้ำท่วมที่มีระดับน้ำแบบเทียบร่างกาย */
export function isWaterReport(item) {
  return Boolean(waterLevelMeta(item?.water_level)) && (!item.problem_category || item.problem_category === "flood");
}

/**
 * การ์ด "รายงานน้ำจากประชาชน" บนหน้าแรก — รับเฉพาะข้อมูลจาก API สาธารณะ (เจ้าหน้าที่ตรวจและเผยแพร่แล้ว)
 * เรียงล่าสุดก่อน, ระดับน้ำสูงขึ้นก่อนเมื่อเวลาใกล้กัน (ภายใน 1 ชม.)
 */
export function citizenWaterReports(incidents = [], limit = 6) {
  const HOUR = 60 * 60 * 1000;
  return incidents
    .filter(isWaterReport)
    .map((item) => {
      const level = waterLevelMeta(item.water_level);
      const trend = waterTrendMeta(item.water_trend);
      return {
        id: item.id,
        title: item.title || item.public_title || level.label,
        detail: item.detail || item.public_detail || null,
        area: [item.village, item.sub_district && `ต.${item.sub_district}`, item.district && `อ.${item.district}`].filter(Boolean).join(" "),
        level,
        trend,
        photo: item.photo_path || null,
        at: item.verified_at || item.published_at || item.occurred_at || null,
        stillCount: Number(item.confirmations?.still || 0),
        reportCount: Number(item.report_count || 1)
      };
    })
    .sort((a, b) => {
      const diff = new Date(b.at || 0) - new Date(a.at || 0);
      if (Math.abs(diff) > HOUR) return diff;
      return b.level.fill - a.level.fill || diff;
    })
    .slice(0, limit);
}
