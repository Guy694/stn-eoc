import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { appendAuditLog } from "@/lib/auditLog";
import { getOperationalSessionAccess } from "@/lib/eocOperationalAccess";
import { parsePositiveInteger, validateMissionInput, validateMissionTransition } from "@/lib/eocValidation";
import { RESOURCE_CONFIG } from "../route";

export async function PATCH(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const id = parsePositiveInteger((await params).resourceId);
    const body = await request.json();
    const config = RESOURCE_CONFIG[body.type];
    const sessionId = parsePositiveInteger(body.session_id);
    if (!id || !config || !sessionId) return NextResponse.json({ success: false, message: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    const access = await getOperationalSessionAccess(auth.user, sessionId, "flood");
    if (!access.ok) return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    if (!access.canOperate) return NextResponse.json({ success: false, message: "Session ปิดแล้ว งานปฏิบัติการอยู่ในโหมดอ่านอย่างเดียว" }, { status: 403 });
    const rows = await query(`SELECT * FROM ${config.table} WHERE id = ? AND session_id = ? LIMIT 1`, [id, sessionId]);
    if (!rows.length) return NextResponse.json({ success: false, message: "ไม่พบข้อมูล" }, { status: 404 });
    const old = rows[0];
    const values = Object.fromEntries(config.fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
    if (!Object.keys(values).length) return NextResponse.json({ success: false, message: "ไม่มีข้อมูลที่ต้องแก้ไข" }, { status: 400 });
    if (body.type === "meetings") {
      ["attendees", "key_issues", "decisions"].forEach((field) => {
        if (values[field] !== undefined) values[field] = values[field] === null ? null : JSON.stringify(values[field]);
      });
    }
    if (body.type === "missions") {
      const validation = validateMissionInput(values, { partial: true });
      if (!validation.ok) return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
      if (values.status && !validateMissionTransition(old.status, values.status)) {
        return NextResponse.json({ success: false, message: `ไม่สามารถเปลี่ยนสถานะจาก ${old.status} เป็น ${values.status}` }, { status: 409 });
      }
      if (["verified", "closed"].includes(values.status) && !access.canVerify) {
        return NextResponse.json({ success: false, message: "เฉพาะผู้บัญชาการหรือผู้ดูแลระบบเท่านั้นที่ยืนยันหรือปิดภารกิจได้" }, { status: 403 });
      }
      if (values.status && values.status !== old.status && !String(body.reason || "").trim()) {
        return NextResponse.json({ success: false, message: "กรุณาระบุเหตุผลการเปลี่ยนสถานะ" }, { status: 400 });
      }
      if (values.status && values.status !== old.status) {
        values.status_reason = body.reason.trim();
        values.status_changed_by = auth.user.id;
        values.status_changed_at = new Date();
        if (values.status === "verified") {
          values.verified_by = auth.user.id;
          values.verified_at = new Date();
        }
      }
    }
    if (body.type === "decisions" && old.linked_mission_id && body.cancel === true) {
      if (!String(body.reason || "").trim()) return NextResponse.json({ success: false, message: "กรุณาระบุเหตุผลการยกเลิก" }, { status: 400 });
      values.status = "cancelled";
      values.cancelled_by = auth.user.id;
      values.cancelled_at = new Date();
      values.cancellation_reason = body.reason.trim();
    }
    const fields = Object.keys(values);
    await transaction(async (execute) => {
      await execute(`UPDATE ${config.table} SET ${fields.map((field) => `${field} = ?`).join(", ")} WHERE id = ? AND session_id = ?`, [...Object.values(values), id, sessionId]);
      await appendAuditLog(execute, {
        request, user: auth.user, action: "data_update", targetType: config.table,
        targetId: id, sessionId, sessionTeamId: values.assigned_team_id || old.assigned_team_id || null,
        description: `แก้ไขข้อมูล ${config.table}`, oldValues: old, newValues: values, reason: body.reason || null,
      });
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Operational resource PATCH error:", error);
    return publicInternalError("ไม่สามารถแก้ไขข้อมูลได้");
  }
}
