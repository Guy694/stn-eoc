import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { resolveEventSession } from "@/lib/eocBriefData";
import { recordChange } from "@/lib/recordArchive";
import { loadCurrentTriggers } from "@/lib/areaTriggersServer";
import { areaLabel, stageTitle, validateDeclaration } from "@/lib/floodTriggers";

// ประกาศธงเตือนภัย/Trigger การเคลื่อนย้ายกลุ่มเปราะบาง รายพื้นที่
// GET ?eoc=flood&session_id=  → ประกาศปัจจุบันของแต่ละพื้นที่ + ประวัติ 50 รายการ
// POST { session_id, district?, tambon?, stage?, note? } → ประกาศ (stage ว่าง = ยกเลิก) เฉพาะ admin/ผู้บัญชาการ/SAT
const DECLARERS = ["admin", "commander", "SAT"];
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
    return NextResponse.json({
      success: true, session, ready: true,
      current: current.filter((row) => row.stage),
      history,
      can_declare: DECLARERS.includes(auth.user.role) && session.status === "active"
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
    if (!DECLARERS.includes(auth.user.role)) return bad("ประกาศได้เฉพาะผู้ดูแลระบบ ผู้บัญชาการ หรือทีม SAT", 403);
    const body = await request.json().catch(() => ({}));
    const session = await resolveEventSession({ eocType: "flood", sessionId: body.session_id });
    if (!session || session.eoc_type !== "flood") return bad("ไม่พบเหตุการณ์อุทกภัย", 404);
    if (session.status !== "active") return bad("เหตุการณ์นี้ปิดแล้ว");
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
