import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { loadEventBrief, resolveEventSession } from "@/lib/eocBriefData";
import { buildAgenda } from "@/lib/meetingBrief";
import { buildDistrictMatrix, buildKpis, headline } from "@/lib/situationBoard";
import { buildSetupChecklist } from "@/lib/eventSetupChecklist";
import { alertSendingEnabled, telegramReady } from "@/lib/eocAlertRunner";
import { query } from "@/lib/db";

async function loadTeams(sessionId) {
  try {
    const rows = await query(
      `SELECT t.team_code AS code, t.team_name_th AS name, st.team_lead_officer_id AS lead_officer_id,
              (SELECT COUNT(*) FROM eoc_team_members m WHERE m.session_team_id = st.id AND m.is_active = TRUE) AS members
       FROM eoc_session_teams st JOIN eoc_teams t ON t.id = st.team_id AND t.is_active = TRUE
       WHERE st.eoc_session_id = ? AND st.is_active = TRUE`, [sessionId]);
    return rows.map((row) => ({ code: row.code, name: row.name, members: Number(row.members) || 0, hasLead: Boolean(row.lead_officer_id) }));
  } catch (error) {
    if (["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"].includes(error.code)) return [];
    throw error;
  }
}

// แผงสรุปสถานการณ์สำหรับหน้าภาพรวม: ตัวชี้วัดหลัก + เรื่องที่ต้องตัดสินใจ + ตารางรายอำเภอ + แนวโน้มผู้ป่วย
export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc") || "flood";
    const session = await resolveEventSession({ eocType, sessionId: params.get("session_id") });
    if (!session) return NextResponse.json({ success: true, session: null });
    const [brief, teams] = await Promise.all([loadEventBrief(session), loadTeams(session.id)]);
    const kpis = buildKpis(brief);
    const matrix = buildDistrictMatrix(brief);
    const agenda = buildAgenda(brief, `/eoc/${eocType}`);
    return NextResponse.json({
      success: true,
      session,
      generated_at: new Date().toISOString(),
      headline: headline(kpis, matrix),
      setup: session.status === "active"
        ? buildSetupChecklist(brief, { eocType, teams, telegram: { ready: telegramReady(), enabled: alertSendingEnabled() } })
        : null,
      kpis,
      matrix,
      agenda: agenda.slice(0, 8),
      agendaTotal: agenda.length,
      trend: (brief.health?.trend || []).slice(-14),
      directives: { date: brief.directives?.date || null, open: brief.directives?.open || 0, total: brief.directives?.items?.length || 0 },
      completeness: brief.completeness ? { percent: brief.completeness.percent, reported: brief.completeness.reported, total: brief.completeness.total } : null
    });
  } catch (error) {
    console.error("Situation board error:", error);
    return publicInternalError("ไม่สามารถโหลดสรุปสถานการณ์ได้");
  }
}
