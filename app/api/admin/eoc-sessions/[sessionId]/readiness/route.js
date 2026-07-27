import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin", "commander"]);
    if (!auth.success) return auth.response;
    const { sessionId } = await params;
    const rows = await query(`
      SELECT st.id AS session_team_id, t.team_code, t.team_name_th,
             st.team_lead_officer_id,
             COUNT(DISTINCT CASE WHEN member.is_active = 1 THEN member.officer_id END) AS member_count,
             SUM(CASE WHEN member.is_active = 1 AND (
               COALESCE(officer.is_approved, 0) = 0
               OR officer.password_hash IS NULL
               OR officer.account_locked_until > NOW()
             ) THEN 1 ELSE 0 END) AS unavailable_member_count
      FROM eoc_session_teams st
      JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = 1
      LEFT JOIN eoc_team_members member ON member.session_team_id = st.id
      LEFT JOIN officer ON officer.id = member.officer_id
      WHERE st.eoc_session_id = ? AND st.is_active = 1
      GROUP BY st.id, t.team_code, t.team_name_th, st.team_lead_officer_id
      ORDER BY t.sort_order, t.team_code
    `, [sessionId]);
    const leadRows = await query(`
      SELECT team_lead_officer_id, COUNT(*) AS team_count
      FROM eoc_session_teams
      WHERE eoc_session_id = ? AND is_active = 1 AND team_lead_officer_id IS NOT NULL
      GROUP BY team_lead_officer_id HAVING COUNT(*) > 1
    `, [sessionId]);
    const duplicateLeads = new Map(leadRows.map((row) => [Number(row.team_lead_officer_id), Number(row.team_count)]));
    const teams = rows.map((row) => {
      const issues = [];
      if (!row.team_lead_officer_id) issues.push("ยังไม่มีหัวหน้าทีม");
      if (!Number(row.member_count)) issues.push("ยังไม่มีสมาชิก");
      if (Number(row.unavailable_member_count)) issues.push(`สมาชิกไม่พร้อมเข้าใช้ ${Number(row.unavailable_member_count)} คน`);
      if (duplicateLeads.has(Number(row.team_lead_officer_id))) issues.push(`หัวหน้าคนเดียวดูแล ${duplicateLeads.get(Number(row.team_lead_officer_id))} ทีม`);
      return { ...row, member_count: Number(row.member_count), unavailable_member_count: Number(row.unavailable_member_count), ready: issues.length === 0, issues };
    });
    return NextResponse.json({
      success: true,
      data: {
        session_id: Number(sessionId),
        ready: teams.length > 0 && teams.every((team) => team.ready),
        team_count: teams.length,
        ready_team_count: teams.filter((team) => team.ready).length,
        teams,
      },
    });
  } catch (error) {
    console.error("Session readiness error:", error);
    return publicInternalError("ไม่สามารถตรวจความพร้อมของ Session ได้");
  }
}
