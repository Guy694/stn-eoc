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
  for (const item of definition.fields) {
    const value = payload[item.name];
    if (item.required && (value === undefined || value === null || String(value).trim() === "")) return `กรุณากรอก ${item.label}`;
    if (value !== undefined && value !== null && String(value).length > 10000) return `${item.label} มีข้อมูลยาวเกินกำหนด`;
  }
  return null;
}

function parseReportDate(value) {
  if (!value) return new Date();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export async function GET(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { sessionId, sessionTeamId } = await params;
    const access = await getSessionTeamAccess(auth.user, sessionId, sessionTeamId);
    if (!access.ok) return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    const searchParams = new URL(request.url).searchParams;
    const status = searchParams.get("status");
    const search = searchParams.get("search")?.trim();
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");
    const conditions = ["r.eoc_session_id = ?", "r.session_team_id = ?"];
    const values = [sessionId, sessionTeamId];
    if (status) { conditions.push("r.status = ?"); values.push(status); }
    if (search) { conditions.push("(r.title LIKE ? OR r.report_type LIKE ? OR creator.given_name LIKE ? OR creator.family_name LIKE ?)"); const wildcard = `%${search}%`; values.push(wildcard, wildcard, wildcard, wildcard); }
    if (dateFrom) { conditions.push("DATE(r.report_date) >= ?"); values.push(dateFrom); }
    if (dateTo) { conditions.push("DATE(r.report_date) <= ?"); values.push(dateTo); }
    const reports = await query(`
      SELECT r.*, CONCAT(COALESCE(creator.title,''), creator.given_name, ' ', creator.family_name) AS created_by_name,
             CONCAT(COALESCE(updater.title,''), updater.given_name, ' ', updater.family_name) AS updated_by_name
      FROM eoc_team_reports r
      LEFT JOIN officer creator ON creator.id = r.created_by
      LEFT JOIN officer updater ON updater.id = r.updated_by
      WHERE ${conditions.join(" AND ")}
      ORDER BY r.report_date DESC, r.updated_at DESC
    `, values);
    const summaryRows = await query(`SELECT status, COUNT(*) AS count FROM eoc_team_reports WHERE eoc_session_id = ? AND session_team_id = ? GROUP BY status`, [sessionId, sessionTeamId]);
    const summary = { total: 0, draft: 0, submitted: 0, verified: 0, approved: 0, returned: 0 };
    summaryRows.forEach((row) => { summary[row.status] = Number(row.count); summary.total += Number(row.count); });
    return NextResponse.json({
      success: true,
      session: access.context,
      permissions: { canWrite: access.canReport, canSubmit: access.canSubmit, canReview: access.canReview },
      summary,
      data: reports.map((report) => ({
        ...report,
        payload: typeof report.payload === "string" ? JSON.parse(report.payload) : report.payload,
        permissions: {
          canEdit: access.canReport
            && ["draft", "returned"].includes(report.status)
            && (access.isPrivileged || access.isTeamLead || Number(report.created_by) === Number(auth.user.id)),
          canSubmit: access.canSubmit && ["draft", "returned"].includes(report.status),
          canVerify: access.canReview && report.status === "submitted",
          canApprove: access.canApprove && report.status === "verified",
          canReturn: access.canReview && ["submitted", "verified"].includes(report.status),
        },
      })),
    });
  } catch (error) {
    console.error("Error loading team reports:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการโหลดรายงานกลุ่มภารกิจ");
  }
}

export async function POST(request, { params }) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { sessionId, sessionTeamId } = await params;
    const access = await getSessionTeamAccess(auth.user, sessionId, sessionTeamId);
    if (!access.ok) return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    if (!access.canReport) return NextResponse.json({ success: false, message: "ไม่สามารถสร้างรายงานใน Session นี้ได้" }, { status: 409 });
    const body = await request.json();
    const teamCode = normalizeTeamCode(access.context.team_code);
    const validationError = validatePayload(teamCode, body.payload);
    if (!body.title?.trim() || validationError) return NextResponse.json({ success: false, message: validationError || "กรุณาระบุหัวข้อรายงาน" }, { status: 400 });
    const reportDate = parseReportDate(body.reportDate);
    if (!reportDate) return NextResponse.json({ success: false, message: "วันเวลารายงานไม่ถูกต้อง" }, { status: 400 });
    if (!isReportDateWithinSession(access.context, reportDate)) return NextResponse.json({ success: false, message: "วันเวลารายงานต้องอยู่ในช่วงเปิด–ปิด Session" }, { status: 400 });
    const reportId = await transaction(async (execute) => {
      const result = await execute(`
        INSERT INTO eoc_team_reports
          (eoc_session_id, session_team_id, team_code, report_date, report_type, title, status, payload, created_by, updated_by)
        VALUES (?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?)
      `, [sessionId, sessionTeamId, access.context.team_code, reportDate, body.reportType || "periodic", body.title.trim(), JSON.stringify(body.payload), auth.user.id, auth.user.id]);
      await writeTeamReportAudit(auth.user, access.context, result.insertId, "data_create", { description: "สร้างรายงานฉบับร่าง" }, execute);
      return result.insertId;
    });
    return NextResponse.json({ success: true, id: reportId, message: "บันทึกร่างเรียบร้อย" }, { status: 201 });
  } catch (error) {
    console.error("Error creating team report:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการสร้างรายงานกลุ่มภารกิจ");
  }
}
