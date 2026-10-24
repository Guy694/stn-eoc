#!/usr/bin/env node
// สรุปผล npm audit เป็นภาษาไทย และส่ง Telegram กลุ่มผู้ดูแลระบบเมื่อพบช่องโหว่ระดับสูงขึ้นไป
//   npm audit --omit=dev --json > audit.json ; node scripts/audit-report.mjs audit.json
// ใช้ใน GitHub Actions (.github/workflows/security-audit.yml) — ค่า Telegram มาจาก GitHub Secrets
//   TELEGRAM_BOT_TOKEN, TELEGRAM_SECURITY_CHAT_IDS
// exit code 1 เมื่อพบระดับ high/critical (ให้ workflow ขึ้นสีแดง)
import fs from "node:fs";

const LEVELS = ["critical", "high", "moderate", "low"];
const LEVEL_TH = { critical: "วิกฤต", high: "สูง", moderate: "ปานกลาง", low: "ต่ำ" };
const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

/** ผล npm audit (JSON v2) → { counts, items } */
export function summarizeAudit(report = {}) {
  const counts = Object.fromEntries(LEVELS.map((level) => [level, Number(report.metadata?.vulnerabilities?.[level] || 0)]));
  const items = Object.values(report.vulnerabilities || {})
    .filter((item) => item.severity === "critical" || item.severity === "high")
    .map((item) => {
      const advisory = (item.via || []).find((via) => typeof via === "object") || {};
      const fix = item.fixAvailable === true ? "แก้ได้ด้วย npm audit fix"
        : item.fixAvailable && typeof item.fixAvailable === "object" ? `อัปเกรด ${item.fixAvailable.name} เป็น ${item.fixAvailable.version}${item.fixAvailable.isSemVerMajor ? " (รุ่นหลัก ต้องทดสอบ)" : ""}`
        : "ยังไม่มีรุ่นแก้";
      return { name: item.name, severity: item.severity, title: advisory.title || "", url: advisory.url || "", fix };
    })
    .sort((a, b) => LEVELS.indexOf(a.severity) - LEVELS.indexOf(b.severity));
  return { counts, items };
}

export function formatAuditMessage({ counts, items }, { repo = "", runUrl = "" } = {}) {
  const rule = "━━━━━━━━━━━━";
  const lines = [
    "🔐 <b>ความปลอดภัยระบบ</b>",
    rule,
    `<b>พบช่องโหว่ในไลบรารี${repo ? ` (${esc(repo)})` : ""}</b>`,
    `วิกฤต ${counts.critical} · สูง ${counts.high} · ปานกลาง ${counts.moderate} · ต่ำ ${counts.low}`
  ];
  for (const item of items.slice(0, 8)) {
    lines.push(`• <b>${esc(item.name)}</b> [${LEVEL_TH[item.severity]}] ${esc(item.title)}`, `  ${esc(item.fix)}`);
  }
  if (items.length > 8) lines.push(`• และอีก ${items.length - 8} รายการ`);
  lines.push("ดูรายละเอียดและ PR อัปเกรดจาก Dependabot ใน GitHub");
  if (runUrl) lines.push(esc(runUrl));
  lines.push(rule, "ถึง: ผู้ดูแลระบบเท่านั้น");
  return lines.join("\n");
}

async function send(text, env = process.env) {
  const token = env.TELEGRAM_BOT_TOKEN;
  const chats = String(env.TELEGRAM_SECURITY_CHAT_IDS || "").split(/[\s,;]+/).filter(Boolean);
  if (!token || !chats.length) {
    console.log("ไม่ได้ตั้ง TELEGRAM_BOT_TOKEN / TELEGRAM_SECURITY_CHAT_IDS — ข้ามการส่ง");
    return;
  }
  for (const chatId of chats) {
    const response = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
    });
    console.log(`ส่ง Telegram: HTTP ${response.status}`);
  }
}

async function main() {
  const file = process.argv[2] || "audit.json";
  const raw = fs.readFileSync(file, "utf8");
  const report = JSON.parse(raw || "{}");
  if (!report.metadata) {
    console.error(`npm audit ไม่สำเร็จ: ${report.message || report.error?.summary || "ไม่มีผลตรวจ"}`);
    process.exitCode = 1;
    return;
  }
  const summary = summarizeAudit(report);
  console.log(`ช่องโหว่: วิกฤต ${summary.counts.critical} · สูง ${summary.counts.high} · ปานกลาง ${summary.counts.moderate} · ต่ำ ${summary.counts.low}`);
  for (const item of summary.items) console.log(`- ${item.name} [${item.severity}] ${item.title} — ${item.fix}`);
  if (!summary.items.length) return;
  const runUrl = process.env.GITHUB_SERVER_URL && process.env.GITHUB_RUN_ID
    ? `${process.env.GITHUB_SERVER_URL}/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}` : "";
  await send(formatAuditMessage(summary, { repo: process.env.GITHUB_REPOSITORY || "", runUrl }));
  process.exitCode = 1;
}

if (process.argv[1]?.endsWith("audit-report.mjs")) main();
