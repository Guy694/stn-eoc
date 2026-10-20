// ข้อความสำเร็จรูปสำหรับส่งถึงประชาชน (หน้า ตั้งค่าระบบ › แจ้งเตือนประชาชน)
// ส่วนในวงเล็บ [ ] คือที่ต้องแก้เป็นข้อมูลจริง — ระบบไม่ยอมให้ส่งจนกว่าจะแก้ครบ ({อำเภอ} เติมจากอำเภอที่เลือกให้เอง)
// ระดับการส่งอัตโนมัติ (แอดมินเลือกในหน้าตั้งค่า) — อยู่ไฟล์นี้เพราะหน้าเว็บ import ได้ (lib/publicPush ใช้ node:crypto)
export const AUTO_LEVELS = {
  high: { label: "เฉพาะเหตุรุนแรง", detail: "น้ำล้นตลิ่ง ฝน 24 ชม. ≥ 90 มม. และประกาศเตือนระดับสูง" },
  watch: { label: "รวมระดับเฝ้าระวัง", detail: "เพิ่มน้ำใกล้ตลิ่ง (ห่างไม่เกิน 0.5 ม.) และฝนหนัก ≥ 60 มม./24 ชม. หรือ ≥ 35 มม./ชม. — ส่งแบบไม่เร่งด่วน" }
};

export const PUSH_TEMPLATES = [
  {
    key: "watch",
    label: "เฝ้าระวัง",
    tone: "bg-amber-50 text-amber-900 ring-amber-200 hover:bg-amber-100",
    level: "info",
    url: "/stn-eoc/public/weather-watch/",
    title: "เฝ้าระวังน้ำท่วม {อำเภอ}",
    body: "ฝนตกหนักต่อเนื่อง ระดับน้ำ[คลอง]สูงขึ้นใกล้ตลิ่ง ประชาชนริมน้ำใน [ตำบล] ขอให้ยกของขึ้นที่สูง ชาร์จโทรศัพท์ เตรียมยาประจำตัวและเอกสารสำคัญ ติดตามประกาศอย่างใกล้ชิด"
  },
  {
    key: "prepare",
    label: "เตรียมอพยพ",
    tone: "bg-orange-50 text-orange-900 ring-orange-200 hover:bg-orange-100",
    level: "high",
    url: "/stn-eoc/public/shelters/",
    title: "⚠️ เตรียมอพยพ [ตำบล] {อำเภอ}",
    body: "น้ำ[คลอง]ล้นตลิ่งแล้ว คาดว่าน้ำจะเข้าพื้นที่ [หมู่ที่] ภายใน [ชั่วโมง] ชม. ให้เตรียมพร้อมอพยพ ดูแลผู้สูงอายุ ผู้ป่วยติดเตียง และเด็ก ย้ายรถไปที่สูง ปิดเบรกเกอร์ก่อนออกจากบ้าน ต้องการความช่วยเหลือ โทร 1784"
  },
  {
    key: "evacuate",
    label: "อพยพทันที",
    tone: "bg-red-50 text-red-800 ring-red-200 hover:bg-red-100",
    level: "high",
    url: "/stn-eoc/public/shelters/",
    title: "🚨 อพยพทันที [หมู่ที่] [ตำบล]",
    body: "น้ำท่วมสูงและเพิ่มขึ้นเร็ว ขอให้ออกจากบ้านทันที ไปที่ศูนย์พักพิง [ชื่อศูนย์] นำยา เอกสาร และโทรศัพท์ไปด้วย ห้ามเดินหรือขับรถผ่านน้ำไหลเชี่ยว ติดค้างหรือมีผู้ป่วย โทร 1669 หรือกด \"ขอความช่วยเหลือ\" ในเว็บ"
  },
  {
    key: "shelter",
    label: "เปิดศูนย์พักพิง",
    tone: "bg-sky-50 text-sky-900 ring-sky-200 hover:bg-sky-100",
    level: "info",
    url: "/stn-eoc/public/shelters/",
    title: "เปิดศูนย์พักพิง {อำเภอ}",
    body: "เปิดศูนย์พักพิง [ชื่อศูนย์] รับผู้ได้รับผลกระทบแล้ว มีอาหาร น้ำดื่ม และหน่วยแพทย์ ดูเส้นทางและศูนย์ที่ใกล้บ้านได้ในเว็บ"
  },
  {
    key: "resolved",
    label: "คลี่คลาย",
    tone: "bg-emerald-50 text-emerald-900 ring-emerald-200 hover:bg-emerald-100",
    level: "info",
    url: "/stn-eoc/public/announcements/",
    title: "น้ำลดแล้ว {อำเภอ}",
    body: "ระดับน้ำ[คลอง]ลดลงต่ำกว่าตลิ่งแล้ว ก่อนกลับเข้าบ้านให้ตรวจปลั๊กและสายไฟว่าแห้ง ระวังสัตว์มีพิษ ถ้ามีไข้หรือแผลติดเชื้อหลังลุยน้ำ (เสี่ยงโรคฉี่หนู) ให้รีบพบแพทย์"
  }
];

/** เติมชื่ออำเภอที่เลือก (ไม่เลือก/หลายอำเภอ = ทิ้งเป็น [อำเภอ] ให้แก้เอง หรือ "จ.สตูล") */
export function fillTemplate(template, districts = []) {
  const area = districts.length === 1 ? `อ.${districts[0]}` : districts.length > 1 ? districts.map((d) => `อ.${d}`).join(" ") : "จ.สตูล";
  const fill = (text) => text.replaceAll("{อำเภอ}", area);
  return { title: fill(template.title).slice(0, 100), body: fill(template.body).slice(0, 400), url: template.url, level: template.level };
}

/** ส่วนที่ยังไม่ได้แก้ เช่น [ตำบล] (ยกเว้น [ทดสอบ] ที่ใช้ติดป้ายข้อความทดสอบ) */
export function unfilledPlaceholders(text = "") {
  return [...new Set(String(text).match(/\[[^\]\n]{1,30}\]/g) || [])].filter((item) => item !== "[ทดสอบ]");
}
