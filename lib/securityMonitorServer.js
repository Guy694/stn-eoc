// งานเบื้องหลังเฝ้าระวังความปลอดภัย (production): ทุก 10 นาทีตรวจการเข้าชม/เข้าใช้ผิดปกติ
// และส่งสรุปรายสัปดาห์เข้า Telegram กลุ่มผู้ดูแลระบบ (TELEGRAM_SECURITY_CHAT_IDS)
import { query } from "@/lib/db";
import { withSchedulerLock } from "@/lib/schedulerLock";
import { escapeTelegramHtml } from "@/lib/telegram";
import { sendCategorized } from "@/lib/telegramChannels";
import {
  cooldownFor, detectSecurityAnomalies, formatSecurityAlert, formatWeeklySecurityReport,
  securityMonitorConfig, weeklyReportDue
} from "@/lib/securityMonitor";

const MISSING = new Set(["ER_NO_SUCH_TABLE", "ER_BAD_FIELD_ERROR"]);
const SUSPENDED_FROM = "9000-01-01";

/** อ่านแบบทนตารางที่ยังไม่มี (คืน fallback) */
async function safe(sql, params = [], fallback = []) {
  try {
    return await query(sql, params);
  } catch (error) {
    if (MISSING.has(error?.code)) return fallback;
    throw error;
  }
}
const n = (rows, key) => Number(rows?.[0]?.[key] || 0);

// ── ตรวจช่วง 10 นาทีล่าสุด ──

export async function collectSecurityWindow(config = securityMonitorConfig()) {
  const m = config.windowMinutes;
  const [totalRows, baselineRows, topIps, staffForeign, failedRows] = await Promise.all([
    safe(`SELECT COUNT(*) AS total FROM visitor_access_log WHERE visited_at >= DATE_SUB(NOW(), INTERVAL ${m} MINUTE)`),
    safe(`SELECT COUNT(*) AS total, TIMESTAMPDIFF(MINUTE, MIN(visited_at), DATE_SUB(NOW(), INTERVAL ${m} MINUTE)) AS span_minutes FROM visitor_access_log
          WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) AND visited_at < DATE_SUB(NOW(), INTERVAL ${m} MINUTE)`),
    safe(`SELECT ip_address AS ip, MAX(network) AS network, COUNT(*) AS visits, SUM(area = 'staff') AS staff
          FROM visitor_access_log WHERE visited_at >= DATE_SUB(NOW(), INTERVAL ${m} MINUTE)
          GROUP BY ip_address HAVING visits >= ? ORDER BY visits DESC LIMIT 5`, [config.ipMaxVisits]),
    safe(`SELECT username, ip_address AS ip, country, MAX(city) AS city, COUNT(*) AS visits
          FROM visitor_access_log
          WHERE visited_at >= DATE_SUB(NOW(), INTERVAL ${m} MINUTE) AND user_id IS NOT NULL
            AND country IS NOT NULL AND country <> '' AND UPPER(country) <> ?
          GROUP BY username, ip_address, country LIMIT 10`, [config.homeCountry]),
    safe(`SELECT COUNT(*) AS total, COUNT(DISTINCT ip_address) AS ips FROM login_attempts
          WHERE success = 0 AND attempt_time >= DATE_SUB(NOW(), INTERVAL ${m} MINUTE)`)
  ]);
  // ค่าเฉลี่ยต่อช่วง 10 นาที นับเฉพาะช่วงที่มีข้อมูลจริง (ระบบเพิ่งเริ่มเก็บก็ไม่ทำให้ค่าเฉลี่ยต่ำเกินจริง)
  // คิดช่วงเวลาในฐานข้อมูล (ไม่ขึ้นกับเขตเวลาของ Node)
  const spanMinutes = Math.max(0, Number(baselineRows?.[0]?.span_minutes || 0));
  const baselinePerWindow = spanMinutes >= 24 * 60 ? n(baselineRows, "total") / (spanMinutes / m) : 0;
  return {
    total: n(totalRows, "total"),
    baselinePerWindow,
    topIps: topIps.map((row) => ({ ...row, visits: Number(row.visits), staff: Number(row.staff || 0) })),
    staffForeign,
    failedLogins: { total: n(failedRows, "total"), ips: n(failedRows, "ips") }
  };
}

async function recentlyAlerted(key, minutes) {
  const rows = await safe(
    "SELECT 1 AS hit FROM security_alert_log WHERE alert_key = ? AND created_at >= DATE_SUB(NOW(), INTERVAL ? MINUTE) LIMIT 1",
    [key, minutes]
  );
  return rows.length > 0;
}

export async function runSecurityAnomalyCheck({ dryRun = false, config = securityMonitorConfig() } = {}) {
  const window = await collectSecurityWindow(config);
  const alerts = detectSecurityAnomalies(window, config);
  const sent = [];
  for (const alert of alerts) {
    if (await recentlyAlerted(alert.key, cooldownFor(alert.kind, config))) continue;
    if (dryRun) { sent.push({ ...alert, delivered: 0, dryRun: true }); continue; }
    const result = await sendCategorized("security", formatSecurityAlert(alert, escapeTelegramHtml), { includePersonal: true });
    await safe(
      "INSERT INTO security_alert_log (kind, alert_key, title, detail, delivered) VALUES (?, ?, ?, ?, ?)",
      [alert.kind, alert.key.slice(0, 120), alert.title, alert.lines.join("\n"), result.delivered || 0]
    );
    sent.push({ ...alert, delivered: result.delivered || 0 });
  }
  return { window, alerts: sent };
}

// ── สรุปรายสัปดาห์ ──

export async function collectWeeklySecurityStats(config = securityMonitorConfig()) {
  const week = "INTERVAL 7 DAY";
  const [logins, topFailed, events, accounts, inactive, auditCount, auditRecent, visitors, previous, peak, alerts] = await Promise.all([
    safe(`SELECT SUM(success = 1) AS ok, SUM(success = 0) AS failed, COUNT(DISTINCT CASE WHEN success = 0 THEN ip_address END) AS failed_ips
          FROM login_attempts WHERE attempt_time >= DATE_SUB(NOW(), ${week})`),
    safe(`SELECT ip_address AS ip, COUNT(*) AS count FROM login_attempts
          WHERE success = 0 AND attempt_time >= DATE_SUB(NOW(), ${week}) GROUP BY ip_address ORDER BY count DESC LIMIT 3`),
    safe(`SELECT event_type, COUNT(*) AS count FROM security_logs
          WHERE created_at >= DATE_SUB(NOW(), ${week}) AND event_type IN ('account_locked', 'suspicious_activity') GROUP BY event_type`),
    safe(`SELECT SUM(role = 'admin' AND is_approved = 1) AS admins,
                 SUM(is_approved = 0 AND (account_locked_until IS NULL OR account_locked_until < '${SUSPENDED_FROM}')) AS pending,
                 SUM(account_locked_until > NOW() AND account_locked_until < '${SUSPENDED_FROM}') AS locked,
                 SUM(account_locked_until >= '${SUSPENDED_FROM}') AS suspended
          FROM officer`),
    safe(`SELECT username FROM officer
          WHERE is_approved = 1 AND (account_locked_until IS NULL OR account_locked_until < '${SUSPENDED_FROM}')
            AND COALESCE(last_login, created_at) < DATE_SUB(NOW(), INTERVAL ? DAY)
          ORDER BY COALESCE(last_login, created_at) ASC`, [config.inactiveDays]),
    safe(`SELECT COUNT(*) AS count FROM security_audit_log WHERE created_at >= DATE_SUB(NOW(), ${week})`),
    safe(`SELECT action, actor_username, target_username, detail FROM security_audit_log
          WHERE created_at >= DATE_SUB(NOW(), ${week}) ORDER BY created_at DESC LIMIT 8`),
    safe(`SELECT COUNT(*) AS visits, COUNT(DISTINCT ip_address) AS ips, SUM(area = 'staff') AS staff,
                 SUM(country IS NOT NULL AND country <> '' AND UPPER(country) <> ?) AS foreign_visits
          FROM visitor_access_log WHERE visited_at >= DATE_SUB(NOW(), ${week})`, [config.homeCountry]),
    safe(`SELECT COUNT(*) AS visits FROM visitor_access_log
          WHERE visited_at >= DATE_SUB(NOW(), INTERVAL 14 DAY) AND visited_at < DATE_SUB(NOW(), ${week})`),
    safe(`SELECT DATE_FORMAT(visited_at, '%Y-%m-%d') AS day, COUNT(*) AS visits FROM visitor_access_log
          WHERE visited_at >= DATE_SUB(NOW(), ${week}) GROUP BY day ORDER BY visits DESC LIMIT 1`),
    safe(`SELECT kind, COUNT(*) AS count FROM security_alert_log WHERE created_at >= DATE_SUB(NOW(), ${week}) GROUP BY kind`)
  ]);
  const eventCount = (type) => Number(events.find((row) => row.event_type === type)?.count || 0);
  const peakDay = peak?.[0]?.day
    ? new Date(`${peak[0].day}T12:00:00+07:00`).toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" })
    : null;
  return {
    logins: { success: n(logins, "ok"), failed: n(logins, "failed"), failedIps: n(logins, "failed_ips") },
    topFailedIps: topFailed.map((row) => ({ ip: row.ip, count: Number(row.count) })),
    lockEvents: eventCount("account_locked"),
    suspiciousEvents: eventCount("suspicious_activity"),
    accounts: {
      admins: n(accounts, "admins"), pending: n(accounts, "pending"), locked: n(accounts, "locked"), suspended: n(accounts, "suspended"),
      inactive: inactive.length, inactiveSample: inactive.slice(0, 5).map((row) => row.username)
    },
    auditCount: n(auditCount, "count"),
    auditRecent,
    visitors: {
      visits: n(visitors, "visits"), ips: n(visitors, "ips"), staff: n(visitors, "staff"), foreign: n(visitors, "foreign_visits"),
      previousVisits: n(previous, "visits"), peakDay, peakVisits: Number(peak?.[0]?.visits || 0)
    },
    alerts: Object.fromEntries(alerts.map((row) => [row.kind, Number(row.count)]))
  };
}

function periodLabel(now = new Date()) {
  const opts = { day: "numeric", month: "short", timeZone: "Asia/Bangkok" };
  const from = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  return `${from.toLocaleDateString("th-TH", opts)} – ${now.toLocaleDateString("th-TH", { ...opts, year: "numeric" })}`;
}

export async function sendWeeklySecurityReport({ dryRun = false, config = securityMonitorConfig(), now = new Date() } = {}) {
  const stats = await collectWeeklySecurityStats(config);
  const text = formatWeeklySecurityReport(stats, { escape: escapeTelegramHtml, periodLabel: periodLabel(now), inactiveDays: config.inactiveDays });
  if (dryRun) return { stats, text, delivered: 0, dryRun: true };
  const result = await sendCategorized("security", text, { includePersonal: true });
  return { stats, text, delivered: result.delivered || 0, total: result.total || 0 };
}

async function readState(key) {
  const rows = await safe("SELECT state_value FROM security_monitor_state WHERE state_key = ?", [key]);
  return rows?.[0]?.state_value ?? null;
}

async function writeState(key, value) {
  await safe(
    `INSERT INTO security_monitor_state (state_key, state_value) VALUES (?, ?)
     ON DUPLICATE KEY UPDATE state_value = VALUES(state_value)`,
    [key, value]
  );
}

export async function runSecurityMonitorTick({ now = new Date(), config = securityMonitorConfig() } = {}) {
  const result = { anomalies: [], weekly: null };
  const check = await runSecurityAnomalyCheck({ config });
  result.anomalies = check.alerts;
  const due = weeklyReportDue(now, await readState("weekly_report_week"), config);
  if (due.due) {
    const weekly = await sendWeeklySecurityReport({ config, now });
    // ส่งไม่ถึงใครเลย (ยังไม่ตั้งกลุ่ม) ก็ถือว่าทำแล้ว จะได้ไม่ลองซ้ำทุก 10 นาที
    await writeState("weekly_report_week", due.key);
    result.weekly = { week: due.key, delivered: weekly.delivered };
  }
  return result;
}

export function startSecurityMonitor() {
  const config = securityMonitorConfig();
  if (process.env.NODE_ENV !== "production" || !config.enabled) return false;
  if (globalThis.__securityMonitorTimer) return true;
  const tick = () => withSchedulerLock("security-monitor", () => runSecurityMonitorTick())
    .then((result) => {
      if (result?.skipped) return;
      if (result?.anomalies?.length) console.warn(`[security-monitor] แจ้งเตือนผิดปกติ ${result.anomalies.length} รายการ`);
      if (result?.weekly) console.info(`[security-monitor] ส่งสรุปรายสัปดาห์ ${result.weekly.week} ถึง ${result.weekly.delivered} ปลายทาง`);
    })
    .catch((error) => console.warn("[security-monitor] ไม่สำเร็จ:", error?.message || error));
  globalThis.__securityMonitorTimer = setInterval(tick, config.windowMinutes * 60 * 1000);
  setTimeout(tick, 2 * 60 * 1000);
  return true;
}
