// เฝ้าระวังความปลอดภัย: ตรวจการเข้าชม/เข้าใช้ผิดปกติ และสรุปรายสัปดาห์ (ส่วนคำนวณ ไม่มีการเรียกฐานข้อมูล/เครือข่าย)
// งานเบื้องหลังอยู่ที่ lib/securityMonitorServer.js · ส่งเข้า Telegram กลุ่มผู้ดูแลระบบ (ประเภท security)
import { SECURITY_AUDIT_LABELS } from "@/lib/securityAuditLabels";

const int = (value, fallback, min = 1) => {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isInteger(number) && number >= min ? number : fallback;
};
const num = (value, fallback) => {
  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : fallback;
};

/** ค่าตั้งจาก .env (ดู .env.example หัวข้อ "เฝ้าระวังความปลอดภัย") */
export function securityMonitorConfig(env = process.env) {
  return {
    enabled: !["off", "0", "false", "no"].includes(String(env.SECURITY_MONITOR || "").trim().toLowerCase()),
    windowMinutes: 10,
    spikeMinVisits: int(env.SECURITY_SPIKE_MIN_VISITS, 300), // เข้าชมรวมใน 10 นาที อย่างน้อยเท่านี้จึงพิจารณา
    spikeRatio: num(env.SECURITY_SPIKE_RATIO, 5), // และมากกว่าค่าเฉลี่ย 7 วันกี่เท่า
    ipMaxVisits: int(env.SECURITY_IP_MAX_VISITS, 150), // IP เดียวเปิดหน้าเว็บกี่ครั้งใน 10 นาที
    failedLoginBurst: int(env.SECURITY_FAILED_LOGIN_BURST, 20), // ใส่รหัสผิดรวมทุก IP ใน 10 นาที
    cooldownMinutes: int(env.SECURITY_ALERT_COOLDOWN_MINUTES, 60),
    homeCountry: String(env.SECURITY_HOME_COUNTRY || "TH").trim().toUpperCase(),
    weeklyDay: int(env.SECURITY_WEEKLY_DAY, 1, 0) % 7, // 0=อาทิตย์ 1=จันทร์
    weeklyHour: Math.min(23, int(env.SECURITY_WEEKLY_HOUR, 8, 0)),
    inactiveDays: int(env.SECURITY_INACTIVE_DAYS, 90)
  };
}

/** ช่วงพักไม่แจ้งซ้ำ (นาที) ตามชนิด: เจ้าหน้าที่เข้าจากต่างประเทศแจ้งวันละครั้งต่อคน/ประเทศ */
export function cooldownFor(kind, config) {
  return kind === "staff_foreign_access" ? 24 * 60 : config.cooldownMinutes;
}

const fmt = (value) => Number(value || 0).toLocaleString("th-TH");

/**
 * @param {object} w ตัวเลขของช่วง 10 นาทีล่าสุด
 *   total, baselinePerWindow, topIps [{ ip, visits, network, staff }], staffForeign [{ username, ip, country, city, visits }],
 *   failedLogins { total, ips }
 * @returns {{ kind, key, title, lines: string[] }[]}
 */
export function detectSecurityAnomalies(w = {}, config = securityMonitorConfig()) {
  const alerts = [];
  const minutes = config.windowMinutes;
  const total = Number(w.total || 0);
  const baseline = Number(w.baselinePerWindow || 0);
  if (total >= config.spikeMinVisits && (baseline <= 0 || total >= baseline * config.spikeRatio)) {
    alerts.push({
      kind: "traffic_spike",
      key: "traffic_spike",
      title: "ผู้เข้าชมเพิ่มขึ้นผิดปกติ",
      lines: [
        `เปิดหน้าเว็บ ${fmt(total)} ครั้งใน ${minutes} นาที`,
        baseline > 0 ? `ปกติเฉลี่ย ${fmt(Math.round(baseline))} ครั้ง (สูงกว่า ${(total / baseline).toFixed(1)} เท่า)` : "ยังไม่มีค่าเฉลี่ยย้อนหลังให้เทียบ",
        "อาจเป็นช่วงเกิดภัยที่คนเข้าดูมาก หรือถูกยิงคำขอจำนวนมาก — ตรวจ IP ที่เข้ามากที่สุดในเมนูผู้เข้าชม"
      ]
    });
  }
  for (const row of w.topIps || []) {
    if (row.network === "private") continue; // เครือข่ายภายในองค์กร
    if (Number(row.visits || 0) < config.ipMaxVisits) continue;
    alerts.push({
      kind: "ip_flood",
      key: `ip_flood:${row.ip}`,
      title: "IP เดียวเข้าถี่ผิดปกติ",
      lines: [
        `IP: ${row.ip}`,
        `เปิดหน้าเว็บ ${fmt(row.visits)} ครั้งใน ${minutes} นาที${Number(row.staff || 0) ? ` (หน้าเจ้าหน้าที่ ${fmt(row.staff)} ครั้ง)` : ""}`,
        "ถ้าไม่ใช่เครื่องของหน่วยงาน พิจารณาบล็อก IP นี้ที่ nginx/firewall"
      ]
    });
  }
  for (const row of w.staffForeign || []) {
    if (!row.country || String(row.country).toUpperCase() === config.homeCountry) continue;
    alerts.push({
      kind: "staff_foreign_access",
      key: `staff_foreign:${row.username || row.ip}:${row.country}`,
      title: "บัญชีเจ้าหน้าที่ถูกใช้จากต่างประเทศ",
      lines: [
        `บัญชี: ${row.username || "-"}`,
        `IP: ${row.ip} (${[row.city, row.country].filter(Boolean).join(", ")})`,
        "ถ้าเจ้าของบัญชีไม่ได้อยู่ต่างประเทศ ให้ระงับบัญชีและรีเซ็ตรหัสผ่านทันที"
      ]
    });
  }
  const failed = Number(w.failedLogins?.total || 0);
  if (failed >= config.failedLoginBurst) {
    alerts.push({
      kind: "failed_login_burst",
      key: "failed_login_burst",
      title: "ใส่รหัสผ่านผิดจำนวนมากพร้อมกัน",
      lines: [
        `ผิด ${fmt(failed)} ครั้งใน ${minutes} นาที จาก ${fmt(w.failedLogins?.ips)} IP`,
        "อาจเป็นการเดารหัสผ่านแบบกระจายหลาย IP — ตรวจ ตั้งค่าระบบ › ความปลอดภัย"
      ]
    });
  }
  return alerts;
}

/** ข้อความ Telegram ของการแจ้งเตือนหนึ่งรายการ (escape = ฟังก์ชันกัน HTML) */
export function formatSecurityAlert(alert, escape = (value) => String(value)) {
  return [`<b>⚠️ ${escape(alert.title)}</b>`, ...alert.lines.map((line) => escape(line)), "ดูรายละเอียด: ตั้งค่าระบบ › ผู้เข้าชม"].join("\n");
}

// ── สรุปรายสัปดาห์ ──

function bangkokParts(date) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", weekday: "short", hourCycle: "h23"
  }).formatToParts(date).map((part) => [part.type, part.value]));
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(parts.weekday);
  return { year: Number(parts.year), month: Number(parts.month), day: Number(parts.day), hour: Number(parts.hour), weekday };
}

/** รหัสสัปดาห์ (ปี-สัปดาห์ ISO ตามเวลาไทย) ใช้กันส่งซ้ำ */
export function isoWeekKey(date = new Date()) {
  const { year, month, day } = bangkokParts(date);
  const d = new Date(Date.UTC(year, month - 1, day));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

/** ถึงเวลาส่งสรุปของสัปดาห์นี้หรือยัง: ตั้งแต่วัน/ชั่วโมงที่กำหนดจนจบสัปดาห์ (จันทร์–อาทิตย์) และยังไม่เคยส่งในสัปดาห์นี้
 *  เซิร์ฟเวอร์ปิดตรงเวลาพอดี → ส่งเมื่อเปิดกลับมาในสัปดาห์เดียวกัน */
export function weeklyReportDue(now = new Date(), lastSentKey = null, config = securityMonitorConfig()) {
  const key = isoWeekKey(now);
  if (lastSentKey === key) return { due: false, key };
  const { weekday, hour } = bangkokParts(now);
  const dayIndex = (weekday + 6) % 7; // จันทร์ = 0 … อาทิตย์ = 6
  const targetIndex = (config.weeklyDay + 6) % 7;
  return { due: dayIndex > targetIndex || (dayIndex === targetIndex && hour >= config.weeklyHour), key };
}

const pct = (now, before) => {
  if (!before) return "";
  const change = ((now - before) / before) * 100;
  return ` (${change >= 0 ? "+" : ""}${change.toFixed(0)}% จากสัปดาห์ก่อน)`;
};

/**
 * สรุปความปลอดภัยรายสัปดาห์
 * @param {object} s ตัวเลขที่รวบรวมจากฐานข้อมูล (ดู collectWeeklySecurityStats)
 */
export function formatWeeklySecurityReport(s = {}, { escape = (value) => String(value), periodLabel = "7 วันที่ผ่านมา", inactiveDays = 90 } = {}) {
  const e = escape;
  const lines = [`<b>📊 สรุปความปลอดภัยรายสัปดาห์</b>`, `ช่วง: ${e(periodLabel)}`, ""];

  const login = s.logins || {};
  lines.push("<b>การเข้าสู่ระบบ</b>");
  lines.push(`• สำเร็จ ${fmt(login.success)} ครั้ง · ผิด ${fmt(login.failed)} ครั้ง จาก ${fmt(login.failedIps)} IP`);
  if (s.topFailedIps?.length) lines.push(`• IP ที่ใส่รหัสผิดมากสุด: ${s.topFailedIps.map((row) => `${e(row.ip)} (${fmt(row.count)})`).join(", ")}`);
  lines.push(`• ถูกพัก/ล็อกเพราะผิดซ้ำ: ${fmt(s.lockEvents)} ครั้ง · ถูกบล็อกเพราะถี่ผิดปกติ: ${fmt(s.suspiciousEvents)} ครั้ง`);
  lines.push("");

  const acc = s.accounts || {};
  lines.push("<b>บัญชีผู้ใช้</b>");
  lines.push(`• ผู้ดูแลระบบ ${fmt(acc.admins)} คน · รออนุมัติ ${fmt(acc.pending)} คน · ล็อกอยู่ ${fmt(acc.locked)} คน · ระงับ ${fmt(acc.suspended)} คน`);
  if (acc.inactive) {
    const names = (acc.inactiveSample || []).map(e).join(", ");
    lines.push(`• ไม่ได้เข้าใช้เกิน ${inactiveDays} วัน ${fmt(acc.inactive)} บัญชี${names ? `: ${names}${acc.inactive > (acc.inactiveSample || []).length ? " …" : ""}` : ""} — ควรพิจารณาระงับ`);
  } else {
    lines.push(`• ไม่มีบัญชีที่ไม่ได้ใช้เกิน ${inactiveDays} วัน`);
  }
  lines.push("");

  lines.push("<b>การเปลี่ยนสิทธิ์โดยผู้ดูแล</b>");
  if (s.auditCount) {
    for (const row of s.auditRecent || []) {
      const label = SECURITY_AUDIT_LABELS[row.action] || row.action;
      lines.push(`• ${e(label)} ${e(row.target_username || "-")}${row.detail ? ` (${e(row.detail)})` : ""} โดย ${e(row.actor_username || "-")}`);
    }
    if (s.auditCount > (s.auditRecent || []).length) lines.push(`• และอีก ${fmt(s.auditCount - s.auditRecent.length)} รายการ`);
  } else {
    lines.push("• ไม่มี");
  }
  lines.push("");

  const v = s.visitors || {};
  lines.push("<b>ผู้เข้าชม</b>");
  lines.push(`• เปิดหน้าเว็บ ${fmt(v.visits)} ครั้ง${pct(Number(v.visits || 0), Number(v.previousVisits || 0))} จาก ${fmt(v.ips)} IP`);
  lines.push(`• หน้าเจ้าหน้าที่ ${fmt(v.staff)} ครั้ง · จากต่างประเทศ ${fmt(v.foreign)} ครั้ง`);
  if (v.peakDay) lines.push(`• วันที่เข้ามากสุด: ${e(v.peakDay)} (${fmt(v.peakVisits)} ครั้ง)`);
  lines.push("");

  const alerts = s.alerts || {};
  const alertTotal = Object.values(alerts).reduce((sum, value) => sum + Number(value || 0), 0);
  lines.push("<b>แจ้งเตือนผิดปกติที่ส่งไปแล้ว</b>");
  lines.push(alertTotal
    ? `• ${[
      alerts.traffic_spike && `ผู้เข้าชมพุ่ง ${fmt(alerts.traffic_spike)}`,
      alerts.ip_flood && `IP เข้าถี่ ${fmt(alerts.ip_flood)}`,
      alerts.staff_foreign_access && `เจ้าหน้าที่เข้าจากต่างประเทศ ${fmt(alerts.staff_foreign_access)}`,
      alerts.failed_login_burst && `รหัสผิดจำนวนมาก ${fmt(alerts.failed_login_burst)}`
    ].filter(Boolean).join(" · ")} ครั้ง`
    : "• ไม่มี");

  const todo = [];
  if (acc.inactive) todo.push("ทบทวนบัญชีที่ไม่ได้ใช้งาน");
  if (acc.pending) todo.push("ตรวจคำขอรออนุมัติ");
  if (Number(login.failed || 0) >= 50) todo.push("ดู IP ที่ใส่รหัสผิดมาก และพิจารณาบล็อก");
  if (todo.length) lines.push("", `<b>ควรทำ:</b> ${todo.join(" · ")}`);
  return lines.join("\n");
}
