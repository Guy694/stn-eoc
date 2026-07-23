import { dengueSatDashboardSchema } from "./schema";

export async function getDengueSatDashboard(date, { signal } = {}) {
  const response = await fetch(`/stn-eoc/api/eoc/disease/daily-risk?date=${encodeURIComponent(date)}`, { signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "ไม่สามารถโหลดข้อมูล SAT ได้");
  return dengueSatDashboardSchema.parse(payload);
}
