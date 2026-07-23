import { itResourceSummarySchema } from "../schemas/it.schema";

export async function getItResourceSummary({ signal } = {}) {
  const response = await fetch("/stn-eoc/api/admin/it-resources", { signal });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || "ไม่สามารถโหลดข้อมูลทรัพย์สินไอทีได้");
  return itResourceSummarySchema.parse(payload);
}
