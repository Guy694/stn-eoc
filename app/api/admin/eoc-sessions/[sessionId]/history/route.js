import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query } from "@/lib/db";
import { eventDays, loadSessionHistory } from "@/lib/eventHistory";

// GET - สรุปเหตุการณ์หนึ่งครั้ง: ผลกระทบ การช่วยเหลือ การทำงานของศูนย์ และบันทึกกิจกรรม
export async function GET(request, { params }) {
  const auth = await requireAuth(request, ["admin", "commander"]);
  if (!auth.success) return auth.response;

  try {
    const { sessionId } = await params;
    const rows = await query(
      `SELECT s.*,
              COALESCE(NULLIF(CONCAT_WS(' ', oo.title, oo.given_name, oo.family_name), ''), oo.username) AS opened_by_name,
              COALESCE(NULLIF(CONCAT_WS(' ', co.title, co.given_name, co.family_name), ''), co.username) AS closed_by_name
       FROM eoc_sessions s
       LEFT JOIN officer oo ON oo.id = s.opened_by
       LEFT JOIN officer co ON co.id = s.closed_by
       WHERE s.id = ? LIMIT 1`,
      [Number(sessionId)]
    );
    const session = rows[0];
    if (!session) return NextResponse.json({ success: false, message: "ไม่พบเหตุการณ์นี้" }, { status: 404 });

    const history = await loadSessionHistory(session);
    // summary / affected_areas เป็นฟิลด์ข้อความเก่าที่ไม่ได้ใช้แล้ว ไม่ต้องส่งออก
    const publicSession = { ...session, days: eventDays(session) };
    delete publicSession.summary;
    delete publicSession.affected_areas;
    return NextResponse.json({ success: true, data: { session: publicSession, ...history } });
  } catch (error) {
    console.error("Event history detail error:", error);
    return publicInternalError("โหลดสรุปเหตุการณ์ไม่สำเร็จ");
  }
}
