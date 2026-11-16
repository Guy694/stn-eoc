import { normalizeTeamCode } from "../../registries/team.registry.js";

export function getTeamPath(eocType, teamCode, section = "dashboard") {
  return `/eoc/${encodeURIComponent(eocType)}/teams/${encodeURIComponent(teamCode)}/${section}`;
}

/**
 * หน้ารายงานประจำวันของทีมในเหตุการณ์ (ลิงก์ในการแจ้งเตือนและหน้าคุณภาพข้อมูล)
 * ไข้เลือดออก (dengue) ใช้เส้นทาง /eoc/disease · ข้อมูลไม่พอ → หน้าหลัก
 */
export function teamRecordsPath({ eocType, teamCode, sessionId } = {}) {
  const code = normalizeTeamCode(String(teamCode || ""));
  if (!eocType || !code) return "/dashboard";
  const routeType = eocType === "dengue" ? "disease" : eocType;
  const query = sessionId ? `?sessionId=${encodeURIComponent(sessionId)}` : "";
  return `${getTeamPath(routeType, code, "records")}${query}`;
}
