import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query } from "@/lib/db";
import {
  bangkokTodayKey,
  getFloodDailyData,
  parseDateKey,
  parsePositiveId,
  resolveFloodSessionAccess,
} from "@/lib/eocFloodDaily";

function reportStatus(status) {
  return {
    draft: "Draft",
    submitted: "Submitted",
    approved: "Approved",
    returned: "Incomplete",
  }[status] || "Not Started";
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { searchParams } = new URL(request.url);
    const requestedSessionId = searchParams.get("session_id") || searchParams.get("sessionId");
    const requestedDate = searchParams.get("report_date") || searchParams.get("date");
    if (requestedSessionId && !parsePositiveId(requestedSessionId)) {
      return NextResponse.json({ success: false, message: "session_id ไม่ถูกต้อง" }, { status: 400 });
    }
    if (requestedDate && !parseDateKey(requestedDate)) {
      return NextResponse.json({ success: false, message: "วันที่รายงานไม่ถูกต้อง" }, { status: 400 });
    }

    const access = await resolveFloodSessionAccess(auth.user, requestedSessionId);
    if (!access.ok) {
      return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    }

    let daily = await getFloodDailyData({
      sessionId: access.sessionId,
      reportDate: requestedDate || bangkokTodayKey(),
    });
    if (!requestedDate && !daily.details.length && daily.availableDates[0]) {
      daily = await getFloodDailyData({
        sessionId: access.sessionId,
        reportDate: daily.availableDates[0],
      });
    }

    const teams = await query(`
      SELECT st.id AS session_team_id, t.team_code, t.team_name_th,
             CONCAT(COALESCE(lead_officer.title, ''), lead_officer.given_name, ' ', lead_officer.family_name) AS lead,
             COUNT(DISTINCT tm.id) AS member_count,
             latest_report.id AS report_id,
             latest_report.status AS report_status,
             latest_report.updated_at AS report_updated_at
      FROM eoc_session_teams st
      JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = TRUE
      LEFT JOIN officer lead_officer ON lead_officer.id = st.team_lead_officer_id
      LEFT JOIN eoc_team_members tm ON tm.session_team_id = st.id AND tm.is_active = TRUE
      LEFT JOIN eoc_team_reports latest_report
        ON latest_report.id = (
          SELECT report.id
          FROM eoc_team_reports report
          WHERE report.eoc_session_id = st.eoc_session_id
            AND report.session_team_id = st.id
            AND DATE(report.report_date) = ?
          ORDER BY report.updated_at DESC, report.id DESC
          LIMIT 1
        )
      WHERE st.eoc_session_id = ? AND st.is_active = TRUE
      GROUP BY st.id, t.team_code, t.team_name_th, lead_officer.title,
               lead_officer.given_name, lead_officer.family_name,
               latest_report.id, latest_report.status, latest_report.updated_at
      ORDER BY t.sort_order
    `, [daily.reportDate, access.sessionId]);

    const teamInputs = teams.map((team) => ({
      id: team.session_team_id,
      team_code: team.team_code,
      team_name: team.team_name_th,
      member_count: Number(team.member_count || 0),
      raw_status: reportStatus(team.report_status),
      submitted_at: team.report_updated_at,
      report_id: team.report_id,
    }));
    const submittedCount = teamInputs.filter((item) => item.raw_status !== "Not Started").length;
    const totalTeams = teamInputs.length;
    const stats = daily.totalStats;

    return NextResponse.json({
      success: true,
      data_mode: "database",
      report_date: daily.reportDate,
      availableDates: daily.availableDates,
      permissions: {
        canView: access.canView,
        canOperate: access.canOperate,
        canReport: access.canReport,
        canSubmit: access.canSubmit,
        canReview: access.canReview,
      },
      session: {
        ...daily.session,
        session_name: `EOC อุทกภัย ครั้งที่ ${daily.session.session_number}`,
        session_code: `FLOOD-${daily.session.id}`,
        eoc_status: daily.session.status === "active" ? "กำลังเปิดใช้งาน" : "ปิดแล้ว",
      },
      selected_summary: {
        report_date: daily.reportDate,
        affected_districts: stats.affected_districts,
        affected_subdistricts: stats.affected_tambons,
        affected_villages: stats.affected_villages,
        affected_households: stats.total_households,
        affected_population: stats.total_population,
        severe_count: stats.severe_count,
        moderate_count: stats.moderate_count,
        submitted_team_count: submittedCount,
        missing_team_count: Math.max(totalTeams - submittedCount, 0),
        data_completeness_score: totalTeams ? Math.round((submittedCount / totalTeams) * 100) : 0,
      },
      current_flood_reports: daily.details,
      district_summary: daily.districtSummary,
      risk_summary: daily.riskSummary,
      teams,
      current_team_inputs: teamInputs,
    });
  } catch (error) {
    console.error("Flood EOC Management API error:", error);
    return publicInternalError("ไม่สามารถโหลดข้อมูล Flood EOC Management ได้");
  }
}
