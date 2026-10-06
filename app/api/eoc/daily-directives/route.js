import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { getOperationalSessionAccess } from "@/lib/eocOperationalAccess";
import { checkDateInSession, toDateKey } from "@/lib/sessionDateRange";
import { recordChange } from "@/lib/recordArchive";
import { diffItems, normalizeItems, versionOf } from "@/lib/dailyDirectives";

// รายงานประจำวัน "สถานการณ์/ข้อสั่งการ" (เป็นข้อๆ) ของเหตุการณ์ EOC
// ทุกคนที่ได้รับมอบหมายในเหตุการณ์ + ผู้ดูแลระบบ/ผู้บัญชาการ อ่านและแก้ไขได้ เมื่อปิดเหตุการณ์แล้วอ่านอย่างเดียว
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });

async function authorize(request, sessionId) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return { response: auth.response };
  const access = await getOperationalSessionAccess(auth.user, sessionId);
  if (!access.ok) return { response: bad(access.message, access.status) };
  return { auth, access };
}

function loadDay(sessionId, date) {
  return query(
    `SELECT d.id, d.report_date, d.item_order, d.item_level, d.content, d.item_status, d.team_code, d.carried_from_id,
            d.created_by, d.updated_by, d.completed_at, d.created_at, d.updated_at,
            TRIM(CONCAT(COALESCE(o.given_name, ''), ' ', COALESCE(o.family_name, ''))) AS author_name,
            TRIM(CONCAT(COALESCE(c.given_name, ''), ' ', COALESCE(c.family_name, ''))) AS completed_by_name
     FROM eoc_daily_directives d
     LEFT JOIN officer o ON o.id = d.created_by
     LEFT JOIN officer c ON c.id = d.completed_by
     WHERE d.eoc_session_id = ? AND d.report_date = ?
     ORDER BY d.item_order, d.id`,
    [sessionId, date]
  );
}

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const gate = await authorize(request, params.get("session_id"));
    if (gate.response) return gate.response;
    const { access } = gate;
    const date = toDateKey(params.get("date")) || toDateKey(new Date());
    const [items, days, previousOpen] = await Promise.all([
      loadDay(access.sessionId, date),
      query(
        `SELECT DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, COUNT(*) AS items,
                SUM(item_status = 'open') AS open_items
         FROM eoc_daily_directives WHERE eoc_session_id = ? GROUP BY report_date ORDER BY report_date DESC LIMIT 60`,
        [access.sessionId]
      ),
      query(
        `SELECT DATE_FORMAT(MAX(report_date), '%Y-%m-%d') AS report_date, COUNT(*) AS open_items
         FROM eoc_daily_directives
         WHERE eoc_session_id = ? AND item_status = 'open'
           AND report_date = (SELECT MAX(report_date) FROM eoc_daily_directives WHERE eoc_session_id = ? AND report_date < ?)`,
        [access.sessionId, access.sessionId, date]
      )
    ]);
    return NextResponse.json({
      success: true,
      session: access.session,
      date,
      items,
      version: versionOf(items),
      days,
      carry_over: previousOpen[0]?.open_items ? previousOpen[0] : null,
      permissions: { can_edit: access.canOperate }
    });
  } catch (error) {
    console.error("Daily directives GET error:", error);
    return publicInternalError("ไม่สามารถโหลดรายงานประจำวันได้");
  }
}

// บันทึกรายการทั้งวัน (เพิ่ม/แก้/ลบ/เรียงลำดับ) ในครั้งเดียว
export async function PUT(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const gate = await authorize(request, body.session_id);
    if (gate.response) return gate.response;
    const { auth, access } = gate;
    if (!access.canOperate) return bad("เหตุการณ์นี้ปิดแล้ว ดูได้อย่างเดียว", 409);
    const range = checkDateInSession(access.session, body.date);
    if (!range.ok) return bad(range.error, range.status);
    const date = range.dateKey;
    const normalized = normalizeItems(body.items);
    if (!normalized.ok) return bad(normalized.error);
    const teamCode = access.memberships?.[0]?.team_code || null;

    const outcome = await transaction(async (execute) => {
      const existing = await execute(
        `SELECT id, content, item_level, item_order, item_status, updated_at FROM eoc_daily_directives
         WHERE eoc_session_id = ? AND report_date = ? ORDER BY item_order, id FOR UPDATE`,
        [access.sessionId, date]
      );
      if (body.version && body.version !== versionOf(existing)) {
        return { conflict: true };
      }
      const diff = diffItems(existing, normalized.items);
      for (const item of diff.inserts) {
        await execute(
          `INSERT INTO eoc_daily_directives
             (eoc_session_id, report_date, item_order, item_level, content, item_status, team_code, created_by, updated_by, completed_by, completed_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [access.sessionId, date, item.order, item.level, item.content, item.status, teamCode, auth.user.id, auth.user.id,
            item.status === "done" ? auth.user.id : null, item.status === "done" ? new Date() : null]
        );
      }
      for (const item of diff.updates) {
        await execute(
          `UPDATE eoc_daily_directives SET item_order = ?, item_level = ?, content = ?, item_status = ?, updated_by = ?
             ${item.statusChanged ? ", completed_by = ?, completed_at = ?" : ""}
           WHERE id = ?`,
          [item.order, item.level, item.content, item.status, auth.user.id,
            ...(item.statusChanged ? [item.status === "done" ? auth.user.id : null, item.status === "done" ? new Date() : null] : []), item.id]
        );
      }
      if (diff.deletes.length) {
        await execute(`DELETE FROM eoc_daily_directives WHERE id IN (${diff.deletes.map(() => "?").join(",")}) AND eoc_session_id = ?`, [...diff.deletes, access.sessionId]);
      }
      return { diff };
    });
    if (outcome.conflict) return bad("มีผู้อื่นแก้ไขรายงานวันนี้ก่อนหน้าคุณ กรุณาโหลดใหม่แล้วบันทึกอีกครั้ง", 409);

    const { diff } = outcome;
    if (diff.inserts.length || diff.updates.length || diff.deletes.length) {
      await recordChange({
        request, user: auth.user, action: "data_update", table: "eoc_daily_directives", id: date, sessionId: access.sessionId,
        description: `บันทึกสถานการณ์/ข้อสั่งการวันที่ ${date}: เพิ่ม ${diff.inserts.length} แก้ ${diff.updates.length} ลบ ${diff.deletes.length} ข้อ`
      });
    }
    const items = await loadDay(access.sessionId, date);
    return NextResponse.json({ success: true, message: "บันทึกแล้ว", items, version: versionOf(items) });
  } catch (error) {
    console.error("Daily directives PUT error:", error);
    return publicInternalError("ไม่สามารถบันทึกรายงานประจำวันได้");
  }
}

// ยกข้อที่ยังไม่ดำเนินการจากวันล่าสุดก่อนหน้ามาไว้ท้ายรายการของวันที่เลือก
export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));
    const gate = await authorize(request, body.session_id);
    if (gate.response) return gate.response;
    const { auth, access } = gate;
    if (!access.canOperate) return bad("เหตุการณ์นี้ปิดแล้ว ดูได้อย่างเดียว", 409);
    if (body.action !== "carry_over") return bad("ไม่รู้จักคำสั่ง");
    const range = checkDateInSession(access.session, body.date);
    if (!range.ok) return bad(range.error, range.status);
    const date = range.dateKey;

    const copied = await transaction(async (execute) => {
      const source = await execute(
        `SELECT id, item_level, content, team_code FROM eoc_daily_directives
         WHERE eoc_session_id = ? AND item_status = 'open'
           AND report_date = (SELECT MAX(report_date) FROM eoc_daily_directives WHERE eoc_session_id = ? AND report_date < ?)
         ORDER BY item_order, id`,
        [access.sessionId, access.sessionId, date]
      );
      const already = await execute(
        `SELECT carried_from_id FROM eoc_daily_directives WHERE eoc_session_id = ? AND report_date = ? AND carried_from_id IS NOT NULL`,
        [access.sessionId, date]
      );
      const taken = new Set(already.map((row) => Number(row.carried_from_id)));
      const [{ next_order: nextOrder } = { next_order: 0 }] = await execute(
        `SELECT COALESCE(MAX(item_order) + 1, 0) AS next_order FROM eoc_daily_directives WHERE eoc_session_id = ? AND report_date = ?`,
        [access.sessionId, date]
      );
      let order = Number(nextOrder) || 0;
      let count = 0;
      for (const row of source) {
        if (taken.has(Number(row.id))) continue;
        await execute(
          `INSERT INTO eoc_daily_directives (eoc_session_id, report_date, item_order, item_level, content, team_code, carried_from_id, created_by, updated_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [access.sessionId, date, order, row.item_level, row.content, row.team_code, row.id, auth.user.id, auth.user.id]
        );
        order += 1;
        count += 1;
      }
      return count;
    });
    if (copied) {
      await recordChange({ request, user: auth.user, action: "data_create", table: "eoc_daily_directives", id: date, sessionId: access.sessionId, description: `ยกข้อที่ยังไม่ดำเนินการ ${copied} ข้อมาวันที่ ${date}` });
    }
    return NextResponse.json({ success: true, message: copied ? `ยกมา ${copied} ข้อ` : "ไม่มีข้อค้างที่ต้องยกมา" });
  } catch (error) {
    console.error("Daily directives POST error:", error);
    return publicInternalError("ไม่สามารถยกข้อค้างได้");
  }
}
