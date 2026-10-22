import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { requireAuth, rolePermissions, roleDisplayNames, SESSION_MAX_AGE_SECONDS, getSessionIdleMinutes } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query, getDbTimezone } from "@/lib/db";
import { RATE_LIMITS } from "@/lib/rateLimit";
import { PASSWORD_MIN_LENGTH, PASSWORD_POLICY_TEXT } from "@/lib/passwordPolicy";
import { alertSendingEnabled, telegramReady } from "@/lib/eocAlertRunner";
import { getTelegramHelpNotifyChatIds, getTelegramSecurityChatIds, escapeTelegramHtml } from "@/lib/telegram"
import { sendCategorized } from "@/lib/telegramChannels";
import { recordChange } from "@/lib/recordArchive";
import { buildRoleMatrix, healthChecks, integrationStatus, maskId, pendingMigrations } from "@/lib/systemStatus";

// สถานะระบบสำหรับหน้า "ตั้งค่าระบบ" (เฉพาะผู้ดูแลระบบ)
// ค่าที่เป็นความลับ (token/key/password) ไม่ถูกส่งออกจากเซิร์ฟเวอร์ — ส่งแค่ "ตั้งค่าแล้วหรือยัง"

const BACKUP_DIR = path.join(process.cwd(), "backups");
const BACKUP_PATTERN = /\.(backup|sql|sql\.gz|gz|zip|enc)$/i;

async function dbStatus() {
  try {
    const [info] = await query("SELECT VERSION() AS version, @@session.time_zone AS session_tz, @@global.time_zone AS global_tz, NOW() AS db_now");
    const [size] = await query(
      `SELECT COUNT(*) AS tables, ROUND(SUM(data_length + index_length) / 1024 / 1024, 1) AS size_mb
       FROM information_schema.TABLES WHERE table_schema = DATABASE()`);
    const wanted = getDbTimezone();
    return {
      ok: true,
      version: info.version,
      sessionTimezone: info.session_tz,
      globalTimezone: info.global_tz,
      timezoneOk: info.session_tz === wanted,
      dbNow: info.db_now,
      tables: Number(size.tables) || 0,
      sizeMb: Number(size.size_mb) || 0
    };
  } catch (error) {
    return { ok: false, error: `เชื่อมต่อไม่ได้ (${error.code || "error"})` };
  }
}

async function migrationStatus() {
  try {
    const manifest = JSON.parse(await fs.readFile(path.join(process.cwd(), "migrations", "manifest.json"), "utf8"));
    const names = manifest.migrations || [];
    let applied = [];
    try {
      applied = (await query("SELECT name FROM schema_migrations")).map((row) => row.name);
    } catch (error) {
      if (error.code !== "ER_NO_SUCH_TABLE") throw error;
    }
    return { total: names.length, pending: pendingMigrations(names, applied) };
  } catch (error) {
    return { total: 0, pending: [], error: `อ่านรายการ migration ไม่ได้ (${error.code || error.message})` };
  }
}

async function backupStatus() {
  try {
    const entries = await fs.readdir(BACKUP_DIR, { withFileTypes: true });
    const files = await Promise.all(entries
      .filter((entry) => entry.isFile() && BACKUP_PATTERN.test(entry.name))
      .map(async (entry) => {
        const stat = await fs.stat(path.join(BACKUP_DIR, entry.name));
        return { name: entry.name, sizeMb: Math.round((stat.size / 1024 / 1024) * 10) / 10, modifiedAt: stat.mtime.toISOString() };
      }));
    files.sort((a, b) => b.modifiedAt.localeCompare(a.modifiedAt));
    return { directory: "backups/", files: files.slice(0, 10), total: files.length };
  } catch (error) {
    return { directory: "backups/", files: [], total: 0, error: error.code === "ENOENT" ? "ยังไม่มีโฟลเดอร์ backups บนเซิร์ฟเวอร์" : "อ่านโฟลเดอร์สำรองไม่ได้" };
  }
}

async function securityEvents() {
  try {
    const rows = await query(
      `SELECT severity, COUNT(*) AS total FROM security_logs WHERE created_at >= NOW() - INTERVAL 7 DAY GROUP BY severity`);
    return Object.fromEntries(rows.map((row) => [row.severity || "info", Number(row.total) || 0]));
  } catch {
    return null;
  }
}

// ทดสอบการเชื่อมต่อจริง (เรียกเมื่อกดปุ่มเท่านั้น) — ไม่ส่งข้อความหาใคร
async function liveCheck(key) {
  const signal = AbortSignal.timeout(6000);
  try {
    if (key === "telegram") {
      if (!process.env.TELEGRAM_BOT_TOKEN) return { ok: false, detail: "ยังไม่ได้ตั้งค่า TELEGRAM_BOT_TOKEN" };
      const res = await fetch(`https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}/getMe`, { signal });
      const json = await res.json().catch(() => ({}));
      return json.ok ? { ok: true, detail: `บอท @${json.result?.username} พร้อมใช้งาน` } : { ok: false, detail: `Telegram ปฏิเสธ (${res.status})` };
    }
    if (key === "open-meteo") {
      const res = await fetch("https://api.open-meteo.com/v1/forecast?latitude=6.62&longitude=100.07&current=temperature_2m", { signal });
      return res.ok ? { ok: true, detail: "ตอบกลับปกติ" } : { ok: false, detail: `ตอบกลับ ${res.status}` };
    }
    if (key === "gemini") {
      if (!process.env.GEMINI_API_KEY) return { ok: false, detail: "ยังไม่ได้ตั้งค่า GEMINI_API_KEY" };
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?pageSize=1&key=${encodeURIComponent(process.env.GEMINI_API_KEY)}`, { signal });
      return res.ok ? { ok: true, detail: "กุญแจใช้งานได้" } : { ok: false, detail: res.status === 400 || res.status === 403 ? "กุญแจไม่ถูกต้องหรือถูกจำกัดสิทธิ์" : `ตอบกลับ ${res.status}` };
    }
    return { ok: false, detail: "ไม่รองรับการทดสอบอัตโนมัติ" };
  } catch (error) {
    return { ok: false, detail: error.name === "TimeoutError" ? "หมดเวลารอ (6 วินาที) — เซิร์ฟเวอร์อาจออกอินเทอร์เน็ตไม่ได้" : "เชื่อมต่อไม่ได้" };
  }
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const check = new URL(request.url).searchParams.get("check");
    if (check) return NextResponse.json({ success: true, key: check, ...(await liveCheck(check)), checkedAt: new Date().toISOString() });

    const [db, migrations, backups, events] = await Promise.all([dbStatus(), migrationStatus(), backupStatus(), securityEvents()]);
    const helpChats = getTelegramHelpNotifyChatIds();
    // ถ้าไม่ได้ตั้งกลุ่มความปลอดภัยแยก ระบบส่งเข้ากลุ่มแจ้งเตือนศูนย์แทน (lib/telegram.js) — ไม่นับว่าขาด
    // ไม่มีกลุ่มผู้ดูแลแยก: เหตุความปลอดภัยส่งถึงผู้ดูแลที่เชื่อม Telegram ส่วนตัวเท่านั้น (ไม่ส่งเข้ากลุ่มเจ้าหน้าที่)
    const integrations = integrationStatus().map((item) => (
      item.key === "telegram-security" && !item.configured
        ? { ...item, note: "ยังไม่ได้ตั้งกลุ่มผู้ดูแลระบบ — ส่งถึงผู้ดูแลที่เชื่อม Telegram ในหน้าโปรไฟล์เท่านั้น" }
        : item
    ));
    const alerts = {
      ready: telegramReady(),
      sendingEnabled: alertSendingEnabled(),
      chatCount: helpChats.length,
      chats: helpChats.map(maskId),
      securityChats: getTelegramSecurityChatIds().map(maskId),
      cronConfigured: Boolean(process.env.ALERT_CRON_SECRET)
    };
    const status = { db, migrations, backups, integrations, alerts };
    return NextResponse.json({
      success: true,
      generatedAt: new Date().toISOString(),
      checks: healthChecks(status),
      ...status,
      security: {
        passwordMinLength: PASSWORD_MIN_LENGTH,
        passwordPolicy: PASSWORD_POLICY_TEXT,
        sessionMaxHours: Math.round(SESSION_MAX_AGE_SECONDS / 3600),
        sessionIdleMinutes: getSessionIdleMinutes(),
        // ค่าเดียวกับใน app/api/auth/login/route.js
        lockAfterFailed: 5,
        lockMinutes: 30,
        loginRateLimit: RATE_LIMITS.login,
        publicReportRateLimit: RATE_LIMITS.publicReport,
        thaidConfigured: integrations.find((item) => item.key === "thaid")?.configured || false,
        events7d: events
      },
      roles: buildRoleMatrix(rolePermissions, roleDisplayNames, ["admin", "commander", "MCATT", "SAT", "SEhRT", "staff"]),
      runtime: { node: process.version, env: process.env.NODE_ENV || "development" }
    });
  } catch (error) {
    console.error("System status error:", error);
    return publicInternalError("ไม่สามารถโหลดสถานะระบบได้");
  }
}

// ส่งข้อความทดสอบเข้ากลุ่มแจ้งเตือนของศูนย์ (ข้อความจริง — หน้าเว็บต้องยืนยันก่อนเรียก)
export async function POST(request) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const body = await request.json().catch(() => ({}));
    if (body.action !== "test_telegram") return NextResponse.json({ success: false, message: "ไม่รู้จักคำสั่ง" }, { status: 400 });
    if (!telegramReady()) return NextResponse.json({ success: false, message: "ยังไม่ได้ตั้งค่า Telegram" }, { status: 409 });
    const who = escapeTelegramHtml(auth.user.username || "ผู้ดูแลระบบ");
    const when = new Date().toLocaleString("th-TH", { timeZone: "Asia/Bangkok" });
    const text = `<b>ข้อความทดสอบ</b>\nทดสอบการแจ้งเตือนจากหน้าตั้งค่าระบบ โดย ${who} เวลา ${when}\nไม่ต้องดำเนินการใด ๆ`;
    const sent = await sendCategorized("test", text);
    const results = { length: sent.total };
    const delivered = sent.delivered;
    await recordChange({ request, user: auth.user, action: "data_update", table: "system_settings", id: "telegram-test", description: `ส่งข้อความทดสอบ Telegram สำเร็จ ${delivered}/${results.length} กลุ่ม` });
    return NextResponse.json({ success: delivered > 0, delivered, total: results.length, message: delivered ? `ส่งข้อความทดสอบแล้ว ${delivered}/${results.length} กลุ่ม` : "ส่งไม่สำเร็จ — ตรวจว่าบอทอยู่ในกลุ่มและรหัสกลุ่มถูกต้อง" });
  } catch (error) {
    console.error("Telegram test error:", error);
    return publicInternalError("ส่งข้อความทดสอบไม่สำเร็จ");
  }
}
