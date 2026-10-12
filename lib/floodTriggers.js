// เกณฑ์ Trigger การเคลื่อนย้ายกลุ่มเปราะบางในสถานการณ์อุทกภัย จังหวัดสตูล (ทีม SAT, EOC สสจ.สตูล)
// ใช้ร่วมกัน: หน้าประกาศธง/Trigger รายพื้นที่, รายงานระดับน้ำ, รายชื่อเป้าหมายในทะเบียนกลุ่มเปราะบาง
import { effectiveCareGroup } from "@/lib/careGroups";
import { RISK_TONES } from "@/lib/riskPalette";

export const FLOOD_FLAGS = [
  { key: "green", label: "ธงเขียว", meaning: "เฝ้าระวัง", ...RISK_TONES.green,
    criteria: "มีฝนตก/มีแนวโน้มระดับน้ำเพิ่มขึ้น แต่ยังไม่กระทบพื้นที่พักอาศัยและเส้นทางสัญจร" },
  { key: "yellow", label: "ธงเหลือง", meaning: "เตรียมพร้อมเคลื่อนย้าย", ...RISK_TONES.yellow,
    criteria: "ระดับน้ำเพิ่มต่อเนื่อง มีแนวโน้มเข้าพื้นที่ หรือเส้นทางเข้า–ออกมีความเสี่ยงได้รับผลกระทบ" },
  { key: "red", label: "ธงแดง", meaning: "เคลื่อนย้าย", ...RISK_TONES.red,
    criteria: "น้ำใกล้เข้าสู่พื้นที่หรือมีแนวโน้มเพิ่มอย่างรวดเร็ว เส้นทางเสี่ยงถูกตัดขาด หรือการอยู่ในพื้นที่อาจไม่ปลอดภัย" }
];

const RPST = "รพ.สต.";
// ขั้น (stage) = Trigger + ธง (Trigger 1 แยกตามธง 3 สี)
// target: เลือกรายชื่อเป้าหมายจากทะเบียน (care = กลุ่มสี, status = สถานะการช่วยเหลือ)
export const TRIGGER_STAGES = [
  {
    key: "t0", trigger: 0, phase: "ก่อนน้ำท่วม", name: "เตรียมพร้อม", flag: null,
    criteria: "เข้าสู่ฤดูฝน หรือมีประกาศเฝ้าระวังฝนตกหนัก/พื้นที่เสี่ยงน้ำท่วม",
    actions: [
      { text: "ทบทวนทะเบียนกลุ่มเปราะบางรายพื้นที่ ระบุที่อยู่ ผู้ดูแล เบอร์ติดต่อ", who: `${RPST} ร่วมกับ อสม. และผู้ดูแล` },
      { text: "ประเมินการเคลื่อนย้าย ยา ออกซิเจน/อุปกรณ์ และกำหนดจุดรับ–ปลายทาง", who: `${RPST} ร่วมกับ อสม. และผู้ดูแล` }
    ],
    targetLabel: "กลุ่มเปราะบางทุกกลุ่ม",
    target: { care: ["red", "yellow", "green"] }
  },
  {
    key: "t1_green", trigger: 1, phase: "ก่อนน้ำท่วม", name: "เตรียมเคลื่อนย้าย", flag: "green",
    criteria: "มีคำเตือนฝนหนัก–หนักมาก ปริมาณน้ำในอ่างเก็บน้ำและลำน้ำเพิ่มต่อเนื่อง หรือมีแนวโน้มน้ำท่วมในพื้นที่เสี่ยง/ท่วมซ้ำซาก",
    actions: [
      { text: "ติดต่อผู้ป่วย/ญาติ ยืนยันที่อยู่และเบอร์ติดต่อ", who: `${RPST} และ อสม.` },
      { text: "ประเมินการเคลื่อนย้ายและความจำเป็นด้านการรักษา", who: `ทีมรักษาของโรงพยาบาล ร่วมกับ ${RPST}` },
      { text: "ตรวจสอบยา ออกซิเจน อุปกรณ์ทางการแพทย์ และผู้ดูแล", who: `${RPST} ร่วมกับ อสม. และผู้ดูแล` }
    ],
    targetLabel: "กลุ่มเปราะบางทุกกลุ่ม",
    target: { care: ["red", "yellow", "green"] }
  },
  {
    key: "t1_yellow", trigger: 1, phase: "ก่อนน้ำท่วม", name: "เตรียมเคลื่อนย้าย", flag: "yellow",
    criteria: "ระดับน้ำเพิ่มต่อเนื่อง มีแนวโน้มเข้าพื้นที่ หรือเส้นทางเข้า–ออกมีความเสี่ยงได้รับผลกระทบ",
    actions: [
      { text: "แจ้งผู้ป่วย/ญาติให้เตรียมพร้อม", who: `${RPST} และ อสม. ร่วมกับ อปท.` },
      { text: "เตรียมยา เวชภัณฑ์ ออกซิเจน และอุปกรณ์จำเป็นของผู้ป่วย", who: `${RPST} ร่วมกับ อสม. และผู้ดูแล` },
      { text: "ยืนยันรถ/ทีมเคลื่อนย้าย", who: `${RPST} อปท. อสม. และผู้ดูแล` },
      { text: "ยืนยันจุดรับ–จุดส่ง/บ้านญาติ สถานพยาบาลหรือศูนย์พักพิง", who: `${RPST} อปท. อสม. และผู้ดูแล` },
      { text: "เตรียมเคลื่อนย้ายกลุ่มเปราะบางสีแดง", who: `${RPST} อปท. อสม. และผู้ดูแล` }
    ],
    targetLabel: "กลุ่มเปราะบางสีแดง",
    target: { care: ["red"] }
  },
  {
    key: "t1_red", trigger: 1, phase: "ก่อนน้ำท่วม", name: "เคลื่อนย้ายล่วงหน้า", flag: "red",
    criteria: "น้ำใกล้เข้าสู่พื้นที่หรือมีแนวโน้มเพิ่มอย่างรวดเร็ว เส้นทางเสี่ยงถูกตัดขาด หรือการอยู่ในพื้นที่อาจไม่ปลอดภัย",
    actions: [
      { text: "ดำเนินการเคลื่อนย้ายทันทีตามลำดับความเร่งด่วน", who: `${RPST} อปท. อสม. ผู้ดูแล / หน่วย EMS โรงพยาบาล ร่วมกับ อปท. กู้ภัย` },
      { text: "นำยา เวชภัณฑ์ ออกซิเจน และอุปกรณ์จำเป็นติดตัว", who: "อสม. และผู้ดูแล" },
      { text: "ตรวจสอบรายชื่อผู้เคลื่อนย้ายและผู้ตกค้าง", who: `${RPST} และ อสม.` },
      { text: "รายงานสถานการณ์ต่อ EOC จังหวัด / EOC อำเภอ", who: `${RPST} / สสอ.` }
    ],
    targetLabel: "กลุ่มเปราะบางสีแดง และสีเหลือง",
    target: { care: ["red", "yellow"], notDone: true }
  },
  {
    key: "t2", trigger: 2, phase: "ก่อนน้ำท่วม", name: "เคลื่อนย้ายล่วงหน้า", flag: "red",
    criteria: "คาดว่าน้ำจะเข้าพื้นที่ หรือเส้นทางเข้าออกมีโอกาสถูกตัดขาด และบุคคลไม่สามารถอพยพเองได้",
    actions: [
      { text: "เคลื่อนย้ายก่อนน้ำสูงหรือเส้นทางถูกตัดขาด ไปบ้านญาติ จุดพักพิง หรือสถานพยาบาลตามระดับการดูแล", who: `สสอ. และ ${RPST} ร่วมกับ อปท. ทีมเคลื่อนย้าย และกู้ภัย` }
    ],
    targetLabel: "กลุ่มเปราะบางที่ยังตกค้าง และกลุ่มสีเขียว",
    target: { care: ["red", "yellow", "green"], notDone: true }
  },
  {
    key: "t3", trigger: 3, phase: "ขณะน้ำท่วม", name: "เคลื่อนย้ายฉุกเฉิน", flag: "red",
    criteria: "น้ำเข้าที่พัก/เพิ่มเร็ว กระแสน้ำแรง ไฟฟ้าดับ อุปกรณ์แพทย์ใช้ไม่ได้ เส้นทางกำลังถูกตัดขาด หรือผู้ป่วยมีอาการผิดปกติ",
    actions: [
      { text: "ประเมินความเร่งด่วน กู้ชีพ–กู้ภัย และส่งต่อไปสถานพยาบาลหรือพื้นที่ปลอดภัยตามความรุนแรงและความต้องการทางการแพทย์", who: `${RPST} ศูนย์รับแจ้งเหตุและสั่งการ 1669 กู้ภัย อปท. และหน่วยทหารที่ประสาน` }
    ],
    targetLabel: "ผู้ป่วยฉุกเฉิน และกลุ่มเปราะบางที่ยังตกค้าง",
    target: { care: ["red", "yellow", "green"], notDone: true, powerFirst: true }
  },
  {
    key: "t4", trigger: 4, phase: "ขณะน้ำท่วม", name: "ติดตามต่อเนื่อง", flag: "red",
    criteria: "กลุ่มเปราะบางที่ยังอยู่ในพื้นที่ และประเมินแล้วว่ายังอยู่ได้อย่างปลอดภัย",
    actions: [
      { text: "ติดตามอาการ ระดับน้ำ ยา อาหาร น้ำสะอาด ไฟฟ้า ออกซิเจน และเส้นทางเข้าถึง", who: `${RPST} และ อสม. ร่วมกับผู้ดูแล` },
      { text: "ยกระดับเป็น Trigger 3 ทันทีเมื่อสถานการณ์เปลี่ยน", who: `${RPST} และ อสม.` }
    ],
    targetLabel: "กลุ่มเปราะบางที่ยังไม่จำเป็นต้องเคลื่อนย้าย",
    target: { status: ["assisted", "safe", "arrived"] }
  },
  {
    key: "t5", trigger: 5, phase: "หลังน้ำลด", name: "ประเมินก่อนกลับ", flag: null,
    criteria: "ระดับน้ำลด แต่ต้องประเมินความปลอดภัยของบ้าน ระบบไฟฟ้า น้ำสะอาด สุขาภิบาล และเส้นทาง",
    actions: [
      { text: "ประเมินความพร้อมก่อนกลับบ้าน จัดยา/เวชภัณฑ์ ทบทวนนัดหมาย และเยี่ยมติดตามกลุ่มเสี่ยงสูง", who: `รพ. ${RPST} และ อสม. ร่วมกับผู้ดูแล` }
    ],
    targetLabel: "ผู้ที่ถูกเคลื่อนย้ายทั้งหมด",
    target: { status: ["moved"] }
  },
  {
    key: "t6", trigger: 6, phase: "หลังน้ำลด", name: "กลับคืนและติดตาม", flag: null,
    criteria: "บ้านและเส้นทางปลอดภัย สาธารณูปโภคพื้นฐานใช้งานได้ และสามารถให้การดูแลต่อเนื่องได้",
    actions: [
      { text: "ส่งกลับอย่างปลอดภัย และติดตามภายใน 24–48 ชม.", who: `รพ. ${RPST} และ อสม. ร่วมกับผู้ดูแล` },
      { text: "เฝ้าระวังภาวะแทรกซ้อน/โรคหลังน้ำท่วม และสรุปผล", who: `รพ. ${RPST} และ อสม.` }
    ],
    targetLabel: "กลุ่มเปราะบางที่กลับเข้าพื้นที่",
    target: { status: ["moved", "returned"] }
  }
];

export const ASSESSMENT_FACTORS = [
  "แนวโน้มปริมาณน้ำในอ่างเก็บน้ำ และลำน้ำ",
  "ปริมาณฝน",
  "โอกาสเส้นทางถูกตัดขาด"
];
export const COORDINATION_CHAIN = [
  "รพ.สต./อสม. ค้นหาและติดตามรายบุคคล",
  "สสอ./รพ. ประเมินและจัดลำดับความเร่งด่วน",
  "EMS/อปท./กู้ภัย/ร.5 พัน.2 เคลื่อนย้าย",
  "EOC"
];

const STAGE_BY_KEY = new Map(TRIGGER_STAGES.map((stage) => [stage.key, stage]));
const FLAG_BY_KEY = new Map(FLOOD_FLAGS.map((flag) => [flag.key, flag]));
const DONE_STATUSES = new Set(["assisted", "moved", "safe", "returned", "followed_up"]);

export function stageMeta(key) {
  return STAGE_BY_KEY.get(key) || null;
}

export function flagMeta(key) {
  return FLAG_BY_KEY.get(key) || null;
}

export function stageTitle(stage) {
  const meta = typeof stage === "string" ? stageMeta(stage) : stage;
  if (!meta) return "";
  const flag = meta.trigger === 1 ? flagMeta(meta.flag) : null;
  return `Trigger ${meta.trigger} ${meta.name}${flag ? ` (${flag.label})` : ""}`;
}

/** บุคคลนี้เป็นเป้าหมายของขั้นนี้หรือไม่ (ไม่ดูพื้นที่ — กรองพื้นที่แยก) */
export function matchesStageTarget(person, stageKey) {
  const stage = stageMeta(stageKey);
  if (!stage) return true;
  const { care, status, notDone } = stage.target;
  const current = person?.status || "waiting";
  if (status && !status.includes(current)) return false;
  if (care && !care.includes(effectiveCareGroup(person))) return false;
  if (notDone && DONE_STATUSES.has(current)) return false;
  return true;
}

/**
 * ประกาศที่ใช้กับพื้นที่หนึ่ง: ตำบล > อำเภอ > ทั้งจังหวัด
 * declarations: [{ district, tambon, stage, ... }] (เฉพาะประกาศล่าสุดของแต่ละพื้นที่)
 */
export function declarationFor(declarations = [], district, tambon) {
  const active = declarations.filter((item) => item.stage);
  return active.find((item) => item.district === district && item.tambon && item.tambon === tambon)
    || active.find((item) => item.district === district && !item.tambon)
    || active.find((item) => !item.district)
    || null;
}

export function areaLabel(item) {
  if (!item?.district) return "ทั้งจังหวัด";
  return item.tambon ? `ต.${item.tambon} อ.${item.district}` : `อ.${item.district}`;
}

/** ตรวจคำขอประกาศ → { value } หรือ { error } — stage ว่าง = ยกเลิกประกาศของพื้นที่นั้น */
export function validateDeclaration(input = {}) {
  const clean = (value, max) => String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
  const district = clean(input.district, 100) || null;
  const tambon = district ? clean(input.tambon, 100) || null : null;
  const stage = clean(input.stage, 20) || null;
  if (stage && !stageMeta(stage)) return { error: "ระดับ Trigger ไม่ถูกต้อง" };
  return { value: { district, tambon, stage, note: clean(input.note, 500) || null } };
}

/** ธงที่ประกาศจริงของพื้นที่ (Trigger 2–4 ถือเป็นธงแดง, หลังน้ำลด/เตรียมพร้อมไม่มีธง) */
export function declarationFlag(declaration) {
  return stageMeta(declaration?.stage)?.flag || null;
}

/** ธงที่รุนแรงที่สุดในทุกพื้นที่ที่ประกาศ (ใช้บนรายงานระดับจังหวัด) */
export function highestFlag(declarations = []) {
  const rank = { green: 1, yellow: 2, red: 3 };
  let best = null;
  for (const item of declarations) {
    const flag = declarationFlag(item);
    if (flag && (!best || rank[flag] > rank[best])) best = flag;
  }
  return best;
}
