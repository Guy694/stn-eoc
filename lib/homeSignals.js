// ตัวช่วยของหน้าแรก (ไม่มีการเรียกเครือข่ายในไฟล์นี้)
import { situationMeta } from "@/lib/thaiWater";

const STATE = {
  overflow: { label: "ล้นตลิ่ง", tone: "#dc2626", soft: "#fee2e2", rank: 3 },
  near: { label: "ใกล้ตลิ่ง", tone: "#d97706", soft: "#fef3c7", rank: 2 },
  normal: { label: "ต่ำกว่าตลิ่ง", tone: "#15803d", soft: "#dcfce7", rank: 1 },
  unknown: { label: "ไม่มีข้อมูลตลิ่ง", tone: "#64748b", soft: "#e2e8f0", rank: 0 }
};

/** สถานะคลองของสถานีหนึ่ง: ระยะจากตลิ่ง + ความสูงของน้ำในเกจ (% ความจุลำน้ำ) */
export function canalState(station) {
  const diff = Number(station?.bankDiff);
  const key = !Number.isFinite(diff) ? "unknown" : diff >= 0 ? "overflow" : diff > -0.5 ? "near" : "normal";
  const percent = Number(station?.storagePercent);
  const situation = situationMeta(station?.situationLevel);
  return {
    key,
    ...STATE[key],
    diff: Number.isFinite(diff) ? diff : null,
    // เกจวาดถึง 120% เพื่อให้เห็นส่วนที่ล้นเหนือเส้นตลิ่ง (100%)
    fill: Number.isFinite(percent) ? Math.max(4, Math.min(120, percent)) / 120 : null,
    color: situation?.color || STATE[key].tone,
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
  const counts = { overflow: 0, near: 0 };
  for (const station of stations) {
    const { key } = canalState(station);
    if (key in counts) counts[key] += 1;
  }
  if (counts.overflow) return `น้ำล้นตลิ่ง ${counts.overflow} สถานี${counts.near ? ` และใกล้ตลิ่งอีก ${counts.near} สถานี` : ""}`;
  if (counts.near) return `น้ำใกล้ตลิ่ง ${counts.near} สถานี จาก ${stations.length} สถานี`;
  return `ทุกสถานีต่ำกว่าตลิ่ง (${stations.length} สถานี)`;
}

const ROAD_CATEGORIES = new Set(["road_cut", "tree_down", "landslide"]);
const BLOCKED_TRAVEL = new Set(["impassable", "difficult"]);

/** จุดที่เจ้าหน้าที่ยืนยันและเผยแพร่แล้วว่าถนนผ่านไม่ได้/ผ่านยาก */
export function roadAlerts(incidents = [], limit = 5) {
  return incidents
    .filter((item) => ROAD_CATEGORIES.has(item.problem_category) || BLOCKED_TRAVEL.has(item.travel_status))
    .map((item) => ({
      id: item.id,
      title: item.public_title || (item.travel_status === "impassable" ? "ถนนผ่านไม่ได้" : "ถนนผ่านยาก"),
      detail: item.public_detail || null,
      area: [item.village, item.sub_district && `ต.${item.sub_district}`, item.district && `อ.${item.district}`].filter(Boolean).join(" "),
      blocked: item.travel_status === "impassable" || item.problem_category === "road_cut" || item.problem_category === "landslide",
      at: item.published_at || item.reviewed_at || item.occurred_at || null,
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
