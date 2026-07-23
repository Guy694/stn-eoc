import { NextResponse } from "next/server";
import { transaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getSessionTeamAccess, writeTeamReportAudit } from "@/lib/eocTeamAccess";

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
    const updated = await transaction(async (execute) => {
      const result = await execute(`UPDATE eoc_team_reports SET status = 'submitted', submitted_by = ?, submitted_at = NOW(), updated_by = ? WHERE id = ? AND eoc_session_id = ? AND session_team_id = ? AND status IN ('draft','returned')`, [auth.user.id, auth.user.id, parsedReportId, sessionId, sessionTeamId]);
      if (!result.affectedRows) return false;
      await writeTeamReportAudit(auth.user, access.context, parsedReportId, "data_update", { description: "ส่งรายงานเพื่อตรวจสอบ", workflow_action: "submit" }, execute);
      return true;
    });
    if (!updated) return NextResponse.json({ success: false, message: "ไม่พบรายงานหรือสถานะไม่สามารถส่งได้" }, { status: 409 });
    return NextResponse.json({ success: true, message: "ส่งรายงานเรียบร้อย" });
  } catch (error) {
    console.error("Error submitting team report:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการส่งรายงาน");
  }
}
