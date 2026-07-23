import { query } from "@/lib/db";
import { parsePositiveInteger } from "@/lib/eocValidation";

export async function getOperationalSessionAccess(user, sessionId, eocType = null) {
  const id = parsePositiveInteger(sessionId);
  if (!id) return { ok: false, status: 400, message: "session_id ไม่ถูกต้อง" };
  const sessions = await query(`
    SELECT id, eoc_type, session_number, status, opened_at, closed_at
    FROM eoc_sessions
    WHERE id = ? ${eocType ? "AND eoc_type = ?" : ""}
    LIMIT 1
  `, eocType ? [id, eocType] : [id]);
  if (!sessions.length) return { ok: false, status: 404, message: "ไม่พบ EOC Session" };
  const privileged = ["admin", "commander"].includes(user.role);
  const memberships = privileged ? [] : await query(`
    SELECT st.id AS session_team_id, t.team_code, t.team_name_th,
           st.team_lead_officer_id, member.id AS membership_id
    FROM eoc_session_teams st
    JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = 1
    LEFT JOIN eoc_team_members member
      ON member.session_team_id = st.id AND member.officer_id = ? AND member.is_active = 1
    WHERE st.eoc_session_id = ? AND st.is_active = 1
      AND (member.id IS NOT NULL OR st.team_lead_officer_id = ?)
  `, [user.id, id, user.id]);
  if (!privileged && !memberships.length) return { ok: false, status: 403, message: "ไม่ได้รับมอบหมายใน Session นี้" };
  return {
    ok: true,
    session: sessions[0],
    sessionId: id,
    memberships,
    isPrivileged: privileged,
    canView: true,
    canOperate: sessions[0].status === "active",
    canVerify: privileged,
  };
}

export async function notifySessionTeam(execute, {
  sessionTeamId,
  sessionId,
  type,
  title,
  detail,
  targetUrl,
  relatedType,
  relatedId,
  excludeUserId = null,
}) {
  if (!sessionTeamId) return;
  const members = await execute(`
    SELECT DISTINCT officer_id
    FROM eoc_team_members
    WHERE session_team_id = ? AND is_active = 1
  `, [sessionTeamId]);
  for (const member of members) {
    if (excludeUserId && Number(member.officer_id) === Number(excludeUserId)) continue;
    await execute(`
      INSERT INTO eoc_notifications
        (recipient_user_id, notification_type, title, detail, target_url,
         eoc_session_id, related_type, related_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `, [member.officer_id, type, title, detail || null, targetUrl || null, sessionId, relatedType || null, relatedId || null]);
  }
}

