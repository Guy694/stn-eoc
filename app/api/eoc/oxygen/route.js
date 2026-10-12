import { NextResponse } from "next/server";
import { modulePermissions, requireModuleEdit } from "@/lib/eocModuleAccess";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { resolveEventSession } from "@/lib/eocBriefData";
import { recordChange } from "@/lib/recordArchive";
import { triggerEventAlerts } from "@/lib/eocAlertRunner";
import { facilityTypeInfo } from "@/lib/healthFacilityStatus";
import { formatDays, oxygenDays, summarizeOxygen, validateOxygenReport } from "@/lib/liquidOxygen";
import { OXYGEN_FIELDS as FIELDS, loadOxygenLatest } from "@/lib/liquidOxygenServer";

// ออกซิเจนเหลวของโรงพยาบาลในเหตุการณ์ EOC: รายงานล่าสุดของแต่ละแห่ง + ประวัติ 14 วัน
const SUPPORTED = ["flood", "disease"];
const MODULE = "oxygen";
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const bangkokToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);
const userName = (user) => [user?.givenName, user?.familyName].filter(Boolean).join(" ") || user?.username || null;

async function context(request) {
  const params = new URL(request.url).searchParams;
  const eocType = params.get("eoc") || "flood";
  if (!SUPPORTED.includes(eocType)) return { error: bad("ประเภท EOC ไม่ถูกต้อง") };
  const session = await resolveEventSession({ eocType, sessionId: params.get("session_id") });
  return { eocType, session };
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const ctx = await context(request);
    if (ctx.error) return ctx.error;
    if (!ctx.session) return NextResponse.json({ success: true, session: null, message: "ยังไม่มีเหตุการณ์ EOC" });

    let latest = [];
    let history = [];
    let ready = true;
    try {
      [latest, history] = await Promise.all([
        loadOxygenLatest(ctx.session.id),
        query(
          `SELECT r.health_facility_id, DATE_FORMAT(r.report_date, '%Y-%m-%d') AS report_date, ${FIELDS}
           FROM liquid_oxygen_reports r WHERE r.session_id = ? AND r.report_date >= DATE_SUB(CURDATE(), INTERVAL 14 DAY)
           ORDER BY r.report_date`, [ctx.session.id])
      ]);
    } catch (error) {
      if (error.code !== "ER_NO_SUCH_TABLE") throw error;
      ready = false;
    }
    const facilities = (await query(`SELECT id, name, district_name, typecode FROM health_facilities WHERE is_active = 1 ORDER BY district_name, name`))
      .map((row) => ({ id: row.id, name: row.name, district_name: row.district_name, hospital: facilityTypeInfo(row.typecode).level === "hospital" }));
    const perms = await modulePermissions(auth.user, ctx.session.id, MODULE);
    const canEdit = ctx.session.status === "active" && perms.can_edit;
    return NextResponse.json({
      success: true,
      session: ctx.session,
      today: bangkokToday(),
      ready,
      summary: summarizeOxygen(latest),
      history: history.map((row) => ({ health_facility_id: row.health_facility_id, report_date: row.report_date, total: oxygenDays(row).total })),
      facilities,
      permissions: { can_edit: canEdit, read_only_message: canEdit ? null : perms.read_only_message }
    });
  } catch (error) {
    console.error("Oxygen GET error:", error);
    return publicInternalError("ไม่สามารถโหลดข้อมูลออกซิเจนเหลวได้");
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
    const gate = await requireModuleEdit(auth.user, ctx.session.id, MODULE);
    if (gate.response) return gate.response;

    const body = await request.json().catch(() => ({}));
    const facilityId = Number(body.health_facility_id);
    if (!Number.isInteger(facilityId) || facilityId <= 0) return bad("กรุณาเลือกโรงพยาบาล");
    const reportDate = /^\d{4}-\d{2}-\d{2}$/.test(String(body.report_date || "")) ? body.report_date : bangkokToday();
    if (reportDate > bangkokToday()) return bad("วันที่รายงานต้องไม่เกินวันนี้");
    const checked = validateOxygenReport(body);
    if (!checked.ok) return bad(checked.error);
    const facility = (await query(`SELECT id, name FROM health_facilities WHERE id = ? LIMIT 1`, [facilityId]))[0];
    if (!facility) return bad("ไม่พบหน่วยบริการ");

    const v = checked.value;
    const values = [v.tank_qty, v.tank_use_per_day, v.big_qty, v.big_use_per_day, v.small_qty, v.small_use_per_day, v.procurement_problem, v.problem_note];
    const result = await query(
      `INSERT INTO liquid_oxygen_reports (session_id, health_facility_id, report_date, ${FIELDS}, reported_by, reported_by_name)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE tank_qty = VALUES(tank_qty), tank_use_per_day = VALUES(tank_use_per_day), big_qty = VALUES(big_qty),
         big_use_per_day = VALUES(big_use_per_day), small_qty = VALUES(small_qty), small_use_per_day = VALUES(small_use_per_day),
         procurement_problem = VALUES(procurement_problem), problem_note = VALUES(problem_note),
         reported_by = VALUES(reported_by), reported_by_name = VALUES(reported_by_name)`,
      [ctx.session.id, facilityId, reportDate, ...values, auth.user.id, userName(auth.user)]
    );
    const days = oxygenDays(v).total;
    await recordChange({
      request, user: auth.user, action: result.affectedRows === 1 ? "data_create" : "data_update", table: "liquid_oxygen_reports",
      id: result.insertId || null, sessionId: ctx.session.id,
      description: `รายงานออกซิเจนเหลว ${facility.name} วันที่ ${reportDate}: ใช้ได้อีก ${formatDays(days)} วัน${v.procurement_problem ? ` (ปัญหา: ${v.problem_note})` : ""}`
    });
    triggerEventAlerts(ctx.session.id);
    return NextResponse.json({ success: true, message: `บันทึกแล้ว ${facility.name} ใช้ได้อีก ${formatDays(days)} วัน` });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return bad("ยังไม่ได้ติดตั้งตารางออกซิเจนเหลว (รัน npm run db:migrate)", 503);
    console.error("Oxygen POST error:", error);
    return publicInternalError("ไม่สามารถบันทึกข้อมูลออกซิเจนเหลวได้");
  }
}
