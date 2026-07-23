import { NextResponse } from "next/server";
import { query, transaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getSessionTeamAccess, isReportDateWithinSession, writeTeamReportAudit } from "@/lib/eocTeamAccess";
import { getTeamReportDefinition } from "@/src/features/eoc/registries/team-report-definition.registry";
import { normalizeTeamCode } from "@/src/features/eoc/registries/team.registry";

function validatePayload(teamCode, payload) {
  const definition = getTeamReportDefinition(teamCode);
  if (!definition || !payload || typeof payload !== "object" || Array.isArray(payload)) return "รูปแบบข้อมูลรายงานไม่ถูกต้อง";
  const missingField = definition.fields.find((field) => field.required && (payload[field.name] === undefined || payload[field.name] === null || String(payload[field.name]).trim() === ""));
  if (missingField) return `กรุณากรอก ${missingField.label}`;
  const oversizedField = definition.fields.find((field) => payload[field.name] !== undefined && payload[field.name] !== null && String(payload[field.name]).length > 10000);
  return oversizedField ? `${oversizedField.label} มีข้อมูลยาวเกินกำหนด` : null;
}

function parseReportDate(value, fallback) {
  const date = value ? new Date(value) : new Date(fallback);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function PUT(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { sessionId, sessionTeamId, reportId } = await params;
    const parsedReportId = Number(reportId);
    if (!Number.isInteger(parsedReportId) || parsedReportId <= 0) return NextResponse.json({ success: false, message: "reportId ไม่ถูกต้อง" }, { status: 400 });
    const access = await getSessionTeamAccess(auth.user, sessionId, sessionTeamId);
    if (!access.ok) return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    if (!access.canReport) return NextResponse.json({ success: false, message: "ไม่สามารถแก้ไขรายงานใน Session นี้ได้" }, { status: 409 });
    const reports = await query(`SELECT * FROM eoc_team_reports WHERE id = ? AND eoc_session_id = ? AND session_team_id = ? LIMIT 1`, [parsedReportId, sessionId, sessionTeamId]);
    if (!reports.length) return NextResponse.json({ success: false, message: "ไม่พบรายงาน" }, { status: 404 });
    const report = reports[0];
    if (!["draft", "returned"].includes(report.status)) return NextResponse.json({ success: false, message: "แก้ไขได้เฉพาะรายงานร่างหรือรายงานที่ถูกส่งกลับ" }, { status: 409 });
    if (!access.isPrivileged && !access.isTeamLead && Number(report.created_by) !== Number(auth.user.id)) return NextResponse.json({ success: false, message: "แก้ไขได้เฉพาะรายงานของตนเอง" }, { status: 403 });
    const body = await request.json();
    const storedPayload = typeof report.payload === "string" ? JSON.parse(report.payload) : report.payload;
    const nextPayload = body.payload || storedPayload;
    const validationError = validatePayload(normalizeTeamCode(access.context.team_code), nextPayload);
    if (validationError) return NextResponse.json({ success: false, message: validationError }, { status: 400 });
    const reportDate = parseReportDate(body.reportDate, report.report_date);
    if (!reportDate) return NextResponse.json({ success: false, message: "วันเวลารายงานไม่ถูกต้อง" }, { status: 400 });
    if (!isReportDateWithinSession(access.context, reportDate)) return NextResponse.json({ success: false, message: "วันเวลารายงานต้องอยู่ในช่วงเปิด–ปิด Session" }, { status: 400 });
    await transaction(async (execute) => {
      await execute(`UPDATE eoc_team_reports SET title = ?, report_date = ?, report_type = ?, payload = ?, status = 'draft', updated_by = ? WHERE id = ?`, [body.title || report.title, reportDate, body.reportType || report.report_type, JSON.stringify(nextPayload), auth.user.id, parsedReportId]);
      await writeTeamReportAudit(auth.user, access.context, parsedReportId, "data_update", { description: "แก้ไขรายงาน" }, execute);
    });
    return NextResponse.json({ success: true, message: "แก้ไขรายงานเรียบร้อย" });
  } catch (error) {
    console.error("Error updating team report:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการแก้ไขรายงาน");
  }
}
