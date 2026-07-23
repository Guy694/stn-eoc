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
    if (!access.canReport) return NextResponse.json({ success: false, message: "ไม่สามารถตรวจรายงานใน Session นี้ได้" }, { status: 409 });
    if (!access.canReview) return NextResponse.json({ success: false, message: "เฉพาะผู้บัญชาการหรือผู้ดูแลระบบเท่านั้นที่ตรวจรายงานได้" }, { status: 403 });
    const body = await request.json();
    if (!["verified", "approved", "returned"].includes(body.status)) return NextResponse.json({ success: false, message: "สถานะการตรวจไม่ถูกต้อง" }, { status: 400 });
    const updated = await transaction(async (execute) => {
      const expectedStatus = body.status === "approved" ? "verified" : body.status === "verified" ? "submitted" : null;
      const workflowCondition = expectedStatus ? "status = ?" : "status IN ('submitted','verified')";
      const workflowParams = expectedStatus ? [expectedStatus] : [];
      const verificationFields = body.status === "verified"
        ? ", verified_by = ?, verified_at = NOW()"
        : body.status === "approved" ? ", approved_by = ?, approved_at = NOW()" : "";
      const verificationParams = body.status === "verified" || body.status === "approved" ? [auth.user.id] : [];
      const result = await execute(`
        UPDATE eoc_team_reports
        SET status = ?, reviewed_by = ?, reviewed_at = NOW(), review_comment = ?, updated_by = ?
            ${verificationFields}
        WHERE id = ? AND eoc_session_id = ? AND session_team_id = ? AND ${workflowCondition}
      `, [
        body.status, auth.user.id, body.comment || null, auth.user.id,
        ...verificationParams, parsedReportId, sessionId, sessionTeamId, ...workflowParams,
      ]);
      if (!result.affectedRows) return false;
      const descriptions = { verified: "ตรวจสอบรายงานแล้ว", approved: "อนุมัติรายงาน", returned: "ส่งรายงานกลับแก้ไข" };
      await writeTeamReportAudit(auth.user, access.context, parsedReportId, "data_update", { description: descriptions[body.status], workflow_action: body.status, comment: body.comment || null }, execute);
      const creators = await execute(`SELECT created_by, title FROM eoc_team_reports WHERE id = ? LIMIT 1`, [parsedReportId]);
      if (creators[0]?.created_by && Number(creators[0].created_by) !== Number(auth.user.id)) {
        await execute(`
          INSERT INTO eoc_notifications
            (recipient_user_id, notification_type, title, detail, target_url,
             eoc_session_id, related_type, related_id)
          VALUES (?, ?, ?, ?, ?, ?, 'eoc_team_report', ?)
        `, [
          creators[0].created_by, `report_${body.status}`,
          body.status === "returned" ? "รายงานถูกส่งกลับแก้ไข" : body.status === "verified" ? "รายงานผ่านการตรวจสอบ" : "รายงานได้รับอนุมัติ",
          creators[0].title, `/eoc/staff/${sessionId}/teams/${sessionTeamId}`,
          sessionId, parsedReportId,
        ]);
      }
      return true;
    });
    if (!updated) return NextResponse.json({ success: false, message: "ไม่พบรายงานหรือสถานะ workflow ไม่ถูกต้อง" }, { status: 409 });
    const messages = { verified: "ตรวจสอบรายงานเรียบร้อย", approved: "อนุมัติรายงานเรียบร้อย", returned: "ส่งกลับให้แก้ไขแล้ว" };
    return NextResponse.json({ success: true, message: messages[body.status] });
  } catch (error) {
    console.error("Error reviewing team report:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการตรวจรายงาน");
  }
}
