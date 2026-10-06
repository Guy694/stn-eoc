import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { resolveEventSession } from "@/lib/eocBriefData";
import { runEventAlerts, telegramReady, alertSendingEnabled } from "@/lib/eocAlertRunner";
import { recordChange } from "@/lib/recordArchive";

// แจ้งเตือนอัตโนมัติของเหตุการณ์
// GET  = ประวัติที่ส่งแล้ว + เรื่องที่รอส่ง (ไม่ส่งจริง)
// POST = ตรวจและส่งตอนนี้ (ผู้ดูแลระบบ/ผู้บัญชาการ) หรือเรียกจากตัวตั้งเวลา (header x-cron-secret = ALERT_CRON_SECRET)
async function recentLog(sessionId) {
  try {
    return await query(`SELECT id, alert_key, level, message, delivered_count, created_at FROM eoc_alert_log WHERE eoc_session_id = ? ORDER BY created_at DESC, id DESC LIMIT 30`, [sessionId]);
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return null;
    throw error;
  }
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const session = await resolveEventSession({ eocType: params.get("eoc") || "flood", sessionId: params.get("session_id") });
    if (!session) return NextResponse.json({ success: true, session: null });
    const [preview, log] = await Promise.all([runEventAlerts(session, { dryRun: true }), recentLog(session.id)]);
    return NextResponse.json({
      success: true, session, telegram_ready: telegramReady(), sending_enabled: alertSendingEnabled(), log_ready: log !== null,
      pending: preview.fresh, log: log || [], can_run: ["admin", "commander"].includes(auth.user.role)
    });
  } catch (error) {
    console.error("Alerts GET error:", error);
    return publicInternalError("ไม่สามารถโหลดการแจ้งเตือนได้");
  }
}

export async function POST(request) {
  try {
    const secret = process.env.ALERT_CRON_SECRET;
    const fromCron = Boolean(secret) && request.headers.get("x-cron-secret") === secret;
    let user = null;
    if (!fromCron) {
      const auth = await requireAuth(request, ["admin", "commander"]);
      if (!auth.success) return auth.response;
      user = auth.user;
    }
    const params = new URL(request.url).searchParams;
    const session = await resolveEventSession({ eocType: params.get("eoc") || "flood", sessionId: params.get("session_id") });
    if (!session) return NextResponse.json({ success: false, message: "ไม่พบเหตุการณ์" }, { status: 404 });
    if (session.status !== "active") return NextResponse.json({ success: false, message: "เหตุการณ์ปิดแล้ว" }, { status: 409 });
    const result = await runEventAlerts(session);
    if (!result.logReady) return NextResponse.json({ success: false, message: "ยังไม่มีตารางบันทึกการแจ้งเตือน (npm run db:migrate)" }, { status: 409 });
    if (user && result.sent) {
      await recordChange({ request, user, action: "data_create", table: "eoc_alert_log", id: "-", sessionId: session.id, description: `ส่งแจ้งเตือนอัตโนมัติ ${result.sent} เรื่อง` }).catch(() => {});
    }
    const message = !result.sent ? "ไม่มีเรื่องใหม่ที่ต้องแจ้ง"
      : result.telegramReady ? `ส่งแจ้งเตือน ${result.sent} เรื่อง ไป ${result.delivered} กลุ่ม` : `พบ ${result.sent} เรื่อง (บันทึกแล้ว แต่ยังไม่ได้ตั้งค่า Telegram)`;
    return NextResponse.json({ success: true, message, sent: result.sent, delivered: result.delivered || 0 });
  } catch (error) {
    console.error("Alerts POST error:", error);
    return publicInternalError("ไม่สามารถส่งแจ้งเตือนได้");
  }
}
