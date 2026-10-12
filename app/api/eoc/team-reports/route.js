import { NextResponse } from "next/server";
import { modulePermissions, requireModuleEdit } from "@/lib/eocModuleAccess";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { resolveEventSession } from "@/lib/eocBriefData";
import { recordChange } from "@/lib/recordArchive";
import { SATUN_DISTRICT_NAMES } from "@/lib/satunDistricts";
import { TEAM_REPORT_TYPES, parseMetrics, summarizeTeamReports, teamReportModule, validateTeamReport } from "@/lib/teamDailyReports";

// รายงานประจำวันรายอำเภอ (MCATT / หน่วยแพทย์ / MERT / Doxy / แจกจ่ายทรัพยากร) ของเหตุการณ์ EOC
const SUPPORTED = ["flood", "disease"];
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const bangkokToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const userName = (user) => [user?.givenName, user?.familyName].filter(Boolean).join(" ") || user?.username || null;

async function context(request) {
  const params = new URL(request.url).searchParams;
  const eocType = params.get("eoc") || "flood";
  if (!SUPPORTED.includes(eocType)) return { error: bad("ประเภท EOC ไม่ถูกต้อง") };
  return { eocType, session: await resolveEventSession({ eocType, sessionId: params.get("session_id") }) };
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const ctx = await context(request);
    if (ctx.error) return ctx.error;
    if (!ctx.session) return NextResponse.json({ success: true, session: null, message: "ยังไม่มีเหตุการณ์ EOC" });
    let rows = [];
    let ready = true;
    try {
      rows = await query(
        `SELECT id, report_type, DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, district_name, metrics, area_note, note, reported_by_name, updated_at
         FROM eoc_team_daily_reports WHERE session_id = ? ORDER BY report_date DESC, district_name, area_note`, [ctx.session.id]);
    } catch (error) {
      if (error.code !== "ER_NO_SUCH_TABLE") throw error;
      ready = false;
    }
    const today = bangkokToday();
    // สิทธิ์แยกตามแบบรายงาน (MCATT/แพทย์/MERT = ทีมปฏิบัติการ, Doxy = ทีมควบคุมโรค, แจกจ่ายทรัพยากร = LOGISTICS)
    const modules = [...new Set(Object.keys(TEAM_REPORT_TYPES).map(teamReportModule))];
    const permsByModule = Object.fromEntries(await Promise.all(modules.map(async (key) => [key, await modulePermissions(auth.user, ctx.session.id, key)])));
    const active = ctx.session.status === "active";
    const byType = Object.fromEntries(Object.keys(TEAM_REPORT_TYPES).map((type) => {
      const perms = permsByModule[teamReportModule(type)];
      const canEdit = active && perms.can_edit;
      return [type, { can_edit: canEdit, read_only_message: canEdit ? null : perms.read_only_message }];
    }));
    return NextResponse.json({
      success: true,
      session: ctx.session,
      today,
      ready,
      districts: SATUN_DISTRICT_NAMES,
      reports: rows.map((row) => ({ ...row, metrics: parseMetrics(row.metrics) })),
      summary: summarizeTeamReports(rows, today),
      permissions: byType
    });
  } catch (error) {
    console.error("Team reports GET error:", error);
    return publicInternalError("ไม่สามารถโหลดรายงานทีมได้");
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const ctx = await context(request);
    if (ctx.error) return ctx.error;
    if (!ctx.session) return bad("ยังไม่มีเหตุการณ์ EOC", 404);
    if (ctx.session.status !== "active") return bad("เหตุการณ์นี้ปิดแล้ว ดูข้อมูลได้อย่างเดียว", 409);
    const body = await request.json().catch(() => ({}));
    const type = String(body.report_type || "");
    const config = TEAM_REPORT_TYPES[type];
    if (!config) return bad("ไม่รู้จักประเภทรายงาน");
    const gate = await requireModuleEdit(auth.user, ctx.session.id, teamReportModule(type));
    if (gate.response) return gate.response;
    const district = String(body.district_name || "").trim();
    if (district && !SATUN_DISTRICT_NAMES.includes(district)) return bad("อำเภอไม่ถูกต้อง");
    const reportDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.report_date || "")) ? body.report_date : bangkokToday();
    if (reportDate > bangkokToday()) return bad("วันที่รายงานต้องไม่เกินวันนี้");
    const checked = validateTeamReport(type, body);
    if (!checked.ok) return bad(checked.error);
    const areaNote = config.areaField ? String(body.area_note || "").trim().slice(0, 255) || null : null;
    // รายงานรายหน่วยบริการ: หน่วยเดียวกันวันเดียวกันแก้ไขทับ หน่วยอื่นในอำเภอเดียวกันเพิ่มได้
    const unitKey = config.perUnit ? (areaNote || "").slice(0, 150) : "";
    const previousUnit = config.perUnit ? String(body.previous_unit ?? "").trim().slice(0, 150) : "";
    const note = String(body.note || "").trim().slice(0, 1000) || null;

    // แก้ชื่อหน่วยบริการของรายงานเดิม: ลบแถวชื่อเดิมก่อน (ไม่ให้มีสองแถว)
    if (config.perUnit && previousUnit && previousUnit !== unitKey) {
      await query(`DELETE FROM eoc_team_daily_reports WHERE session_id = ? AND report_type = ? AND report_date = ? AND district_name = ? AND unit_key = ?`,
        [ctx.session.id, type, reportDate, district, previousUnit]);
    }
    const result = await query(
      `INSERT INTO eoc_team_daily_reports (session_id, report_type, report_date, district_name, unit_key, metrics, area_note, note, reported_by, reported_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE metrics = VALUES(metrics), area_note = VALUES(area_note), note = VALUES(note),
         reported_by = VALUES(reported_by), reported_by_name = VALUES(reported_by_name)`,
      [ctx.session.id, type, reportDate, district, unitKey, JSON.stringify(checked.metrics), areaNote, note, auth.user.id, userName(auth.user)]
    );
    await recordChange({
      request, user: auth.user, action: result.affectedRows === 1 ? "data_create" : "data_update", table: "eoc_team_daily_reports",
      id: result.insertId || null, sessionId: ctx.session.id,
      description: `รายงาน ${config.label} อ.${district}${unitKey ? ` (${unitKey})` : ""} วันที่ ${reportDate}`, newValues: checked.metrics
    });
    return NextResponse.json({ success: true, message: `บันทึกรายงาน ${config.label} อ.${district} แล้ว` });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") return bad("ยังไม่ได้ติดตั้งตารางรายงานทีมล่าสุด (รัน npm run db:migrate)", 503);
    console.error("Team reports POST error:", error);
    return publicInternalError("ไม่สามารถบันทึกรายงานทีมได้");
  }
}
