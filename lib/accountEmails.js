// อีเมลแจ้งผลการสมัครเข้าใช้ระบบของเจ้าหน้าที่ (อนุมัติ / ไม่อนุมัติ)
// ส่งไม่ได้ไม่ทำให้การอนุมัติล้มเหลว — คืนผลให้หน้าผู้ดูแลแจ้งว่าส่งแล้วหรือไม่ส่งเพราะอะไร
import { getRoleDisplayName } from "./auth.js";
import { isMailConfigured, isValidEmail, sendMail } from "./mailer.js";
import { getSiteUrl } from "./siteUrl.js";

const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char]));

function displayName(officer) {
  return [officer?.title, officer?.given_name, officer?.family_name].filter(Boolean).join(" ").trim() || officer?.username || "เจ้าหน้าที่";
}

function wrapHtml(title, paragraphs, action) {
  const body = paragraphs.map((text) => `<p style="margin:0 0 12px;line-height:1.6">${text}</p>`).join("");
  const button = action
    ? `<p style="margin:20px 0"><a href="${escapeHtml(action.href)}" style="display:inline-block;background:#0b4c86;color:#fff;text-decoration:none;font-weight:bold;padding:10px 18px;border-radius:8px">${escapeHtml(action.label)}</a></p>`
    : "";
  return `<!doctype html><html lang="th"><body style="margin:0;background:#f1f5f9;font-family:Tahoma,'Noto Sans Thai',sans-serif;color:#0f172a">
<div style="max-width:560px;margin:0 auto;padding:24px 16px">
<div style="background:#0b4c86;color:#fff;padding:16px 20px;border-radius:12px 12px 0 0;font-weight:bold">ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล</div>
<div style="background:#fff;padding:20px;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:0">
<h1 style="font-size:18px;margin:0 0 14px">${escapeHtml(title)}</h1>${body}${button}
<p style="margin:16px 0 0;font-size:12px;color:#64748b">อีเมลนี้ส่งอัตโนมัติจากระบบ ไม่ต้องตอบกลับ หากไม่ได้สมัครใช้งานระบบนี้ แจ้งผู้ดูแลระบบของศูนย์ฯ</p>
</div></div></body></html>`;
}

export function buildApprovalEmail(officer, { siteUrl = getSiteUrl() } = {}) {
  const name = displayName(officer);
  const role = getRoleDisplayName(officer?.role) || officer?.role || "เจ้าหน้าที่";
  const loginUrl = `${siteUrl}/login`;
  const subject = "อนุมัติบัญชีเข้าใช้ระบบ ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล แล้ว";
  const lines = [
    `เรียน ${name}`,
    `ผู้ดูแลระบบอนุมัติบัญชีของท่านให้เข้าใช้ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล แล้ว`,
    `ชื่อผู้ใช้: ${officer?.username || "-"}`,
    `สิทธิ์การใช้งาน: ${role}`,
    `เข้าสู่ระบบด้วยวิธีเดียวกับที่ใช้สมัคร (ชื่อผู้ใช้และรหัสผ่าน หรือ ThaiD / Provider ID)`
  ];
  const text = `${lines.join("\n")}\n\nเข้าสู่ระบบ: ${loginUrl}\n\nอีเมลนี้ส่งอัตโนมัติจากระบบ ไม่ต้องตอบกลับ`;
  const html = wrapHtml(subject, [
    `เรียน ${escapeHtml(name)}`,
    "ผู้ดูแลระบบอนุมัติบัญชีของท่านให้เข้าใช้ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล แล้ว",
    `<strong>ชื่อผู้ใช้:</strong> ${escapeHtml(officer?.username || "-")}<br><strong>สิทธิ์การใช้งาน:</strong> ${escapeHtml(role)}`,
    "เข้าสู่ระบบด้วยวิธีเดียวกับที่ใช้สมัคร (ชื่อผู้ใช้และรหัสผ่าน หรือ ThaiD / Provider ID)"
  ], { href: loginUrl, label: "เข้าสู่ระบบ" });
  return { subject, text, html };
}

export function buildRejectionEmail(officer, reason) {
  const name = displayName(officer);
  const subject = "ผลการสมัครเข้าใช้ระบบ ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน จังหวัดสตูล: ไม่อนุมัติ";
  const why = String(reason || "").trim() || "-";
  const text = [
    `เรียน ${name}`,
    "ผู้ดูแลระบบพิจารณาคำขอเข้าใช้ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล ของท่านแล้ว และยังไม่อนุมัติในครั้งนี้",
    `เหตุผล: ${why}`,
    "หากต้องการแก้ไขข้อมูลหรือสอบถาม ติดต่อผู้ดูแลระบบของศูนย์ฯ",
    "",
    "อีเมลนี้ส่งอัตโนมัติจากระบบ ไม่ต้องตอบกลับ"
  ].join("\n");
  const html = wrapHtml(subject, [
    `เรียน ${escapeHtml(name)}`,
    "ผู้ดูแลระบบพิจารณาคำขอเข้าใช้ศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล ของท่านแล้ว และยังไม่อนุมัติในครั้งนี้",
    `<strong>เหตุผล:</strong> ${escapeHtml(why)}`,
    "หากต้องการแก้ไขข้อมูลหรือสอบถาม ติดต่อผู้ดูแลระบบของศูนย์ฯ"
  ]);
  return { subject, text, html };
}

/**
 * ส่งอีเมลแจ้งผล — ไม่ throw
 * @returns {Promise<{ sent: boolean, reason?: string, to?: string }>}
 */
export async function notifyAccountDecision(officer, decision, { reason, send = sendMail, configured = isMailConfigured() } = {}) {
  const to = String(officer?.email || "").trim();
  if (!isValidEmail(to)) return { sent: false, reason: "ไม่มีอีเมลที่ใช้ได้ในบัญชีนี้" };
  if (!configured) return { sent: false, reason: "ระบบยังไม่ได้ตั้งค่าเซิร์ฟเวอร์อีเมล" };
  const message = decision === "approved" ? buildApprovalEmail(officer) : buildRejectionEmail(officer, reason);
  try {
    await send({ to, ...message });
    return { sent: true, to };
  } catch (error) {
    console.error("ส่งอีเมลแจ้งผลการสมัครไม่สำเร็จ:", error?.message || error);
    return { sent: false, reason: "ส่งอีเมลไม่สำเร็จ (ตรวจการตั้งค่าเซิร์ฟเวอร์อีเมล)" };
  }
}

/** ข้อความสั้นสำหรับแจ้งผู้ดูแลหลังอนุมัติ/ปฏิเสธ */
export function emailOutcomeText(outcome) {
  if (!outcome) return "";
  return outcome.sent ? `ส่งอีเมลแจ้งไปที่ ${outcome.to} แล้ว` : `ไม่ได้ส่งอีเมล: ${outcome.reason}`;
}
