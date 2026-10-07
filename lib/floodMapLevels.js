import { WATER_LEVELS } from "@/lib/waterReport";

export const FLOOD_LEVEL_LEGEND = WATER_LEVELS.map((level) => ({
  ...level,
  description: `${level.label} (${level.range})`
}));

const LEGACY_LEVELS = {
  mild: { label: "ระดับประเมินเดิม: ต่ำ (ไม่มีค่าความลึก)", color: WATER_LEVELS[1].color },
  moderate: { label: "ระดับประเมินเดิม: ปานกลาง (ไม่มีค่าความลึก)", color: WATER_LEVELS[2].color },
  severe: { label: "ระดับประเมินเดิม: สูง/สูงมาก (ไม่มีค่าความลึก)", color: WATER_LEVELS[3].color }
};

export const LEGACY_FLOOD_LEVELS = {
  severe: LEGACY_LEVELS.severe,
  moderate: LEGACY_LEVELS.moderate,
  mild: LEGACY_LEVELS.mild,
  safe: { label: "ไม่มีน้ำท่วมตามบันทึกพื้นที่", color: WATER_LEVELS[0].color },
  nodata: { label: "ไม่มีข้อมูลระดับน้ำ", color: "#94a3b8" }
};

export function waterLevelFromCm(depthCm) {
  const depth = Number(depthCm);
  if (!Number.isFinite(depth) || depth < 0) return null;
  if (depth < 10) return WATER_LEVELS[0];
  if (depth < 50) return WATER_LEVELS[1];
  if (depth < 100) return WATER_LEVELS[2];
  if (depth < 130) return WATER_LEVELS[3];
  if (depth <= 180) return WATER_LEVELS[4];
  return WATER_LEVELS[5];
}

export function floodAreaMapMeta(area) {
  const rawLevel = String(area?.flood_level || "").trim();
  const category = ({ "ไม่มี": "safe", "ต่ำ": "mild", "ปานกลาง": "moderate", "สูง": "severe", "สูงมาก": "severe" })[rawLevel] || rawLevel;
  if (category === "safe") {
    return { ...WATER_LEVELS[0], description: "ไม่มีน้ำท่วมตามบันทึกพื้นที่", source: "status" };
  }
  const depth = Number(area?.water_level);
  if (Number.isFinite(depth) && depth > 0) {
    const level = waterLevelFromCm(depth * 100);
    return { ...level, description: `${level.label} (${level.range})`, source: "depth" };
  }
  const legacy = LEGACY_LEVELS[category];
  return legacy
    ? { ...legacy, description: legacy.label, source: "legacy" }
    : { label: "ไม่มีข้อมูลระดับน้ำ", description: "ไม่มีข้อมูลระดับน้ำ", color: "#94a3b8", source: "unknown" };
}
