// เลขติดตามและสถานะที่ประชาชนเห็น (ไม่มีการเรียกฐานข้อมูลในไฟล์นี้)

// ตัดตัวที่สับสนง่ายออก (0/O, 1/I/L) เพื่อให้อ่านทางโทรศัพท์ได้
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_PREFIX = "ST";
export const CODE_LENGTH = 6;

/** สุ่มเลขติดตาม: randomBytes(n) → Uint8Array (ฝั่งเซิร์ฟเวอร์ใช้ crypto.randomBytes) */
export function generateTrackingCode(randomBytes) {
  const bytes = randomBytes(CODE_LENGTH);
  let body = "";
  for (let index = 0; index < CODE_LENGTH; index += 1) {
    body += CODE_ALPHABET[bytes[index] % CODE_ALPHABET.length];
  }
  return `${CODE_PREFIX}${body}`;
}

/** รับรูปแบบที่ผู้ใช้พิมพ์มาได้หลายแบบ: "st-k7q 9mx", "K7Q9MX" → "STK7Q9MX" */
export function normalizeTrackingCode(value) {
  const cleaned = String(value || "").toUpperCase().replace(/[^0-9A-Z]/g, "");
  if (!cleaned) return "";
  const withPrefix = cleaned.startsWith(CODE_PREFIX) ? cleaned : `${CODE_PREFIX}${cleaned}`;
  return withPrefix.length === CODE_PREFIX.length + CODE_LENGTH ? withPrefix : "";
}

/** แสดงให้อ่านง่าย: STK7Q9MX → ST-K7Q-9MX */
export function formatTrackingCode(code) {
  const value = String(code || "");
  if (value.length !== CODE_PREFIX.length + CODE_LENGTH) return value;
  return `${value.slice(0, 2)}-${value.slice(2, 5)}-${value.slice(5)}`;
}

// ชื่อ-นามสกุลที่ผู้แจ้งพิมพ์: ตัดช่องว่างซ้ำ และคำนำหน้าที่มักพิมพ์ติดมา
const NAME_TITLES = /^(นาย|นางสาว|นาง|น\.ส\.|ด\.ช\.|ด\.ญ\.|เด็กชาย|เด็กหญิง|mr\.?|mrs\.?|ms\.?|miss)\s*/i;

export function normalizePersonName(value) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, 100);
}

/** รูปแบบชื่อที่ใช้ค้น: ตามที่พิมพ์ และแบบตัดคำนำหน้าออก */
export function nameVariants(value) {
  const name = normalizePersonName(value);
  const withoutTitle = name.replace(NAME_TITLES, "").trim();
  return [...new Set([name, withoutTitle].filter(Boolean))];
}

export function phoneLast4(phone) {
  const digits = String(phone || "").replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : "";
}

/** ตรวจเบอร์ 4 ตัวท้าย (รายงานที่ไม่ได้ให้เบอร์ ใช้เลขติดตามอย่างเดียวไม่ได้ เพื่อกันการสุ่มเลข) */
export function phoneMatches(storedPhone, last4) {
  const expected = phoneLast4(storedPhone);
  const given = String(last4 || "").replace(/\D/g, "");
  return expected !== "" && given.length === 4 && expected === given;
}

// สถานะภายในศูนย์ → ข้อความที่ผู้แจ้งเข้าใจ
export const CITIZEN_STATUS = {
  pending: { step: 1, label: "รับเรื่องแล้ว", detail: "ระบบได้รับเรื่องแล้ว รอเจ้าหน้าที่ตรวจสอบ", tone: "amber" },
  reviewing: { step: 2, label: "กำลังดำเนินการ", detail: "เจ้าหน้าที่รับเรื่องแล้ว กำลังติดต่อหรือประสานทีมช่วยเหลือ", tone: "blue" },
  verified: { step: 3, label: "ยืนยันเหตุแล้ว", detail: "เจ้าหน้าที่ยืนยันข้อมูลแล้ว และกำลังติดตามช่วยเหลือ", tone: "blue" },
  resolved: { step: 4, label: "ช่วยเหลือเรียบร้อย", detail: "เจ้าหน้าที่ปิดเรื่องแล้ว", tone: "green" },
  rejected: { step: 4, label: "ไม่ดำเนินการ", detail: "เจ้าหน้าที่ปิดเรื่องโดยไม่ดำเนินการ เช่น ซ้ำกับเรื่องอื่น หรืออยู่นอกพื้นที่", tone: "red" }
};

export const CITIZEN_STEPS = ["รับเรื่อง", "ดำเนินการ", "ยืนยันเหตุ", "เสร็จสิ้น"];

export function citizenStatus(status) {
  return CITIZEN_STATUS[status] || CITIZEN_STATUS.pending;
}

export const REPORT_TYPE_LABELS = {
  help_request: "คำขอความช่วยเหลือ",
  problem_point: "แจ้งจุดปัญหา",
  traffic_report: "แจ้งเส้นทาง"
};

/** ประวัติที่แสดงให้ผู้แจ้ง: ตัดสถานะซ้ำติดกัน และเรียงจากเก่าไปใหม่ */
export function citizenTimeline(events = []) {
  const sorted = [...events].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const result = [];
  for (const event of sorted) {
    const previous = result[result.length - 1];
    if (previous && previous.status === event.status && !event.citizen_message) continue;
    const meta = citizenStatus(event.status);
    result.push({ status: event.status, label: meta.label, at: event.created_at, message: event.citizen_message || null });
  }
  return result;
}
