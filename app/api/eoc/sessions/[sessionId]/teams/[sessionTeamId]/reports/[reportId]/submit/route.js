import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getSessionTeamAccess, writeTeamReportAudit } from "@/lib/eocTeamAccess";
import { normalizeTeamCode } from "@/src/features/eoc/registries/team.registry";
import { validateTeamReportPayload } from "@/src/features/eoc/teams/shared/schemas/team-report-payload.schema";

export async function POST(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { sessionId, sessionTeamId, reportId } = await params;
    const parsedReportId = Number(reportId);
    if (!Number.isInteger(parsedReportId) || parsedReportId <= 0) return NextResponse.json({ success: false, message: "reportId ไม่ถูกต้อง" }, { status: 400 });
    const access = await getSessionTeamAccess(auth.user, sessionId, sessionTeamId);
    if (!access.ok) return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    if (!access.canReport) return NextResponse.json({ success: false, message: "ไม่สามารถส่งรายงานใน Session นี้ได้" }, { status: 409 });
    if (!access.canSubmit) return NextResponse.json({ success: false, message: "เฉพาะหัวหน้าทีมหรือผู้บัญชาการเท่านั้นที่ส่งรายงานได้" }, { status: 403 });
    const reports = await query(`SELECT payload FROM eoc_team_reports WHERE id = ? AND eoc_session_id = ? AND session_team_id = ? AND status IN ('draft','returned') LIMIT 1`, [parsedReportId, sessionId, sessionTeamId]);
    if (!reports.length) return NextResponse.json({ success: false, message: "ไม่พบรายงานหรือสถานะไม่สามารถส่งได้" }, { status: 409 });
    const payload = typeof reports[0].payload === "string" ? JSON.parse(reports[0].payload) : reports[0].payload;
    const validation = validateTeamReportPayload(normalizeTeamCode(access.context.team_code), payload, { requireComplete: true });
    if (!validation.success) return NextResponse.json({
      success: false,
      message: "รายงานยังไม่ครบถ้วน กรุณากรอกข้อมูลที่จำเป็นก่อนส่ง",
      fieldErrors: validation.fieldErrors,
      completeness: validation.completeness,
    }, { status: 400 });
    const updated = await transaction(async (execute) => {
      const result = await execute(`UPDATE eoc_team_reports SET status = 'submitted', submitted_by = ?, submitted_at = NOW(), updated_by = ? WHERE id = ? AND eoc_session_id = ? AND session_team_id = ? AND status IN ('draft','returned')`, [auth.user.id, auth.user.id, parsedReportId, sessionId, sessionTeamId]);
      if (!result.affectedRows) return false;
      await writeTeamReportAudit(auth.user, access.context, parsedReportId, "data_update", { description: "ส่งรายงานเพื่อตรวจสอบ", workflow_action: "submit" }, execute);
      const submittedReports = await execute(`SELECT title FROM eoc_team_reports WHERE id = ? LIMIT 1`, [parsedReportId]);
      await execute(`
        INSERT INTO eoc_notifications
          (recipient_user_id, notification_type, title, detail, target_url,
           eoc_session_id, related_type, related_id)
        SELECT officer.id, 'report_submitted', 'มีรายงานรอตรวจสอบ', ?, ?,
               ?, 'eoc_team_report', ?
        FROM officer
        WHERE officer.role IN ('admin', 'commander')
          AND COALESCE(officer.is_approved, 0) = 1
          AND officer.id <> ?
      `, [
        submittedReports[0]?.title || `รายงาน ${access.context.team_code}`,
        `/eoc/staff/${sessionId}/teams/${sessionTeamId}`,
        sessionId, parsedReportId, auth.user.id,
      ]);
      return true;
    });
    if (!updated) return NextResponse.json({ success: false, message: "ไม่พบรายงานหรือสถานะไม่สามารถส่งได้" }, { status: 409 });
    return NextResponse.json({ success: true, message: "ส่งรายงานเรียบร้อย" });
  } catch (error) {
    console.error("Error submitting team report:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการส่งรายงาน");
  }
}
