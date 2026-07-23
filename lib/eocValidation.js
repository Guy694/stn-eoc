export const MISSION_STATUSES = [
  "intake",
  "assigned",
  "in_progress",
  "blocked",
  "completed",
  "verified",
  "closed",
];

const MISSION_TRANSITIONS = {
  intake: ["assigned"],
  assigned: ["in_progress", "blocked"],
  in_progress: ["blocked", "completed"],
  blocked: ["assigned", "in_progress"],
  completed: ["in_progress", "verified"],
  verified: ["completed", "closed"],
  closed: [],
};

export function parsePositiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function parseNonNegativeInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : null;
}

export function validatePopulationInput(input) {
  const male = parseNonNegativeInteger(input.male_population);
  const female = parseNonNegativeInteger(input.female_population);
  const year = input.population_year === null || input.population_year === ""
    ? null
    : Number(input.population_year);
  if (male === null || female === null) return { ok: false, message: "จำนวนประชากรต้องเป็นจำนวนเต็มตั้งแต่ 0 ขึ้นไป" };
  if (!["thai", "all"].includes(input.population_scope)) return { ok: false, message: "ขอบเขตประชากรไม่ถูกต้อง" };
  if (year !== null && (!Number.isInteger(year) || year < 1900 || year > 2600)) return { ok: false, message: "ปีข้อมูลไม่ถูกต้อง" };
  if (!String(input.province_code || "").trim() || !String(input.district_name || "").trim() || !String(input.source_name || "").trim()) {
    return { ok: false, message: "กรุณาระบุจังหวัด อำเภอ และแหล่งข้อมูล" };
  }
  return {
    ok: true,
    value: {
      province_code: String(input.province_code).trim(),
      district_code: String(input.district_code || "").trim() || null,
      district_name: String(input.district_name).trim(),
      male_population: male,
      female_population: female,
      population: male + female,
      population_year: year,
      population_scope: input.population_scope,
      source_name: String(input.source_name).trim(),
      source_updated_at: input.source_updated_at || null,
      notes: String(input.notes || "").trim() || null,
    },
  };
}

export function canCalculateRate({ numerator, population, numeratorScope, populationScope }) {
  if (!Number.isFinite(Number(numerator)) || Number(numerator) < 0) return { ok: false, warning: "ข้อมูลตัวตั้งไม่ถูกต้อง" };
  if (!Number.isFinite(Number(population)) || Number(population) <= 0) return { ok: false, warning: "ไม่มีประชากรสำหรับคำนวณอัตราต่อแสน" };
  if (!numeratorScope || !populationScope || numeratorScope !== populationScope) {
    return { ok: false, warning: "ขอบเขตประชากรไม่ตรงกับข้อมูลผู้ป่วย" };
  }
  return { ok: true, rate: (Number(numerator) / Number(population)) * 100000, warning: null };
}

export function validateMissionTransition(fromStatus, toStatus) {
  if (!MISSION_STATUSES.includes(fromStatus) || !MISSION_STATUSES.includes(toStatus)) return false;
  return fromStatus === toStatus || MISSION_TRANSITIONS[fromStatus].includes(toStatus);
}

export function validateMissionInput(input, { partial = false } = {}) {
  const progress = input.progress_percent === undefined && partial
    ? undefined
    : Number(input.progress_percent ?? 0);
  if (progress !== undefined && (!Number.isInteger(progress) || progress < 0 || progress > 100)) {
    return { ok: false, message: "ความคืบหน้าต้องอยู่ระหว่าง 0–100" };
  }
  if (!partial && (!String(input.mission_code || "").trim() || !String(input.mission_type || "").trim() || !String(input.mission_name || "").trim())) {
    return { ok: false, message: "กรุณาระบุรหัส ประเภท และชื่อภารกิจ" };
  }
  if (input.status !== undefined && !MISSION_STATUSES.includes(input.status)) return { ok: false, message: "สถานะภารกิจไม่ถูกต้อง" };
  return { ok: true, progress };
}

