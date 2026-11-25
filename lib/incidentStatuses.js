// สถานะเรื่องที่ประชาชนแจ้ง (ขอความช่วยเหลือ/จุดปัญหา) — ใช้ทั้งหน้ารับเรื่องและแผนที่สถานการณ์เจ้าหน้าที่
export const INCIDENT_STATUSES = [
  { value: "pending", label: "รอตรวจสอบ", tone: "amber", hint: "ยังไม่มีใครรับเรื่อง" },
  { value: "reviewing", label: "กำลังดำเนินการ", tone: "blue", hint: "รับเรื่องแล้ว กำลังติดต่อ/ส่งทีม" },
  { value: "verified", label: "ยืนยันแล้ว", tone: "green", hint: "เกิดจริง ใช้ในงานศูนย์ได้ (ยังไม่ขึ้นแผนที่จนกว่าจะกดเผยแพร่)" },
  { value: "resolved", label: "ช่วยเหลือแล้ว", tone: "gray", hint: "ปิดเรื่อง และถอดออกจากแผนที่สาธารณะ" },
  { value: "rejected", label: "ไม่ดำเนินการ", tone: "red", hint: "ซ้ำ ข้อมูลไม่จริง หรือไม่อยู่ในพื้นที่" }
];

export function incidentStatusMeta(value) {
  return INCIDENT_STATUSES.find((item) => item.value === value) || { value, label: value || "-", tone: "gray" };
}
