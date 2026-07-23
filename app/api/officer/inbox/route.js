import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const userId = auth.user.id;
    const privileged = ["admin", "commander"].includes(auth.user.role);
    const membershipJoin = privileged
      ? ""
      : "JOIN eoc_team_members member ON member.session_team_id = st.id AND member.officer_id = ? AND member.is_active = 1";
    const baseParams = privileged ? [] : [userId];
    const [sessions, reports, missions, decisions, meetings, notifications] = await Promise.all([
      query(`
        SELECT DISTINCT s.id, s.eoc_type, s.session_number, s.status, s.opened_at, s.closed_at,
               t.team_code, t.team_name_th, st.id AS session_team_id
        FROM eoc_sessions s
        JOIN eoc_session_teams st ON st.eoc_session_id = s.id AND st.is_active = 1
        JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = 1
        ${membershipJoin}
        WHERE s.status IN ('active','closed')
        ORDER BY s.status = 'active' DESC, s.opened_at DESC
        LIMIT 100
      `, baseParams),
      query(`
        SELECT r.id, r.title, r.status, r.report_date, r.eoc_session_id, r.session_team_id, r.team_code
        FROM eoc_team_reports r
        ${privileged ? "" : "JOIN eoc_team_members member ON member.session_team_id = r.session_team_id AND member.officer_id = ? AND member.is_active = 1"}
        WHERE r.status IN ('draft','returned','submitted','verified')
        ORDER BY (r.status = 'returned') DESC, r.report_date DESC
        LIMIT 50
      `, baseParams),
      query(`
        SELECT m.id, m.mission_code, m.mission_name, m.status, m.priority, m.progress_percent,
               m.due_at, m.session_id
        FROM missions m
        WHERE ${privileged ? "1=1" : "(m.responsible_officer_id = ? OR EXISTS (SELECT 1 FROM eoc_team_members etm WHERE etm.session_team_id = m.assigned_team_id AND etm.officer_id = ? AND etm.is_active = 1))"}
          AND m.status NOT IN ('closed')
        ORDER BY m.due_at IS NULL, m.due_at, m.priority DESC
        LIMIT 50
      `, privileged ? [] : [userId, userId]),
      query(`
        SELECT d.id, d.issue, d.decision, d.status, d.followup_due, d.session_id, d.linked_mission_id
        FROM decision_logs d
        WHERE d.cancelled_at IS NULL
          AND (${privileged ? "1=1" : "EXISTS (SELECT 1 FROM missions m LEFT JOIN eoc_team_members etm ON etm.session_team_id = m.assigned_team_id AND etm.is_active = 1 WHERE m.id = d.linked_mission_id AND (m.responsible_officer_id = ? OR etm.officer_id = ?))"})
        ORDER BY d.followup_due IS NULL, d.followup_due
        LIMIT 30
      `, privileged ? [] : [userId, userId]),
      query(`
        SELECT mn.id, mn.meeting_date, mn.meeting_time, mn.agenda, mn.next_meeting_datetime, mn.session_id
        FROM meeting_notes mn
        WHERE COALESCE(mn.next_meeting_datetime, TIMESTAMP(mn.meeting_date, mn.meeting_time)) >= NOW()
          AND (${privileged ? "1=1" : "EXISTS (SELECT 1 FROM eoc_session_teams st JOIN eoc_team_members etm ON etm.session_team_id = st.id AND etm.officer_id = ? AND etm.is_active = 1 WHERE st.eoc_session_id = mn.session_id)"})
        ORDER BY COALESCE(mn.next_meeting_datetime, TIMESTAMP(mn.meeting_date, mn.meeting_time))
        LIMIT 20
      `, privileged ? [] : [userId]),
      query(`
        SELECT id, notification_type, title, detail, target_url, eoc_session_id, created_at
        FROM eoc_notifications
        WHERE recipient_user_id = ? AND is_read = 0
        ORDER BY created_at DESC
        LIMIT 30
      `, [userId]),
    ]);
    const today = new Date();
    const soon = new Date(today.getTime() + 48 * 60 * 60 * 1000);
    return NextResponse.json({
      success: true,
      data: { sessions, reports, missions, decisions, meetings, notifications },
      summary: {
        assigned_sessions: new Set(sessions.map((row) => row.id)).size,
        assigned_teams: sessions.length,
        returned_reports: reports.filter((row) => row.status === "returned").length,
        due_soon_missions: missions.filter((row) => row.due_at && new Date(row.due_at) <= soon).length,
        overdue_missions: missions.filter((row) => row.due_at && new Date(row.due_at) < today).length,
        unread_notifications: notifications.length,
      },
      meta: { source_type: "database", generated_at: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Officer inbox GET error:", error);
    return publicInternalError("ไม่สามารถโหลดกล่องงานเจ้าหน้าที่ได้");
  }
}
