import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { normalizeEocType } from "@/src/features/eoc/registries/eoc-type.registry";
import { getTeam, normalizeTeamCode } from "@/src/features/eoc/registries/team.registry";

function parseSessionId(value) {
  if (!value) return null;
  const sessionId = Number(value);
  return Number.isInteger(sessionId) && sessionId > 0 ? sessionId : null;
}

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const routeParams = await params;
    const eocType = normalizeEocType(routeParams.type);
    const teamCode = normalizeTeamCode(routeParams.teamCode);
    const teamConfig = getTeam(teamCode);
    if (!eocType || !teamConfig) {
      return NextResponse.json({ success: false, message: "ประเภท EOC หรือกลุ่มภารกิจไม่ถูกต้อง" }, { status: 400 });
    }

    const requestedSessionValue = new URL(request.url).searchParams.get("sessionId");
    const sessionId = parseSessionId(requestedSessionValue);
    if (requestedSessionValue && !sessionId) {
      return NextResponse.json({ success: false, message: "sessionId ไม่ถูกต้อง" }, { status: 400 });
    }

    const databaseEocType = eocType === "dengue" ? "disease" : eocType;
    const sessionCondition = sessionId ? "AND s.id = ?" : "";
    const sessionParams = sessionId
      ? [databaseEocType, teamConfig.legacyCode, sessionId]
      : [databaseEocType, teamConfig.legacyCode];
    const sessionTeams = await query(`
      SELECT
        s.id AS session_id,
        s.session_number,
        s.eoc_type,
        s.status AS session_status,
        s.opened_at,
        s.closed_at,
        st.id AS session_team_id,
        t.team_code,
        t.team_name_th,
        t.team_name_en,
        st.team_lead_officer_id,
        CONCAT(COALESCE(team_lead.title, ''), team_lead.given_name, ' ', team_lead.family_name) AS team_lead_name
      FROM eoc_sessions s
      JOIN eoc_session_teams st ON st.eoc_session_id = s.id AND st.is_active = TRUE
      JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = TRUE
      LEFT JOIN officer team_lead ON team_lead.id = st.team_lead_officer_id
      WHERE s.eoc_type = ?
        AND t.team_code = ?
        ${sessionCondition}
        AND EXISTS (
          SELECT 1 FROM eoc_team_members active_member
          WHERE active_member.session_team_id = st.id AND active_member.is_active = TRUE
        )
      ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END, s.opened_at DESC, s.id DESC
      LIMIT 1
    `, sessionParams);

    if (!sessionTeams.length) {
      return NextResponse.json({ success: false, message: "ไม่พบกลุ่มภารกิจหรือสมาชิกใน Session ที่ระบุ" }, { status: 404 });
    }

    const selected = sessionTeams[0];
    const privileged = ["admin", "commander"].includes(auth.user.role);
    if (!privileged) {
      const memberships = await query(`
        SELECT id FROM eoc_team_members
        WHERE session_team_id = ? AND officer_id = ? AND is_active = TRUE
        LIMIT 1
      `, [selected.session_team_id, auth.user.id]);
      if (!memberships.length) {
        return NextResponse.json({ success: false, message: "ไม่มีสิทธิ์ดูสมาชิกกลุ่มภารกิจนี้" }, { status: 403 });
      }
    }

    const members = await query(`
      SELECT
        tm.id,
        tm.officer_id,
        o.username,
        o.title,
        o.given_name,
        o.family_name,
        o.position,
        o.department,
        o.role AS officer_role,
        tm.role_in_team,
        tm.assigned_at,
        CASE WHEN st.team_lead_officer_id = o.id THEN TRUE ELSE FALSE END AS is_team_lead
      FROM eoc_team_members tm
      JOIN eoc_session_teams st ON st.id = tm.session_team_id
      JOIN officer o ON o.id = tm.officer_id
      WHERE tm.session_team_id = ? AND tm.is_active = TRUE
      ORDER BY
        CASE WHEN st.team_lead_officer_id = o.id THEN 0 ELSE 1 END,
        CASE tm.role_in_team WHEN 'หัวหน้าทีม' THEN 1 WHEN 'รองหัวหน้าทีม' THEN 2 ELSE 3 END,
        o.given_name, o.family_name
    `, [selected.session_team_id]);

    return NextResponse.json({
      success: true,
      session: {
        id: selected.session_id,
        session_number: selected.session_number,
        eoc_type: selected.eoc_type,
        status: selected.session_status,
        opened_at: selected.opened_at,
        closed_at: selected.closed_at,
      },
      team: {
        session_team_id: selected.session_team_id,
        team_code: selected.team_code,
        team_name_th: selected.team_name_th,
        team_name_en: selected.team_name_en,
        team_lead_officer_id: selected.team_lead_officer_id,
        team_lead_name: selected.team_lead_name,
        member_count: members.length,
        members,
      },
    });
  } catch (error) {
    console.error("Error fetching EOC team members:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิกกลุ่มภารกิจ");
  }
}
