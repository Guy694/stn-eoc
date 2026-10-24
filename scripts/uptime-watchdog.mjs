#!/usr/bin/env node
// เฝ้าระบบ (watchdog): เรียก /api/health ทุก 1 นาที — ล่ม/กลับมา แจ้ง Telegram กลุ่มผู้ดูแลระบบ
// รันแยกจากแอป (container ของตัวเอง) แอปล่มทั้งตัวก็ยังแจ้งได้ — ไม่ต้องติดตั้ง package เพิ่ม (Node 18+ มี fetch)
//
//   node scripts/uptime-watchdog.mjs            เฝ้าต่อเนื่อง
//   node scripts/uptime-watchdog.mjs --once     ตรวจครั้งเดียวแล้วจบ (ทดสอบ)
//
// ค่าจาก .env:
//   WATCHDOG_URL                   ที่อยู่ health ภายใน (ค่าเริ่มต้น http://stn-eoc-app:3000/stn-eoc/api/health/)
//   WATCHDOG_PUBLIC_URL            (ไม่บังคับ) ที่อยู่สาธารณะ เช่น https://example.go.th/stn-eoc/api/health/ — ตรวจ nginx/ใบรับรองด้วย
//   WATCHDOG_INTERVAL_SECONDS      ตรวจทุกกี่วินาที (60)
//   WATCHDOG_FAILURES_BEFORE_ALERT ล้มเหลวติดกันกี่ครั้งจึงแจ้ง (3)
//   WATCHDOG_REMIND_MINUTES        ยังล่มอยู่ เตือนซ้ำทุกกี่นาที (30)
//   WATCHDOG_TIMEOUT_SECONDS       รอคำตอบนานสุดกี่วินาที (10)
//   TELEGRAM_BOT_TOKEN + TELEGRAM_SECURITY_CHAT_IDS (หรือ TELEGRAM_ADMIN_CHAT_IDS)

const int = (value, fallback) => {
  const number = Number.parseInt(value ?? "", 10);
  return Number.isInteger(number) && number > 0 ? number : fallback;
};

export function watchdogConfig(env = process.env) {
  const targets = [
    { name: "แอป (ภายใน)", url: env.WATCHDOG_URL || "http://stn-eoc-app:3000/stn-eoc/api/health/" },
    env.WATCHDOG_PUBLIC_URL ? { name: "เว็บไซต์สาธารณะ", url: env.WATCHDOG_PUBLIC_URL } : null
  ].filter(Boolean);
  return {
    targets,
    intervalMs: int(env.WATCHDOG_INTERVAL_SECONDS, 60) * 1000,
    failuresBeforeAlert: int(env.WATCHDOG_FAILURES_BEFORE_ALERT, 3),
    remindMs: int(env.WATCHDOG_REMIND_MINUTES, 30) * 60 * 1000,
    timeoutMs: int(env.WATCHDOG_TIMEOUT_SECONDS, 10) * 1000,
    token: env.TELEGRAM_BOT_TOKEN || "",
    chatIds: [...new Set(String(env.TELEGRAM_SECURITY_CHAT_IDS || env.TELEGRAM_ADMIN_CHAT_IDS || "").split(/[\s,;]+/).filter(Boolean))]
  };
}

const clock = (ms) => new Date(ms).toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
export function durationText(ms) {
  const minutes = Math.max(1, Math.round(ms / 60000));
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  return `${hours} ชม.${minutes % 60 ? ` ${minutes % 60} นาที` : ""}`;
}
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

export function formatWatchdogMessage(kind, { name, url, since, failures, reason, now }) {
  const rule = "━━━━━━━━━━━━";
  const head = {
    down: "🚨 <b>ระบบล่ม — ใช้งานไม่ได้</b>",
    still_down: "🚨 <b>ระบบยังล่มอยู่</b>",
    up: "✅ <b>ระบบกลับมาใช้งานได้แล้ว</b>",
    start: "🟢 <b>เริ่มเฝ้าระบบ</b>"
  }[kind];
  const body = {
    down: [`${esc(name)}: ${esc(url)}`, `ตอบไม่ได้ตั้งแต่ ${clock(since)} น. (${failures} ครั้งติดกัน)`, `สาเหตุ: ${esc(reason)}`, "ตรวจ: docker compose ps · docker compose logs --tail=100 stn-eoc-app"],
    still_down: [`${esc(name)}: ${esc(url)}`, `ล่มมาแล้ว ${durationText(now - since)} (ตั้งแต่ ${clock(since)} น.)`, `สาเหตุล่าสุด: ${esc(reason)}`],
    up: [`${esc(name)}: ${esc(url)}`, `ล่มนาน ${durationText(now - since)} (${clock(since)} – ${clock(now)} น.)`],
    start: [`ตรวจทุก ${esc(reason)}`, `${esc(name)}`]
  }[kind];
  return [head, rule, ...body, rule, `🕒 ${clock(now)} น. · ถึง: ผู้ดูแลระบบเท่านั้น`].join("\n");
}

/**
 * สถานะของปลายทางหนึ่ง → สถานะใหม่ + ข้อความที่ต้องส่ง (ถ้ามี)
 * state: { failures, down, since, lastAlertAt, lastReason }
 */
export function nextWatchdogState(state = {}, result, now, config) {
  const s = { failures: 0, down: false, since: null, lastAlertAt: null, lastReason: "", ...state };
  if (result.ok) {
    if (s.down) return { state: { failures: 0, down: false, since: null, lastAlertAt: null, lastReason: "" }, notify: { kind: "up", since: s.since } };
    return { state: { ...s, failures: 0, since: null, lastReason: "" }, notify: null };
  }
  const failures = s.failures + 1;
  const since = s.since ?? now;
  if (!s.down && failures >= config.failuresBeforeAlert) {
    return { state: { failures, down: true, since, lastAlertAt: now, lastReason: result.reason }, notify: { kind: "down", since, failures, reason: result.reason } };
  }
  if (s.down && now - (s.lastAlertAt ?? now) >= config.remindMs) {
    return { state: { ...s, failures, lastAlertAt: now, lastReason: result.reason }, notify: { kind: "still_down", since: s.since, reason: result.reason } };
  }
  return { state: { ...s, failures, since, lastReason: result.reason }, notify: null };
}

export async function probe(url, timeoutMs, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const started = Date.now();
  try {
    const response = await fetchImpl(url, { signal: controller.signal, cache: "no-store", headers: { "user-agent": "stn-eoc-watchdog" } });
    if (!response.ok) return { ok: false, reason: `HTTP ${response.status}`, ms: Date.now() - started };
    return { ok: true, ms: Date.now() - started };
  } catch (error) {
    const reason = error?.name === "AbortError" ? `ไม่ตอบภายใน ${Math.round(timeoutMs / 1000)} วินาที` : (error?.cause?.code || error?.cause?.errors?.[0]?.code || error?.cause?.message || error?.code || error?.message || "เชื่อมต่อไม่ได้");
    return { ok: false, reason: String(reason), ms: Date.now() - started };
  } finally {
    clearTimeout(timer);
  }
}

async function sendTelegram(config, text) {
  if (!config.token || !config.chatIds.length) {
    console.warn("[watchdog] ยังไม่ได้ตั้ง TELEGRAM_BOT_TOKEN / TELEGRAM_SECURITY_CHAT_IDS — แสดงใน log แทน\n" + text.replace(/<[^>]+>/g, ""));
    return 0;
  }
  let delivered = 0;
  for (const chatId of config.chatIds) {
    try {
      const response = await fetch(`https://api.telegram.org/bot${config.token}/sendMessage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
      });
      if (response.ok) delivered += 1;
      else console.warn(`[watchdog] ส่ง Telegram ไม่สำเร็จ HTTP ${response.status}`);
    } catch (error) {
      console.warn("[watchdog] ส่ง Telegram ไม่สำเร็จ:", error?.message || error);
    }
  }
  return delivered;
}

async function checkAll(config, states) {
  const now = Date.now();
  for (const target of config.targets) {
    const result = await probe(target.url, config.timeoutMs);
    const { state, notify } = nextWatchdogState(states.get(target.url), result, now, config);
    states.set(target.url, state);
    if (!result.ok) console.warn(`[watchdog] ${target.url} ล้มเหลว (${state.failures}): ${result.reason}`);
    if (notify) {
      const text = formatWatchdogMessage(notify.kind, { ...target, ...notify, now });
      const delivered = await sendTelegram(config, text);
      console.info(`[watchdog] แจ้ง ${notify.kind} ${target.url} → ${delivered} ปลายทาง`);
    }
  }
}

async function main() {
  const config = watchdogConfig();
  const states = new Map();
  if (process.argv.includes("--once")) {
    for (const target of config.targets) {
      const result = await probe(target.url, config.timeoutMs);
      console.log(`${result.ok ? "OK  " : "FAIL"} ${target.url} ${result.ms} ms${result.ok ? "" : ` — ${result.reason}`}`);
    }
    return;
  }
  console.info(`[watchdog] เริ่มเฝ้า ${config.targets.map((t) => t.url).join(", ")} ทุก ${config.intervalMs / 1000} วินาที`);
  await sendTelegram(config, formatWatchdogMessage("start", {
    name: config.targets.map((t) => `${t.name}: ${t.url}`).join("\n"),
    reason: `${config.intervalMs / 1000} วินาที · แจ้งเมื่อล้มเหลว ${config.failuresBeforeAlert} ครั้งติดกัน`,
    now: Date.now()
  }));
  const loop = async () => {
    await checkAll(config, states).catch((error) => console.warn("[watchdog]", error?.message || error));
    setTimeout(loop, config.intervalMs);
  };
  loop();
}

const isMain = Boolean(process.argv[1]?.endsWith("uptime-watchdog.mjs"));
if (isMain) main();
