import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { categoryReady } from "@/lib/telegramChannels";
import { securityMonitorConfig } from "@/lib/securityMonitor";
import { runSecurityAnomalyCheck, sendWeeklySecurityReport } from "@/lib/securityMonitorServer";

async function rows(sql) {
  try {
    return { ready: true, rows: await query(sql, []) };
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return { ready: false, rows: [] };
    throw error;
  }
}

// เฝ้าระวังความปลอดภัย: ค่าตั้ง แจ้งเตือนล่าสุด ประวัติเปลี่ยนสิทธิ์ — เฉพาะผู้ดูแลระบบ
export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const [alerts, audit] = await Promise.all([
      rows("SELECT id, created_at, kind, title, detail, delivered FROM security_alert_log ORDER BY created_at DESC LIMIT 20"),
      rows("SELECT id, created_at, actor_username, action, target_username, detail, ip_address FROM security_audit_log ORDER BY created_at DESC LIMIT 20")
    ]);
    return NextResponse.json({
      success: true,
      ready: alerts.ready && audit.ready,
      telegramReady: categoryReady("security"),
      production: process.env.NODE_ENV === "production",
      config: securityMonitorConfig(),
      alerts: alerts.rows,
      audit: audit.rows
    });
  } catch (error) {
    console.error("security-monitor GET:", error);
    return publicInternalError("อ่านข้อมูลเฝ้าระวังไม่สำเร็จ");
  }
}

// { action: "preview" | "send_weekly" | "check" } — preview = ดูข้อความสรุปโดยไม่ส่ง, check = ตรวจความผิดปกติตอนนี้ (ไม่ส่ง)
export async function POST(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "preview" || body.action === "send_weekly") {
      const result = await sendWeeklySecurityReport({ dryRun: body.action === "preview" });
      return NextResponse.json({ success: true, text: result.text, delivered: result.delivered, total: result.total ?? 0, dryRun: Boolean(result.dryRun) });
    }
    if (body.action === "check") {
      const result = await runSecurityAnomalyCheck({ dryRun: true });
      return NextResponse.json({ success: true, window: result.window, alerts: result.alerts });
    }
    return NextResponse.json({ success: false, error: "คำสั่งไม่ถูกต้อง" }, { status: 400 });
  } catch (error) {
    console.error("security-monitor POST:", error);
    return publicInternalError("ทำรายการไม่สำเร็จ");
  }
}
