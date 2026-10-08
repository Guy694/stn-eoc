// ฝุ่น PM2.5 จาก GISTDA (pm25.gistda.or.th) — ไฟล์นี้ไม่มีการเรียกเครือข่าย ใช้ได้ทั้งฝั่ง API และหน้าเว็บ
//
// เกณฑ์สีตามดัชนีคุณภาพอากาศของกรมควบคุมมลพิษ (ค่า PM2.5 เฉลี่ย 24 ชม. หน่วย µg/m³, ปรับปรุง 1 มิ.ย. 2566)
// GISTDA ใช้เกณฑ์เดียวกันระบายสีค่ารายชั่วโมงบนเว็บของตน หน้าเราจึงใช้เกณฑ์นี้กับทั้งสองค่า

export const PM25_LEVELS = [
  {
    key: "very_good",
    max: 15,
    label: "ดีมาก",
    color: "#3bb4e5",
    text: "#0b4c86",
    advice: "อากาศดีมาก ทำกิจกรรมกลางแจ้งได้ตามปกติ"
  },
  {
    key: "good",
    max: 25,
    label: "ดี",
    color: "#4fbf6a",
    text: "#14532d",
    advice: "อากาศดี ทำกิจกรรมกลางแจ้งได้ตามปกติ"
  },
  {
    key: "moderate",
    max: 37.5,
    label: "ปานกลาง",
    color: "#f2c94c",
    text: "#713f12",
    advice: "คนทั่วไปทำกิจกรรมได้ตามปกติ กลุ่มเสี่ยง (เด็ก ผู้สูงอายุ หญิงตั้งครรภ์ ผู้ป่วยโรคหัวใจและทางเดินหายใจ) ควรลดกิจกรรมกลางแจ้งที่ใช้แรงมาก"
  },
  {
    key: "unhealthy_sensitive",
    max: 75,
    label: "เริ่มมีผลต่อสุขภาพ",
    color: "#f2994a",
    text: "#7c2d12",
    advice: "ลดเวลาทำกิจกรรมกลางแจ้ง กลุ่มเสี่ยงควรสวมหน้ากากกันฝุ่น (N95) เมื่อออกนอกอาคาร หากไอ หายใจลำบาก หรือแน่นหน้าอก ให้ปรึกษาแพทย์"
  },
  {
    key: "unhealthy",
    max: Infinity,
    label: "มีผลต่อสุขภาพ",
    color: "#eb5757",
    text: "#7f1d1d",
    advice: "งดกิจกรรมกลางแจ้ง อยู่ในอาคารที่ปิดมิดชิด สวมหน้ากาก N95 หากต้องออกนอกอาคาร ผู้มีอาการผิดปกติให้รีบพบแพทย์ หรือโทร 1669"
  }
];

export const PM25_UNIT = "µg/m³";
export const SATUN_PROVINCE_ID = 91;

// Number(null) และ Number("") ได้ 0 ซึ่งจะกลายเป็น "อากาศดีมาก" — ค่าว่างต้องเป็น "ไม่มีข้อมูล"
function toNumber(value) {
  if (value === null || value === undefined || value === "") return NaN;
  return Number(value);
}

export function pm25Level(value) {
  const number = toNumber(value);
  if (!Number.isFinite(number) || number < 0) return null;
  return PM25_LEVELS.find((level) => number <= level.max) || PM25_LEVELS[PM25_LEVELS.length - 1];
}

export function roundPm(value) {
  const number = toNumber(value);
  return Number.isFinite(number) ? Math.round(number * 10) / 10 : null;
}

/**
 * GISTDA ส่งเวลาเป็น "2026-10-08T08:00:00.000Z" แต่ค่าจริงคือเวลาไทย (ตอน 08:38 น. ได้ข้อมูล "08:00Z")
 * ถ้าอ่านเป็น UTC จะกลายเป็นเวลาในอนาคต 7 ชม. — จึงอ่านเป็นเวลาไทยเมื่อค่า UTC อยู่ในอนาคตเกิน 1 ชม.
 */
export function parseGistdaTime(value, now = Date.now()) {
  const text = String(value || "").trim();
  if (!text) return null;
  const asUtc = Date.parse(text);
  if (!Number.isFinite(asUtc)) return null;
  if (asUtc - now <= 60 * 60 * 1000) return new Date(asUtc).toISOString();
  const asBangkok = Date.parse(`${text.replace(/(\.\d+)?Z$/i, "")}+07:00`);
  return Number.isFinite(asBangkok) ? new Date(asBangkok).toISOString() : null;
}

function normalizeName(value) {
  return String(value || "").replace(/^อ(\.|ำเภอ)\s*/, "").replace(/\s+/g, "").trim();
}

function reading(value, avg24, dt, now) {
  const current = roundPm(value);
  const average = roundPm(avg24);
  return {
    value: current,
    avg24: average,
    level: pm25Level(current)?.key || null,
    avg24_level: pm25Level(average)?.key || null,
    observed_at: parseGistdaTime(dt, now)
  };
}

/** รวมคำตอบของ getPm25byProvince + getPm25byAmphoe?pv_idn=91 เป็นข้อมูลที่หน้าเว็บใช้ */
export function buildPm25Payload({ provinces = [], amphoes = [], now = Date.now() } = {}) {
  const sorted = [...provinces]
    .filter((row) => Number.isFinite(toNumber(row?.pm25)))
    .sort((a, b) => Number(b.pm25) - Number(a.pm25));
  const satunIndex = sorted.findIndex((row) => Number(row.pv_idn) === SATUN_PROVINCE_ID);
  const satun = satunIndex >= 0 ? sorted[satunIndex] : null;

  const districts = amphoes
    .filter((row) => row?.ap_tn && Number.isFinite(toNumber(row.pm25)))
    .map((row) => ({
      name: normalizeName(row.ap_tn),
      code: row.ap_idn ?? null,
      ...reading(row.pm25, row.pm25Avg24hr, row.dt, now)
    }))
    .sort((a, b) => b.value - a.value);

  const NEIGHBORS = [90, 92]; // สงขลา ตรัง
  const neighbors = sorted
    .filter((row) => NEIGHBORS.includes(Number(row.pv_idn)))
    .map((row) => ({ name: row.pv_tn, ...reading(row.pm25, row.pm25Avg24hr, row.dt, now) }));

  return {
    province: satun ? { name: satun.pv_tn, ...reading(satun.pm25, satun.pm25Avg24hr, satun.dt, now) } : null,
    // อันดับ 1 = ฝุ่นมากที่สุดของประเทศ
    rank: satunIndex >= 0 ? satunIndex + 1 : null,
    province_count: sorted.length,
    districts,
    neighbors,
    source: "GISTDA (สทอภ.) ประมาณค่าจากดาวเทียมรายชั่วโมง"
  };
}

/** ค่าของอำเภอ (ตามชื่อ) ถ้าไม่มีใช้ค่าจังหวัด */
export function pm25ForDistrict(payload, districtName) {
  const name = normalizeName(districtName);
  const district = payload?.districts?.find((item) => item.name === name);
  if (district) return { ...district, scope: "district" };
  return payload?.province ? { ...payload.province, scope: "province" } : null;
}
