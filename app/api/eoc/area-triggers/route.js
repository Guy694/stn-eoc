import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { resolveEventSession } from "@/lib/eocBriefData";
import { recordChange } from "@/lib/recordArchive";
import { modulePermissions, requireModuleEdit } from "@/lib/eocModuleAccess";
import { getOperationalSessionAccess } from "@/lib/eocOperationalAccess";
import { loadCurrentTriggers, loadTriggerActions } from "@/lib/areaTriggersServer";
import { areaLabel, stageMeta, stageTitle, validateDeclaration } from "@/lib/floodTriggers";

// ประกาศธงเตือนภัย/Trigger การเคลื่อนย้ายกลุ่มเปราะบาง รายพื้นที่
// GET ?eoc=flood&session_id=  → ประกาศปัจจุบันของแต่ละพื้นที่ + ประวัติ 50 รายการ
// POST { session_id, district?, tambon?, stage?, note? } → ประกาศ (stage ว่าง = ยกเลิก)
//   เฉพาะแอดมิน/ผู้บัญชาการ และกล่องภารกิจเจ้าของเมนู "triggers" ในเหตุการณ์นี้ (ค่าเริ่มต้น SAT — แอดมินเปลี่ยนได้)
// PATCH ติ๊กการดำเนินการ: เฉพาะผู้ที่ได้รับมอบหมายในเหตุการณ์นี้
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });
const userName = (user) => [user?.givenName, user?.familyName].filter(Boolean).join(" ") || user?.username || null;

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const session = await resolveEventSession({ eocType: params.get("eoc") || "flood", sessionId: params.get("session_id") });
    if (!session) return NextResponse.json({ success: true, session: null, current: [], history: [], ready: true });
    const current = await loadCurrentTriggers(session.id);
    if (current === null) return NextResponse.json({ success: true, session, current: [], history: [], ready: false, can_declare: false });
    const history = await query(
      `SELECT id, district, tambon, stage, note, declared_by_name, declared_at FROM eoc_area_triggers WHERE session_id = ? ORDER BY id DESC LIMIT 50`,
      [session.id]
    );
    const active = current.filter((row) => row.stage);
    const actions = await loadTriggerActions(active.map((row) => row.id));
    const declare = await modulePermissions(auth.user, session.id, "triggers");
    const assigned = await getOperationalSessionAccess(auth.user, session.id).catch(() => ({ ok: false }));
    return NextResponse.json({
      success: true, session, ready: true,
      current: active.map((row) => ({ ...row, actions: actions[row.id] || {} })),
      can_tick: session.status === "active" && Boolean(assigned.ok),
      tick_message: assigned.ok ? null : "ติ๊กได้เฉพาะเจ้าหน้าที่ที่ได้รับมอบหมายในเหตุการณ์นี้",
      history,
      can_declare: Boolean(declare.can_edit),
      declare_message: declare.can_edit ? null : declare.read_only_message || "ประกาศได้เฉพาะกล่องภารกิจที่ได้รับมอบหมายในเหตุการณ์นี้"
    });
  } catch (error) {
    console.error("Area triggers GET error:", error);
    return publicInternalError("โหลดประกาศธง/Trigger ไม่สำเร็จ");
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const body = await request.json().catch(() => ({}));
    const session = await resolveEventSession({ eocType: "flood", sessionId: body.session_id });
    if (!session || session.eoc_type !== "flood") return bad("ไม่พบเหตุการณ์อุทกภัย", 404);
    if (session.status !== "active") return bad("เหตุการณ์นี้ปิดแล้ว");
    const gate = await requireModuleEdit(auth.user, session.id, "triggers");
    if (gate.response) return gate.response;
    const checked = validateDeclaration(body);
    if (checked.error) return bad(checked.error);
    const v = checked.value;
    const result = await query(
      `INSERT INTO eoc_area_triggers (session_id, district, tambon, stage, note, declared_by, declared_by_name) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [session.id, v.district, v.tambon, v.stage, v.note, auth.user.id, userName(auth.user)]
    );
    const what = v.stage ? `ประกาศ ${stageTitle(v.stage)}` : "ยกเลิกประกาศ";
    await recordChange({ request, user: auth.user, action: "data_create", table: "eoc_area_triggers", id: result.insertId, sessionId: session.id, description: `${what} ${areaLabel(v)}${v.note ? `: ${v.note}` : ""}` });
    return NextResponse.json({ success: true, message: `${what} ${areaLabel(v)} แล้ว` });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return bad("ยังไม่ได้ติดตั้งตารางประกาศ Trigger (รัน npm run db:migrate)", 503);
    console.error("Area triggers POST error:", error);
    return publicInternalError("บันทึกประกาศไม่สำเร็จ");
  }
}

// PATCH { session_id, trigger_id, action_index, done } → ติ๊ก/ยกเลิกติ๊กการดำเนินการ (เจ้าหน้าที่ทุกคนในเหตุการณ์ที่เปิดอยู่)
export async function PATCH(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const body = await request.json().catch(() => ({}));
    const triggerId = Number(body.trigger_id);
    const index = Number(body.action_index);
    if (!Number.isInteger(triggerId) || triggerId <= 0 || !Number.isInteger(index) || index < 0) return bad("ข้อมูลไม่ครบ");
    const rows = await query(
      `SELECT t.id, t.session_id, t.stage, t.district, t.tambon, s.status FROM eoc_area_triggers t JOIN eoc_sessions s ON s.id = t.session_id WHERE t.id = ? LIMIT 1`,
      [triggerId]
    );
    const row = rows[0];
    if (!row || !row.stage) return bad("ไม่พบประกาศ", 404);
    if (row.status !== "active") return bad("เหตุการณ์นี้ปิดแล้ว");
    const assigned = await getOperationalSessionAccess(auth.user, row.session_id);
    if (!assigned.ok) return bad("ติ๊กได้เฉพาะเจ้าหน้าที่ที่ได้รับมอบหมายในเหตุการณ์นี้", 403);
    const action = stageMeta(row.stage)?.actions?.[index];
    if (!action) return bad("ไม่พบรายการที่ต้องทำ", 404);
    const done = body.done === true || body.done === 1 || body.done === "1";
    await query(
      `INSERT INTO eoc_area_trigger_actions (trigger_id, action_index, done, updated_by, updated_by_name) VALUES (?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE done = VALUES(done), updated_by = VALUES(updated_by), updated_by_name = VALUES(updated_by_name)`,
      [triggerId, index, done ? 1 : 0, auth.user.id, userName(auth.user)]
    );
    await recordChange({ request, user: auth.user, action: "data_update", table: "eoc_area_trigger_actions", id: triggerId, sessionId: row.session_id, description: `${done ? "ทำแล้ว" : "ยกเลิกทำแล้ว"}: ${action.text} (${areaLabel(row)})` });
    return NextResponse.json({ success: true, message: done ? "บันทึกว่าทำแล้ว" : "ยกเลิกแล้ว" });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return bad("ยังไม่ได้ติดตั้งตารางเช็กลิสต์ (รัน npm run db:migrate)", 503);
    console.error("Area trigger action error:", error);
    return publicInternalError("บันทึกไม่สำเร็จ");
  }
}
