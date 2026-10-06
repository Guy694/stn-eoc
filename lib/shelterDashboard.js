// สรุปศูนย์พักพิงในเหตุการณ์สำหรับ dashboard (ไม่แตะฐานข้อมูล ทดสอบได้)

export const NEAR_FULL_RATIO = 0.8;
export const STALE_HOURS = 12;

const n = (value) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};
const isActive = (row) => Number(row.is_activated_for_session) === 1;

export const SHELTER_GROUPS = [
  { key: "occupancy_child_0_5", label: "เด็ก 0–5 ปี" },
  { key: "occupancy_child_6_17", label: "เด็ก 6–17 ปี" },
  { key: "occupancy_elderly_60_plus", label: "ผู้สูงอายุ 60+" },
  { key: "occupancy_disabled", label: "ผู้พิการ" },
  { key: "occupancy_bedridden", label: "ติดเตียง" }
];

export function occupancyLevel(row) {
  const capacity = n(row.shelter_capacity);
  const occupancy = n(row.session_occupancy);
  if (!capacity) return "unknown";
  const ratio = occupancy / capacity;
  if (ratio >= 1) return "full";
  if (ratio >= NEAR_FULL_RATIO) return "near";
  return "ok";
}

export function hoursSince(value, now = Date.now()) {
  if (!value) return null;
  const time = new Date(String(value).replace(" ", "T")).getTime();
  return Number.isFinite(time) ? (now - time) / 3600000 : null;
}

/**
 * rows: ผลจาก /api/eoc/shelter-activations (ทุกศูนย์ + สถานะในเหตุการณ์)
 * health: { by_shelter: { [id]: {...} }, by_disease: [], totals: {} }
 */
export function summarizeShelters(rows = [], health = {}, now = Date.now()) {
  const active = rows.filter(isActive);
  const byShelter = health.by_shelter || {};
  const capacity = active.reduce((sum, row) => sum + n(row.shelter_capacity), 0);
  const occupancy = active.reduce((sum, row) => sum + n(row.session_occupancy), 0);

  const districts = new Map();
  for (const row of active) {
    const key = row.district_name || "ไม่ระบุอำเภอ";
    if (!districts.has(key)) districts.set(key, { district: key, shelters: 0, capacity: 0, occupancy: 0, full: 0, nearFull: 0 });
    const entry = districts.get(key);
    entry.shelters += 1;
    entry.capacity += n(row.shelter_capacity);
    entry.occupancy += n(row.session_occupancy);
    if (occupancyLevel(row) === "full") entry.full += 1;
    else if (occupancyLevel(row) === "near") entry.nearFull += 1;
  }

  const attention = [];
  for (const row of active) {
    const reasons = [];
    const level = occupancyLevel(row);
    if (level === "full") reasons.push({ tone: "red", text: "เต็ม/เกินความจุ" });
    else if (level === "near") reasons.push({ tone: "amber", text: "ใกล้เต็ม" });
    const age = hoursSince(row.activation_updated_at || row.activated_at, now);
    if (age !== null && age > STALE_HOURS) reasons.push({ tone: "gray", text: `ไม่อัปเดตยอด ${Math.floor(age)} ชม.` });
    const sick = byShelter[row.id];
    if (sick && (sick.severity === "high" || sick.severity === "critical")) reasons.push({ tone: "red", text: "มีผู้ป่วยอาการรุนแรง" });
    else if (sick?.today_new_cases) reasons.push({ tone: "amber", text: `ผู้ป่วยใหม่วันนี้ ${sick.today_new_cases} ราย` });
    if (!row.coordinator_phone && !row.contact_phone) reasons.push({ tone: "gray", text: "ไม่มีเบอร์ติดต่อ" });
    if (reasons.length) {
      const weight = reasons.reduce((sum, reason) => sum + (reason.tone === "red" ? 3 : reason.tone === "amber" ? 2 : 1), 0);
      attention.push({ id: row.id, name: row.sheltername, district: row.district_name, reasons, weight });
    }
  }
  attention.sort((a, b) => b.weight - a.weight || String(a.name).localeCompare(String(b.name), "th"));

  const groups = SHELTER_GROUPS.map((group) => ({ ...group, value: active.reduce((sum, row) => sum + n(row[group.key]), 0) }));

  return {
    registered: rows.length,
    activeCount: active.length,
    capacity,
    occupancy,
    free: Math.max(capacity - occupancy, 0),
    usePercent: capacity ? Math.round((occupancy / capacity) * 100) : 0,
    full: active.filter((row) => occupancyLevel(row) === "full").length,
    nearFull: active.filter((row) => occupancyLevel(row) === "near").length,
    stale: active.filter((row) => { const age = hoursSince(row.activation_updated_at || row.activated_at, now); return age !== null && age > STALE_HOURS; }).length,
    districts: [...districts.values()]
      .map((entry) => ({ ...entry, free: Math.max(entry.capacity - entry.occupancy, 0), usePercent: entry.capacity ? Math.round((entry.occupancy / entry.capacity) * 100) : 0 }))
      .sort((a, b) => b.usePercent - a.usePercent || b.occupancy - a.occupancy),
    attention: attention.slice(0, 10),
    groups,
    hasGroupData: groups.some((group) => group.value > 0),
    health: {
      totals: { new_cases: 0, hospitalized: 0, deaths: 0, today_new_cases: 0, latest_report_date: null, ...(health.totals || {}) },
      byDisease: health.by_disease || [],
      sheltersWithCases: Object.values(byShelter).filter((item) => item.new_cases > 0).length
    }
  };
}
