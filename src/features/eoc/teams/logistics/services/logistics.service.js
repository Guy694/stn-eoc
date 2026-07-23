import { medicalInventorySummarySchema } from "../schemas/logistics.schema";

export async function getMedicalInventorySummary({ signal } = {}) {
  const response = await fetch("/stn-eoc/api/resources/medical-inventory", { signal });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || "ไม่สามารถโหลดข้อมูลคลังเวชภัณฑ์ได้");
  return medicalInventorySummarySchema.parse(payload);
}
