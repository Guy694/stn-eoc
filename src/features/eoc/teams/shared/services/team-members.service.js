import { teamMembersResponseSchema } from "../schemas/team-members.schema";

export async function getTeamMembers(eocType, teamCode, { sessionId, signal } = {}) {
  const params = new URLSearchParams();
  if (sessionId) params.set("sessionId", String(sessionId));
  const queryString = params.size ? `?${params.toString()}` : "";
  const response = await fetch(
    `/stn-eoc/api/eoc/${encodeURIComponent(eocType)}/teams/${encodeURIComponent(teamCode)}/members${queryString}`,
    { signal }
  );
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || "ไม่สามารถโหลดข้อมูลสมาชิกได้");
  return teamMembersResponseSchema.parse(payload);
}
