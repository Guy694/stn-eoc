import { teamReportsResponseSchema } from "../schemas/team-reports.schema";

function basePath(sessionId, sessionTeamId) {
  return `/stn-eoc/api/eoc/sessions/${sessionId}/teams/${sessionTeamId}/reports`;
}

async function requestJson(url, options) {
  const response = await fetch(url, options);
  const payload = await response.json();
  if (!response.ok || !payload.success) throw new Error(payload.message || "การดำเนินการรายงานไม่สำเร็จ");
  return payload;
}

export async function getTeamReports(sessionId, sessionTeamId, filters = {}, { signal } = {}) {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  const payload = await requestJson(`${basePath(sessionId, sessionTeamId)}?${params}`, { signal });
  return teamReportsResponseSchema.parse(payload);
}

export function createTeamReport(sessionId, sessionTeamId, body) {
  return requestJson(basePath(sessionId, sessionTeamId), { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function updateTeamReport(sessionId, sessionTeamId, reportId, body) {
  return requestJson(`${basePath(sessionId, sessionTeamId)}/${reportId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
}

export function submitTeamReport(sessionId, sessionTeamId, reportId) {
  return requestJson(`${basePath(sessionId, sessionTeamId)}/${reportId}/submit`, { method: "POST" });
}

export function reviewTeamReport(sessionId, sessionTeamId, reportId, status, comment = "") {
  return requestJson(`${basePath(sessionId, sessionTeamId)}/${reportId}/review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status, comment }) });
}
