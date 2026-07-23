import { query } from "@/lib/db";
import { getTeam, normalizeTeamCode } from "@/src/features/eoc/registries/team.registry";

function parsePositiveId(value) {
  const id = Number(value);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function buildPermissions({ context, isPrivileged, isTeamLead, userId }) {
  const isKnownSessionState = ["active", "closed"].includes(context.session_status);
  const isActive = context.session_status === "active";
  const isMember = Boolean(context.membership_id)
    || isTeamLead
    || isPrivileged;

  return {
    canView: isMember,
    canOperate: isMember && isActive,
    canReport: isMember && isKnownSessionState,
    canSubmit: (isPrivileged || isTeamLead) && isKnownSessionState,
    canReview: isPrivileged && isKnownSessionState,
    canApprove: isPrivileged && isKnownSessionState,
    isOwner: Number(context.member_officer_id) === Number(userId),
  };
}

export async function getSessionTeamAccess(user, sessionId, sessionTeamId) {
  const parsedSessionId = parsePositiveId(sessionId);
  const parsedSessionTeamId = parsePositiveId(sessionTeamId);
  if (!parsedSessionId || !parsedSessionTeamId) {
    return { ok: false, status: 400, message: "Session หรือกลุ่มภารกิจไม่ถูกต้อง" };
  }

  const rows = await query(`
    SELECT s.id AS session_id, s.eoc_type, s.session_number, s.status AS session_status,
           s.opened_at AS session_opened_at, s.closed_at AS session_closed_at,
           st.id AS session_team_id, st.team_lead_officer_id,
           t.team_code, t.team_name_th,
           member.id AS membership_id, member.officer_id AS member_officer_id
    FROM eoc_sessions s
    JOIN eoc_session_teams st ON st.eoc_session_id = s.id AND st.is_active = TRUE
    JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = TRUE
    LEFT JOIN eoc_team_members member
      ON member.session_team_id = st.id
     AND member.officer_id = ?
     AND member.is_active = TRUE
    WHERE s.id = ? AND st.id = ?
    LIMIT 1
  `, [user.id, parsedSessionId, parsedSessionTeamId]);
  if (!rows.length) return { ok: false, status: 404, message: "ไม่พบกลุ่มภารกิจใน Session ที่ระบุ" };

  const context = rows[0];
  const isPrivileged = ["admin", "commander"].includes(user.role);
  const isTeamLead = Number(context.team_lead_officer_id) === Number(user.id);
  const isMember = isPrivileged || isTeamLead || Boolean(context.membership_id);
  if (!isMember) return { ok: false, status: 403, message: "ไม่มีสิทธิ์เข้าถึงข้อมูลกลุ่มภารกิจนี้" };
  const permissions = buildPermissions({ context, isPrivileged, isTeamLead, userId: user.id });

  return {
    ok: true,
    context,
    isPrivileged,
    isTeamLead,
    ...permissions,
    // Compatibility alias for existing operational consumers.
    canWrite: permissions.canOperate,
  };
}

export function isReportDateWithinSession(context, reportDate, now = new Date()) {
  const date = reportDate instanceof Date ? reportDate : new Date(reportDate);
  const openedAt = new Date(context.session_opened_at);
  const upperBound = context.session_closed_at ? new Date(context.session_closed_at) : now;
  if ([date, openedAt, upperBound].some((value) => Number.isNaN(value.getTime()))) return false;
  return date >= openedAt && date <= upperBound;
}

export async function getSessionTeamAccessByCode(user, sessionId, teamCode) {
  const parsedSessionId = parsePositiveId(sessionId);
  const normalizedTeamCode = normalizeTeamCode(teamCode);
  const team = getTeam(normalizedTeamCode);
  if (!parsedSessionId || !team) {
    return { ok: false, status: 400, message: "Session หรือกลุ่มภารกิจไม่ถูกต้อง" };
  }

  const teams = await query(`
    SELECT st.id AS session_team_id
    FROM eoc_session_teams st
    JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = TRUE
    WHERE st.eoc_session_id = ?
      AND st.is_active = TRUE
      AND LOWER(t.team_code) = LOWER(?)
    LIMIT 1
  `, [parsedSessionId, team.legacyCode]);
  if (!teams.length) {
    return { ok: false, status: 404, message: "ไม่พบกลุ่มภารกิจใน Session ที่ระบุ" };
  }
  return getSessionTeamAccess(user, parsedSessionId, teams[0].session_team_id);
}

export async function writeTeamReportAudit(user, context, reportId, action, detail = {}, execute = query) {
  await execute(`
    INSERT INTO activity_logs
      (user_id, username, action_type, target_type, target_id, eoc_session_id, description, metadata)
    VALUES (?, ?, ?, 'eoc_team_report', ?, ?, ?, ?)
  `, [
    user.id,
    user.username,
    action,
    String(reportId),
    context.session_id,
    `รายงาน ${context.team_code}: ${detail.description || action}`,
    JSON.stringify({ session_id: context.session_id, session_team_id: context.session_team_id, team_code: context.team_code, report_id: reportId, ...detail }),
  ]);
}
