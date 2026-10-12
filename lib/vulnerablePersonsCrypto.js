// แปลงข้อมูลบุคคล ↔ แถวในฐานข้อมูล (เข้ารหัสฟิลด์อ่อนไหว) — ใช้เฉพาะฝั่งเซิร์ฟเวอร์
import { decryptField, decryptJsonField, encryptField } from "@/lib/fieldCrypto";

const PURPOSE = "vulnerable-person";
const enc = (value, field) => encryptField(value, { purpose: PURPOSE, field });
const dec = (value, field) => decryptField(value, { purpose: PURPOSE, field });
const decJson = (value, field) => decryptJsonField(value, { purpose: PURPOSE, field });

/** ค่าที่ผ่าน validatePerson → คอลัมน์ที่จะบันทึก */
export function encodePerson(value) {
  const caregiver = value.caregiver_name || value.caregiver_phone ? { name: value.caregiver_name || null, phone: value.caregiver_phone || null } : null;
  return {
    vulnerable_type: value.vulnerable_type,
    district: value.district,
    tambon: value.tambon,
    village: value.village,
    name_enc: enc(value.name, "name"),
    phone_enc: enc(value.phone, "phone"),
    address_enc: enc(value.address, "address"),
    location_enc: enc(value.location, "location"),
    needs_enc: enc(value.needs, "needs"),
    caregiver_enc: enc(caregiver, "caregiver"),
    clinical_enc: value.due_date || value.preterm_history ? enc({ due_date: value.due_date || null, preterm_history: Boolean(value.preterm_history) }, "clinical") : null
  };
}

/** แถวจากฐานข้อมูล → ข้อมูลที่ส่งให้เจ้าหน้าที่ (ถอดรหัสไม่ได้ → ระบุ decrypt_error ไม่ล้มทั้งรายการ) */
export function decodePerson(row) {
  try {
    const location = decJson(row.location_enc, "location");
    const caregiver = decJson(row.caregiver_enc, "caregiver");
    const clinical = row.clinical_enc ? decJson(row.clinical_enc, "clinical") : null;
    return {
      id: row.id,
      vulnerable_type: row.vulnerable_type,
      district: row.district,
      tambon: row.tambon,
      village: row.village,
      name: dec(row.name_enc, "name"),
      phone: dec(row.phone_enc, "phone"),
      address: dec(row.address_enc, "address"),
      needs: dec(row.needs_enc, "needs"),
      caregiver_name: caregiver?.name || null,
      caregiver_phone: caregiver?.phone || null,
      due_date: clinical?.due_date || null,
      preterm_history: Boolean(clinical?.preterm_history),
      location: Number.isFinite(location?.lat) && Number.isFinite(location?.lng) ? { lat: location.lat, lng: location.lng } : null,
      updated_at: row.updated_at
    };
  } catch {
    return {
      id: row.id,
      vulnerable_type: row.vulnerable_type,
      district: row.district,
      tambon: row.tambon,
      village: row.village,
      name: "(ถอดรหัสไม่ได้)",
      location: null,
      decrypt_error: true,
      updated_at: row.updated_at
    };
  }
}

export const encryptNote = (note) => enc(note, "case-note");
export function decryptNote(payload) {
  try {
    return dec(payload, "case-note");
  } catch {
    return null;
  }
}
