import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { runWaterAlerts } from "@/lib/waterAlertRunner";
import { rainThresholdsFromEnv, thresholdsFromEnv } from "@/lib/waterAlerts";
import { alertSendingEnabled, telegramReady } from "@/lib/eocAlertRunner";
import { recordChange } from "@/lib/recordArchive";

// แจ้งเตือนระดับน้ำจากสถานี ThaiWater
// GET  ?after=<id>  = เรื่องใหม่หลัง id นั้น (หน้าจอเจ้าหน้าที่ดึงทุกนาทีเพื่อเด้ง popup พร้อมเสียง)
// GET  ?overview=1  = สถานะสถานี + ประวัติ + การตั้งค่า (หน้าตั้งค่าระบบ)
// POST ?dry=1       = ตรวจตอนนี้แบบไม่บันทึก/ไม่ส่ง · POST = ตรวจและส่งจริง (ผู้ดูแลระบบ/ผู้บัญชาการ หรือ cron ที่มี x-cron-secret)
const COLUMNS = "id, kind, station_id, station_name, level, state, previous_state, bank_diff, water_level_msl, title, message, observed_at, delivered_count, created_at";

function missingTable(error) {
  return error?.code === "ER_NO_SUCH_TABLE";
}

export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  const params = new URL(request.url).searchParams;
  try {
    if (params.get("overview") === "1") {
      const [states, log] = await Promise.all([
        query("SELECT station_id, kind, station_name, state, bank_diff, observed_at, changed_at FROM water_station_alert_state ORDER BY kind DESC, FIELD(state, 'overflow', 'severe', 'near', 'watch', 'normal'), station_name", []),
        query(`SELECT ${COLUMNS} FROM water_alert_log ORDER BY id DESC LIMIT 30`, [])
      ]);
      const thresholds = thresholdsFromEnv();
      return NextResponse.json({
        success: true, ready: true, states, log, thresholds, rain_thresholds: rainThresholdsFromEnv(),
        telegram_ready: telegramReady(), sending_enabled: alertSendingEnabled(),
        scheduler: process.env.NODE_ENV === "production" || String(process.env.WATER_ALERTS_SCHEDULER || "").toLowerCase() === "on"
          ? String(process.env.WATER_ALERTS_INTERVAL_MIN || "10")
          : "off",
        can_run: ["admin", "commander"].includes(auth.user.role)
      });
    }
    // ครั้งแรกที่เปิดหน้า (after=0) ส่งเฉพาะเรื่องใน 2 ชม.ล่าสุด เพื่อไม่ให้เด้งเรื่องเก่าค้าง
    const after = Math.max(0, Number(params.get("after")) || 0);
    const rows = after
      ? await query(`SELECT ${COLUMNS} FROM water_alert_log WHERE id > ? AND created_at >= NOW() - INTERVAL 6 HOUR ORDER BY id LIMIT 20`, [after])
      : await query(`SELECT ${COLUMNS} FROM water_alert_log WHERE created_at >= NOW() - INTERVAL 2 HOUR ORDER BY id LIMIT 20`, []);
    const [latest] = await query("SELECT COALESCE(MAX(id), 0) AS id FROM water_alert_log", []);
    return NextResponse.json({ success: true, ready: true, alerts: rows, latest_id: Number(latest?.id || 0) });
  } catch (error) {
    if (missingTable(error)) return NextResponse.json({ success: true, ready: false, alerts: [], latest_id: 0, message: "ยังไม่ได้รัน npm run db:migrate" });
    console.error("Water alerts GET error:", error);
    return publicInternalError("โหลดแจ้งเตือนระดับน้ำไม่สำเร็จ");
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
    const dryRun = new URL(request.url).searchParams.get("dry") === "1";
    const result = await runWaterAlerts({ dryRun });
    if (!dryRun && !result.logReady) {
      return NextResponse.json({ success: false, message: "ยังไม่มีตารางแจ้งเตือนระดับน้ำ (npm run db:migrate)" }, { status: 409 });
    }
    if (user && result.saved) {
      await recordChange({ request, user, action: "data_create", table: "water_alert_log", id: "-", description: `ตรวจแจ้งเตือนระดับน้ำ ${result.saved} เรื่อง` }).catch(() => {});
    }
    const count = result.alerts.length;
    const message = dryRun
      ? (count ? `ถ้าตรวจตอนนี้จะแจ้ง ${count} เรื่อง (ยังไม่ได้ส่ง)` : `ไม่มีสถานีที่เข้าเกณฑ์แจ้งใหม่ (ตรวจสถานีวัดน้ำ ${result.stations} · สถานีวัดฝน ${result.rainStations})`)
      : (count ? `แจ้งเตือน ${count} เรื่อง${result.delivered ? ` · ส่ง Telegram ${result.delivered} ครั้ง` : " · ยังไม่ได้ส่ง Telegram (ยังไม่ตั้งค่าหรือปิดไว้)"}` : `ไม่มีเรื่องใหม่ (ตรวจสถานีวัดน้ำ ${result.stations} · สถานีวัดฝน ${result.rainStations})`);
    const warning = result.sourceErrors.length ? ` · ดึงข้อมูล${result.sourceErrors.join("และ")}จาก ThaiWater ไม่ได้` : "";
    return NextResponse.json({ success: true, message: message + warning, dry_run: dryRun, alerts: result.alerts, stations: result.stations, delivered: result.delivered });
  } catch (error) {
    console.error("Water alerts POST error:", error);
    return publicInternalError("ตรวจแจ้งเตือนระดับน้ำไม่สำเร็จ");
  }
}
