import { floodSatDashboardSchema } from "./schema";

export async function getFloodSatDashboard(date, { sessionId, signal } = {}) {
  const params = new URLSearchParams({ report_date: date });
  if (sessionId) params.set("session_id", String(sessionId));
  const response = await fetch(`/stn-eoc/api/eoc/flood/daily-risk?${params.toString()}`, { signal });
  const payload = await response.json();
  if (!response.ok) throw new Error(payload.message || "ไม่สามารถโหลดข้อมูล SAT อุทกภัยได้");
  return floodSatDashboardSchema.parse(payload);
}
