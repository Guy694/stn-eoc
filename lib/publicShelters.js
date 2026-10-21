// ข้อมูลศูนย์พักพิงที่เปิดเผยต่อสาธารณะ (ไม่มีการเรียกฐานข้อมูลในไฟล์นี้)
// - เปิดเผยเฉพาะช่วงที่มีศูนย์ปฏิบัติการ (EOC) เปิดอยู่ และเฉพาะศูนย์ที่เปิดใช้ในเหตุการณ์นั้น
// - ไม่ส่งชื่อ/เบอร์ผู้ประสานงาน เจ้าหน้าที่สาธารณสุข และตัวเลขกลุ่มเปราะบางรายศูนย์ (ระบุตัวบุคคลได้ในชุมชนเล็ก)

export const PUBLIC_SHELTER_FIELDS = [
  "id",
  "sheltername",
  "eoc_type",
  "shelter_type",
  "lat",
  "lon",
  "address",
  "tambon",
  "district_name",
  "village",
  "shelter_capacity",
  "contact_phone",
  "responsible_org"
];

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function occupancyStatus(capacity, occupancy) {
  if (!capacity) return "unknown";
  if (occupancy >= capacity) return "full";
  if (occupancy >= capacity * 0.8) return "near_full";
  return "available";
}

/** แปลงแถวจากฐานข้อมูลเป็นข้อมูลสาธารณะ */
export function toPublicShelter(row) {
  const shelter = {};
  for (const field of PUBLIC_SHELTER_FIELDS) shelter[field] = row[field] ?? null;
  const capacity = toNumber(row.shelter_capacity);
  const occupancy = toNumber(row.current_occupancy);
  shelter.current_occupancy = occupancy;
  shelter.vacancy = Math.max(capacity - occupancy, 0);
  shelter.occupancy_status = occupancyStatus(capacity, occupancy);
  shelter.session_id = row.session_id ?? null;
  shelter.activated_at = row.activated_at ?? null;
  shelter.updated_at = row.occupancy_updated_at || row.updated_at || null;
  return shelter;
}
