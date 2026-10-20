import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { CONNECTIVITY_TARGETS, buildTestAlert, serverChecklist } from "@/lib/alertTest";
import { networkReason } from "@/lib/webPush";
import { alertSendingEnabled, telegramReady } from "@/lib/eocAlertRunner";
import { getPushSettings } from "@/lib/publicPushServer";
import { vapidConfig } from "@/lib/webPush";
import { recordChange } from "@/lib/recordArchive";

// หน้า "ทดสอบการแจ้งเตือน" (ผู้ดูแลระบบ)
// GET  = สถานะความพร้อมของทุกช่องทาง
// POST { kind, level } = สร้างแจ้งเตือน [ทดสอบ] ในบันทึก → หน้าจอเจ้าหน้าที่ทุกเครื่องเด้งภายใน 1 นาที (ไม่ส่ง Telegram)
export const dynamic = "force-dynamic";

const safe = (promise, fallback) => promise.catch((error) => (error?.code === "ER_NO_SUCH_TABLE" ? fallback : Promise.reject(error)));

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const [last, count, subs, settings] = await Promise.all([
      safe(query("SELECT id, kind, level, title, delivered_count, created_at FROM water_alert_log ORDER BY id DESC LIMIT 1", []), null),
      safe(query("SELECT COUNT(*) AS n FROM water_alert_log WHERE created_at >= NOW() - INTERVAL 24 HOUR", []), null),
      safe(query("SELECT COUNT(*) AS n, SUM(audience = 'officer') AS officers FROM push_subscriptions WHERE is_active = 1", []), [{ n: 0, officers: 0 }])
        .catch(() => query("SELECT COUNT(*) AS n, 0 AS officers FROM push_subscriptions WHERE is_active = 1", []).catch(() => [{ n: 0, officers: 0 }])),
      getPushSettings(),
    ]);
    const apple = await query(
      `SELECT COUNT(*) AS n, SUM(fail_count > 0) AS failing, MAX(CASE WHEN fail_count > 0 THEN last_status END) AS status, MAX(last_sent_at) AS last_ok
       FROM push_subscriptions WHERE is_active = 1 AND endpoint LIKE 'https://web.push.apple.com/%'`, []
    ).catch(() => [{}]);
    const scheduled = process.env.NODE_ENV === "production" || String(process.env.WATER_ALERTS_SCHEDULER || "").toLowerCase() === "on";
    const interval = String(process.env.WATER_ALERTS_INTERVAL_MIN || "10").trim().toLowerCase();
    const info = {
      now: Date.now(),
      scheduler: !scheduled || ["off", "0", "false", "no"].includes(interval) ? "off" : interval,
      logReady: last !== null,
      lastAlert: last?.[0] || null,
      alerts24h: Number(count?.[0]?.n || 0),
      telegramReady: telegramReady(),
      sendingEnabled: alertSendingEnabled(),
      vapidReady: Boolean(vapidConfig()),
      vapidSubjectOk: vapidConfig()?.subjectOk !== false,
      vapidSubject: vapidConfig()?.subject || null,
      appleDevices: Number(apple?.[0]?.n || 0),
      appleFailing: Number(apple?.[0]?.failing || 0),
      appleStatus: apple?.[0]?.status ?? null,
      appleLastOk: apple?.[0]?.last_ok || null,
      pushAuto: settings.auto_enabled === true,
      subscriptions: Number(subs?.[0]?.n || 0),
      officerDevices: Number(subs?.[0]?.officers || 0)
    };
    return NextResponse.json({ success: true, data: { checks: serverChecklist(info), last_alert: info.lastAlert } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Alert test GET error:", error?.message || error);
    return publicInternalError("ตรวจสถานะการแจ้งเตือนไม่สำเร็จ");
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "connectivity") {
      const data = await Promise.all(CONNECTIVITY_TARGETS.map(async (target) => {
        const started = Date.now();
        try {
          const response = await fetch(target.url, { method: target.method, signal: AbortSignal.timeout(15000), redirect: "manual", cache: "no-store" });
          return { key: target.key, label: target.label, ok: true, status: response.status, ms: Date.now() - started };
        } catch (error) {
          return { key: target.key, label: target.label, ok: false, reason: networkReason(error), ms: Date.now() - started };
        }
      }));
      return NextResponse.json({ success: true, data });
    }
    const by = [auth.user.givenName || auth.user.given_name, auth.user.familyName || auth.user.family_name].filter(Boolean).join(" ") || auth.user.username || "";
    const alert = buildTestAlert({ kind: body.kind, level: body.level, by });
    const result = await query(
      `INSERT INTO water_alert_log (kind, station_id, station_name, level, state, previous_state, title, message, observed_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
      [alert.kind, alert.stationId, alert.stationName, alert.level, alert.state, alert.previousState, alert.title, alert.message]
    );
    await recordChange({ request, user: auth.user, action: "data_create", table: "water_alert_log", id: String(result?.insertId || "-"), description: `ทดสอบแจ้งเตือนบนหน้าจอเจ้าหน้าที่: ${alert.title}` }).catch(() => {});
    return NextResponse.json({ success: true, data: { id: result?.insertId || null }, message: "สร้างแจ้งเตือนทดสอบแล้ว หน้าจอเจ้าหน้าที่ที่เปิดอยู่จะเด้งภายใน 1 นาที" });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: false, message: "ยังไม่มีตารางแจ้งเตือน (รัน migration ก่อน)" }, { status: 409 });
    console.error("Alert test POST error:", error?.message || error);
    return publicInternalError("สร้างแจ้งเตือนทดสอบไม่สำเร็จ");
  }
}
