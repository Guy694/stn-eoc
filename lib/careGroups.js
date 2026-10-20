import { RISK_TONES } from "@/lib/riskPalette";

// การแบ่งกลุ่มเปราะบางตามสีในสถานการณ์อุทกภัย (แนวทาง สสจ.สตูล / ทีม SAT)
// แบ่งตามความสามารถช่วยเหลือตนเอง ความจำเป็นในการรักษาต่อเนื่อง และความเสี่ยงหากเส้นทางถูกตัดขาด
export const CARE_GROUPS = [
  {
    key: "red", label: "สีแดง", rank: 3, ...RISK_TONES.red,
    level: "ต้องได้รับความช่วยเหลือและวางแผนเคลื่อนย้ายก่อน",
    examples: "ติดเตียง/เคลื่อนย้ายตนเองไม่ได้ · พึ่งเครื่องช่วยหายใจหรืออุปกรณ์ที่ใช้ไฟฟ้า · ฟอกไตที่เดินทางไปรับบริการไม่ได้ · ต้องรักษาต่อเนื่องหยุดไม่ได้"
  },
  {
    key: "yellow", label: "สีเหลือง", rank: 2, ...RISK_TONES.yellow,
    level: "ต้องมีผู้ช่วยเหลือและติดตามใกล้ชิด",
    examples: "ผู้สูงอายุ/ผู้พิการที่ช่วยตนเองได้บางส่วน · ติดบ้าน · หญิงตั้งครรภ์ · เด็กเล็ก · โรคเรื้อรังที่ต้องมีคนช่วยจัดยาหรือเดินทาง"
  },
  {
    key: "green", label: "สีเขียว", rank: 1, ...RISK_TONES.green,
    level: "ช่วยเหลือตนเองได้และเตรียมอพยพตามคำเตือน",
    examples: "ผู้สูงอายุ/ผู้พิการที่เคลื่อนไหวได้เอง · โรคเรื้อรังอาการคงที่ จัดยาเองได้ มีผู้ดูแลหรือช่องทางติดต่อพร้อม"
  }
];

// สีเริ่มต้นตามประเภท — ตามที่ศูนย์ตกลง (ต.ค. 2569): ทุกประเภทเริ่มที่ "สีแดง" ให้ทีมลงพื้นที่ทุกคนก่อน
// แล้ว รพ.สต. ปรับรายคนหลังประเมิน (เลือกสีในฟอร์มแก้ไข) — สีที่ประเมินแล้วไม่ถูกเปลี่ยน
export const DEFAULT_GROUP_BY_TYPE = {
  bedridden: "red",
  dialysis_hd: "red",
  dialysis_pd: "red",
  disabled: "red",
  pregnant: "red",
  children: "red",
  elderly: "red",
  chronic_illness: "red",
  psychiatric: "red"
};

const BY_KEY = new Map(CARE_GROUPS.map((group) => [group.key, group]));

export function isCareGroup(key) {
  return BY_KEY.has(key);
}

export function careGroupMeta(key) {
  return BY_KEY.get(key) || null;
}

/** สีที่ระบบเสนอ: พึ่งอุปกรณ์ที่ใช้ไฟฟ้า = แดงเสมอ, นอกนั้นตามประเภท */
export function defaultCareGroup(type, powerDependent = false) {
  if (powerDependent) return "red";
  return DEFAULT_GROUP_BY_TYPE[type] || "red";
}

/** สีที่ใช้จริง: ที่เจ้าหน้าที่ประเมินไว้ ถ้ายังไม่ประเมินใช้สีที่ระบบเสนอ */
export function effectiveCareGroup(person) {
  if (isCareGroup(person?.care_group)) return person.care_group;
  return defaultCareGroup(person?.vulnerable_type, Boolean(person?.power_dependent));
}

export function careGroupRank(person) {
  return careGroupMeta(effectiveCareGroup(person))?.rank || 0;
}
