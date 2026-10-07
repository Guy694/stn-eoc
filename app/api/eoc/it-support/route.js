import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { getOperationalSessionAccess } from "@/lib/eocOperationalAccess";
import { handleArchiveDelete, recordChange } from "@/lib/recordArchive";
import { IT_STATUSES, RESOURCE_STATUSES, nextTicketNo, sortTickets, summarizeIt, validateTicket } from "@/lib/itSupport";
import { triggerEventAlerts } from "@/lib/eocAlertRunner";
import { moduleEditAccess, readOnlyMessage } from "@/lib/eocModulePermissions";
import { ownersFor } from "@/lib/eocModuleOwners";

// รายงาน IT support ในเหตุการณ์ EOC: ปัญหาระบบ/อุปกรณ์/การสื่อสาร + สถานะทรัพยากร IT
// ทุกคนที่ได้รับมอบหมายในเหตุการณ์ดูได้ แต่บันทึก/อัปเดตได้เฉพาะกลุ่มภารกิจด้านเทคโนโลยีดิจิทัล (IT) และผู้ดูแลระบบ/ผู้บัญชาการ
// เมื่อปิดเหตุการณ์แล้วทุกคนอ่านอย่างเดียว
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const userName = (user) => [user?.givenName, user?.familyName].filter(Boolean).join(" ") || user?.username || null;

async function gate(request, sessionId) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return { response: auth.response };
  const access = await getOperationalSessionAccess(auth.user, sessionId);
  if (!access.ok) return { response: bad(access.message, access.status) };
  const owners = await ownersFor(access.session.eoc_type, "it-support");
  const edit = moduleEditAccess({
    role: auth.user.role,
    memberships: access.memberships,
    sessionActive: access.canOperate,
    moduleKey: "it-support",
    owners
  });
  edit.message = readOnlyMessage("it-support", edit.reason, owners);
  return { auth, access, edit };
}

// ใช้กับคำสั่งที่เปลี่ยนข้อมูล: คืน response ถ้าไม่มีสิทธิ์บันทึก
function denyWrite(edit) {
  if (edit.canEdit) return null;
  return bad(edit.message, edit.reason === "closed" ? 409 : 403);
}

async function resolveSessionId(params) {
  if (params.get("session_id")) return params.get("session_id");
  const rows = await query(
    `SELECT id FROM eoc_sessions WHERE eoc_type = ? ORDER BY (status = 'active') DESC, opened_at DESC LIMIT 1`,
    [params.get("eoc") || "flood"]
  );
  return rows[0]?.id || null;
}

const loadTickets = (sessionId) => query(
  `SELECT id, ticket_no, DATE_FORMAT(reported_at, '%Y-%m-%dT%H:%i:%s') AS reported_at, unit_name, it_resource_id, category, title, detail,
          severity, status, assignee, workaround, resolution, DATE_FORMAT(resolved_at, '%Y-%m-%dT%H:%i:%s') AS resolved_at,
          reporter_name, reporter_phone, created_at, updated_at
   FROM eoc_it_tickets WHERE eoc_session_id = ? ORDER BY reported_at DESC LIMIT 500`,
  [sessionId]
);

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const sessionId = await resolveSessionId(params);
    if (!sessionId) return NextResponse.json({ success: true, session: null, message: "ยังไม่เคยเปิดเหตุการณ์" });
    const checked = await gate(request, sessionId);
    if (checked.response) return checked.response;
    const { access } = checked;
    let migrationNeeded = false;
    const [tickets, resources] = await Promise.all([
      loadTickets(access.sessionId).catch((error) => {
        if (error.code === "ER_NO_SUCH_TABLE") { migrationNeeded = true; return []; }
        throw error;
      }),
      query(`SELECT id, resource_type, unit_name, location, isp_provider, connection_type, status, last_check, contact_person, contact_phone, notes
             FROM it_resources ORDER BY FIELD(status, 'offline', 'maintenance', 'unknown', 'online'), unit_name`).catch(() => [])
    ]);
    return NextResponse.json({
      success: true,
      session: access.session,
      migration_needed: migrationNeeded,
      tickets: sortTickets(tickets),
      resources,
      summary: summarizeIt(tickets, resources),
      permissions: {
        can_edit: checked.edit.canEdit && !migrationNeeded,
        can_delete: checked.auth.user.role === "admin",
        read_only_reason: checked.edit.reason,
        read_only_message: checked.edit.message
      }
    });
  } catch (error) {
    console.error("IT support GET error:", error);
    return publicInternalError("ไม่สามารถโหลดรายงาน IT support ได้");
  }
}

function toSqlDate(value) {
  const date = value ? new Date(value) : new Date();
  return Number.isNaN(date.getTime()) ? new Date() : date;
}

// แจ้งปัญหาใหม่
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const checked = await gate(request, body.session_id);
    if (checked.response) return checked.response;
    const { auth, access } = checked;
    const denied = denyWrite(checked.edit);
    if (denied) return denied;
    const result = validateTicket(body);
    if (!result.ok) return bad(result.error);
    const ticket = result.ticket;
    const created = await transaction(async (execute) => {
      const numbers = await execute(`SELECT ticket_no FROM eoc_it_tickets WHERE eoc_session_id = ? FOR UPDATE`, [access.sessionId]);
      const ticketNo = nextTicketNo(access.session.session_number, numbers.map((row) => row.ticket_no));
      const done = ticket.status === "resolved" || ticket.status === "closed";
      const inserted = await execute(
        `INSERT INTO eoc_it_tickets
           (eoc_session_id, ticket_no, reported_at, unit_name, it_resource_id, category, title, detail, severity, status, assignee,
            workaround, resolution, resolved_at, reporter_name, reporter_phone, created_by, updated_by)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [access.sessionId, ticketNo, toSqlDate(ticket.reported_at), ticket.unit_name, ticket.it_resource_id, ticket.category, ticket.title, ticket.detail,
          ticket.severity, ticket.status, ticket.assignee, ticket.workaround, ticket.resolution, done ? new Date() : null,
          ticket.reporter_name || userName(auth.user), ticket.reporter_phone, auth.user.id, auth.user.id]
      );
      return { id: inserted.insertId, ticketNo };
    });
    await recordChange({
      request, user: auth.user, action: "data_create", table: "eoc_it_tickets", id: created.id, sessionId: access.sessionId,
      description: `แจ้งปัญหา IT ${created.ticketNo}: ${ticket.title} (${ticket.unit_name})`, newValues: ticket
    });
    triggerEventAlerts(access.sessionId);
    return NextResponse.json({ success: true, message: `บันทึกเรื่อง ${created.ticketNo} แล้ว`, id: created.id });
  } catch (error) {
    console.error("IT support POST error:", error);
    return publicInternalError("ไม่สามารถบันทึกปัญหา IT ได้");
  }
}

// แก้ไข/อัปเดตสถานะเรื่อง
export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const checked = await gate(request, body.session_id);
    if (checked.response) return checked.response;
    const { auth, access } = checked;
    const denied = denyWrite(checked.edit);
    if (denied) return denied;
    const rows = await query(`SELECT * FROM eoc_it_tickets WHERE id = ? AND eoc_session_id = ? LIMIT 1`, [Number(body.id) || 0, access.sessionId]);
    if (!rows.length) return bad("ไม่พบเรื่องที่ต้องการแก้ไข", 404);
    const result = validateTicket({ ...rows[0], ...body });
    if (!result.ok) return bad(result.error);
    const ticket = result.ticket;
    const wasDone = rows[0].status === "resolved" || rows[0].status === "closed";
    const nowDone = ticket.status === "resolved" || ticket.status === "closed";
    const resolvedAt = nowDone ? (wasDone ? rows[0].resolved_at : new Date()) : null;
    await query(
      `UPDATE eoc_it_tickets SET reported_at = ?, unit_name = ?, it_resource_id = ?, category = ?, title = ?, detail = ?, severity = ?, status = ?,
         assignee = ?, workaround = ?, resolution = ?, resolved_at = ?, reporter_name = ?, reporter_phone = ?, updated_by = ?
       WHERE id = ?`,
      [toSqlDate(ticket.reported_at), ticket.unit_name, ticket.it_resource_id, ticket.category, ticket.title, ticket.detail, ticket.severity, ticket.status,
        ticket.assignee, ticket.workaround, ticket.resolution, resolvedAt, ticket.reporter_name, ticket.reporter_phone, auth.user.id, rows[0].id]
    );
    await recordChange({
      request, user: auth.user, action: "data_update", table: "eoc_it_tickets", id: rows[0].id, sessionId: access.sessionId,
      description: `อัปเดตปัญหา IT ${rows[0].ticket_no}: ${IT_STATUSES[rows[0].status]?.label} → ${IT_STATUSES[ticket.status]?.label}`,
      oldValues: { status: rows[0].status, severity: rows[0].severity }, newValues: { status: ticket.status, severity: ticket.severity }
    });
    triggerEventAlerts(access.sessionId);
    return NextResponse.json({ success: true, message: `อัปเดต ${rows[0].ticket_no} แล้ว` });
  } catch (error) {
    console.error("IT support PUT error:", error);
    return publicInternalError("ไม่สามารถอัปเดตปัญหา IT ได้");
  }
}

// เปลี่ยนสถานะทรัพยากร IT (ออนไลน์/ออฟไลน์/ซ่อมบำรุง) จากหน้างาน
export async function PATCH(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const checked = await gate(request, body.session_id);
    if (checked.response) return checked.response;
    const { auth, access } = checked;
    const denied = denyWrite(checked.edit);
    if (denied) return denied;
    if (!RESOURCE_STATUSES[body.status]) return bad("สถานะไม่ถูกต้อง");
    const rows = await query(`SELECT id, unit_name, resource_type, status FROM it_resources WHERE id = ? LIMIT 1`, [Number(body.resource_id) || 0]);
    if (!rows.length) return bad("ไม่พบทรัพยากร IT", 404);
    await query(`UPDATE it_resources SET status = ?, last_check = NOW() WHERE id = ?`, [body.status, rows[0].id]);
    await recordChange({
      request, user: auth.user, action: "data_update", table: "it_resources", id: rows[0].id, sessionId: access.sessionId,
      description: `เปลี่ยนสถานะ ${rows[0].resource_type} ${rows[0].unit_name}: ${RESOURCE_STATUSES[rows[0].status]?.label || rows[0].status} → ${RESOURCE_STATUSES[body.status].label}`,
      oldValues: { status: rows[0].status }, newValues: { status: body.status }
    });
    return NextResponse.json({ success: true, message: `${rows[0].unit_name}: ${RESOURCE_STATUSES[body.status].label}` });
  } catch (error) {
    console.error("IT support PATCH error:", error);
    return publicInternalError("ไม่สามารถเปลี่ยนสถานะทรัพยากร IT ได้");
  }
}

// ลบ = ย้ายไปถังขยะพร้อมเหตุผล (ผู้ดูแลระบบ)
export async function DELETE(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  return handleArchiveDelete(request, auth.user, { table: "eoc_it_tickets" });
}
