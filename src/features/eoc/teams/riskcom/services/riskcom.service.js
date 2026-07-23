import { riskcomAnnouncementsSchema } from "../schemas/riskcom.schema";

export async function getRiskcomAnnouncements(eocType, { signal } = {}) {
  const response = await fetch(`/stn-eoc/api/public/announcements?eocType=${encodeURIComponent(eocType)}&limit=20`, { signal });
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || "ไม่สามารถโหลดข่าวประกาศได้");
  return riskcomAnnouncementsSchema.parse(payload);
}
