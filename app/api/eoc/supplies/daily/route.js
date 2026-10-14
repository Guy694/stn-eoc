import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { modulePermissions, requireModuleEdit } from "@/lib/eocModuleAccess";
import { recordChange } from "@/lib/recordArchive";
import { triggerEventAlerts } from "@/lib/eocAlertRunner";
import { checkDateInSession } from "@/lib/sessionDateRange";
import { reportingStatus, todayKey, validateDailyEntry } from "@/lib/medicalDaily";
import { DailyError, dailyForm, findSupplyEvent, loadDailyData, resolveSupplySession, saveDailyEntries } from "@/lib/medicalDailyServer";

// รายงานเวชภัณฑ์ประจำวันของหน่วยบริการ
// GET  ?eoc=flood&facility_id=7&date=2026-10-14 → ทุกรายการของหน่วยนั้นพร้อมยอดยกมา + สถานะการรายงานของวันนั้น
// POST { facility_id, date, rows: [{ stock_id, received_qty, used_qty, counted_qty, note }] }
export const dynamic = "force-dynamic";

const SUPPORTED = ["flood", "disease"];
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function context(params) {
  const eocType = params.get("eoc") || "flood";
  if (!SUPPORTED.includes(eocType)) return { error: bad("ประเภท EOC ไม่ถูกต้อง") };
  const session = await resolveSupplySession(eocType, Number(params.get("session_id")) || null);
  if (!session) return { error: bad("ยังไม่มีเหตุการณ์ EOC", 404) };
  const event = await findSupplyEvent(session);
  if (!event) return { error: bad("ยังไม่ได้เปิดบัญชีคลังของเหตุการณ์นี้", 409) };
  return { session, event };
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const ctx = await context(params);
    if (ctx.error) return ctx.error;
    const date = params.get("date") || todayKey();
    if (!DATE_RE.test(date)) return bad("วันที่ไม่ถูกต้อง");
    const facilityId = params.get("facility_id");
    const data = await loadDailyData(ctx.event.id);
    const ofDay = data.reports.filter((report) => report.report_date === date);
    const existing = data.stock.filter((row) => !row.created_day || row.created_day <= date);
    const perms = await modulePermissions(auth.user, ctx.session.id, "supplies");
    return NextResponse.json({
      success: true,
      date,
      today: todayKey(),
      session: { id: ctx.session.id, session_number: ctx.session.session_number, status: ctx.session.status, opened_at: ctx.session.opened_at },
      status: reportingStatus(existing, ofDay),
      rows: facilityId ? dailyForm(data, facilityId, date) : [],
      can_report: ctx.session.status === "active" && perms.can_edit,
      read_only_message: perms.can_edit ? null : perms.read_only_message
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Supplies daily GET error:", error?.message || error);
    return publicInternalError("ไม่สามารถโหลดรายงานประจำวันได้");
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const ctx = await context(params);
    if (ctx.error) return ctx.error;
    if (ctx.session.status !== "active") return bad("เหตุการณ์นี้ปิดแล้ว ดูข้อมูลได้อย่างเดียว", 409);
    const gate = await requireModuleEdit(auth.user, ctx.session.id, "supplies");
    if (gate.response) return gate.response;

    const body = await request.json().catch(() => ({}));
    const date = String(body.date || "");
    if (!DATE_RE.test(date)) return bad("กรุณาเลือกวันที่รายงาน");
    const inSession = checkDateInSession(ctx.session, date, new Date(`${todayKey()}T12:00:00`));
    if (!inSession.ok) return bad(inSession.error);
    const rows = Array.isArray(body.rows) ? body.rows.slice(0, 500) : [];
    if (!rows.length) return bad("ยังไม่มีรายการที่จะรายงาน");

    const data = await loadDailyData(ctx.event.id);
    const facilityStock = new Map(
      data.stock.filter((row) => String(row.health_facility_id || row.inventory_agency_id) === String(body.facility_id)).map((row) => [row.id, row])
    );
    if (!facilityStock.size) return bad("หน่วยบริการนี้ยังไม่มีรายการในคลัง");
    const entries = [];
    for (const row of rows) {
      const stockId = Number(row.stock_id);
      const stock = facilityStock.get(stockId);
      if (!stock) return bad("มีรายการที่ไม่ใช่ของหน่วยบริการนี้");
      const checked = validateDailyEntry(row);
      if (!checked.ok) return bad(`${stock.item_name}: ${checked.error}`);
      entries.push({ stock_id: stockId, report_date: date, value: checked.value });
    }

    const counts = await transaction((execute) => saveDailyEntries(execute, { eventId: ctx.event.id, user: auth.user, source: "form", entries }));
    const facilityName = facilityStock.values().next().value?.agency_name || "";
    if (counts.created || counts.updated) {
      await recordChange({
        request, user: auth.user, action: "data_update", table: "medical_inventory_daily_reports", id: ctx.event.id, sessionId: ctx.session.id,
        description: `รายงานเวชภัณฑ์ประจำวัน ${date} ${facilityName} ${counts.created + counts.updated} รายการ`
      });
      triggerEventAlerts(ctx.session.id);
    }
    const changed = counts.created + counts.updated;
    return NextResponse.json({
      success: true,
      counts,
      message: changed ? `บันทึกรายงานวันที่ ${date} แล้ว ${changed} รายการ${counts.unchanged ? ` (เท่าเดิม ${counts.unchanged})` : ""}` : "ค่าเท่าเดิมทุกรายการ ไม่มีอะไรเปลี่ยน"
    });
  } catch (error) {
    if (error instanceof DailyError) return bad(error.message, error.status);
    console.error("Supplies daily POST error:", error?.message || error);
    return publicInternalError("ไม่สามารถบันทึกรายงานประจำวันได้");
  }
}

