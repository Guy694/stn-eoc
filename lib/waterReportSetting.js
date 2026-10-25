// เมนู "รายงานระดับน้ำ" ของประชาชน: ผู้ดูแลระบบเลือกได้ว่า เปิดตามการเปิด EOC อุทกภัย (ค่าเดิม) / เปิดตลอด / ปิด
// ไม่มีการเรียกเครือข่ายหรือฐานข้อมูลในไฟล์นี้ (ใช้ได้ทั้งหน้าเว็บและเซิร์ฟเวอร์)
export const WATER_REPORT_SETTING_KEY = "public_water_report";

export const WATER_REPORT_MODES = {
  auto: { label: "เปิดเมื่อเปิด EOC อุทกภัย", detail: "ค่าเริ่มต้น: เปิดรับรายงานอัตโนมัติเมื่อเปิดศูนย์ปฏิบัติการด้านอุทกภัย และปิดเมื่อปิด EOC" },
  on: { label: "เปิดตลอด", detail: "ประชาชนรายงานระดับน้ำได้ทุกเวลา แม้ยังไม่เปิด EOC (เช่น ช่วงเฝ้าระวังก่อนเกิดเหตุ)" },
  off: { label: "ปิด", detail: "ปิดรับรายงานระดับน้ำ แม้เปิด EOC อุทกภัยอยู่" }
};

export function normalizeWaterReportSetting(value) {
  const mode = Object.hasOwn(WATER_REPORT_MODES, value?.mode) ? value.mode : "auto";
  return { mode, updated_at: value?.updated_at || null, updated_by_name: value?.updated_by_name || null };
}

/** เปิดรับรายงานไหม: { open, reason } — reason: "eoc" (ตาม EOC) | "admin" (ผู้ดูแลตั้งไว้) */
export function waterReportStatus(mode, sessions = []) {
  if (mode === "on") return { open: true, reason: "admin" };
  if (mode === "off") return { open: false, reason: "admin" };
  return { open: sessions.some((session) => session?.eoc_type === "flood"), reason: "eoc" };
}

export const WATER_ADMIN_CLOSED_MESSAGE = "ขณะนี้ปิดรับรายงานระดับน้ำผ่านเว็บไซต์ชั่วคราว หากเป็นเหตุฉุกเฉินโทร 1669 หรือ 1784";
