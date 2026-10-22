// อ่าน/บันทึกสถานะความพร้อมของเจ้าหน้าที่ (ฝั่งเซิร์ฟเวอร์)
import { query, transaction } from "@/lib/db";
import { escapeTelegramHtml } from "@/lib/telegram";
import { readinessMeta } from "@/lib/officerReadiness";

const OFFICER_NAME = "TRIM(CONCAT(COALESCE(o.title, ''), COALESCE(o.given_name, ''), ' ', COALESCE(o.family_name, '')))";

export async function getReadiness(officerId) {
  const rows = await query(
    `SELECT r.status, r.note, r.source, r.updated_at, u.username AS updated_by_username
     FROM officer_readiness r LEFT JOIN officer u ON u.id = r.updated_by
     WHERE r.officer_id = ?`,
    [officerId]
  );
  return rows[0] || null;
}

/** บันทึกสถานะ + ประวัติ (transaction เดียว) คืนสถานะก่อนหน้า */
export async function setReadiness({ officerId, status, note, source = "self", updatedBy }) {
  return transaction(async (execute) => {
    const before = await execute("SELECT status FROM officer_readiness WHERE officer_id = ? FOR UPDATE", [officerId]);
    const previous = before[0]?.status || null;
    await execute(
      `INSERT INTO officer_readiness (officer_id, status, note, source, updated_by, updated_at)
       VALUES (?, ?, ?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE status = VALUES(status), note = VALUES(note), source = VALUES(source),
         updated_by = VALUES(updated_by), updated_at = NOW()`,
      [officerId, status, note, source, updatedBy]
    );
    await execute(
      `INSERT INTO officer_readiness_log (officer_id, status, previous_status, note, source, updated_by) VALUES (?, ?, ?, ?, ?, ?)`,
      [officerId, status, previous, note, source, updatedBy]
    );
    return { previous };
  });
}

/** เจ้าหน้าที่ทุกคนที่อนุมัติแล้วและไม่ถูกระงับ พร้อมสถานะล่าสุด */
export async function listReadiness() {
  return query(
    `SELECT o.id, o.username, o.title, o.given_name, o.family_name, o.position, o.department, o.role, o.phone,
            ${OFFICER_NAME} AS full_name,
            r.status, r.note, r.source, r.updated_at, u.username AS updated_by_username
     FROM officer o
     LEFT JOIN officer_readiness r ON r.officer_id = o.id
     LEFT JOIN officer u ON u.id = r.updated_by
     WHERE COALESCE(o.is_approved, 0) = 1
       AND (o.account_locked_until IS NULL OR o.account_locked_until < '9999-01-01')
       AND o.role <> 'citizen'
     ORDER BY o.given_name, o.family_name`,
    []
  );
}

export async function readinessHistory(officerId, limit = 20) {
  return query(
    `SELECT l.status, l.previous_status, l.note, l.source, l.created_at, u.username AS updated_by_username
     FROM officer_readiness_log l LEFT JOIN officer u ON u.id = l.updated_by
     WHERE l.officer_id = ? ORDER BY l.created_at DESC, l.id DESC LIMIT ${Math.min(100, Math.max(1, Number(limit) || 20))}`,
    [officerId]
  );
}

/** เจ้าหน้าที่ขอความช่วยเหลือ → แจ้ง Telegram กลุ่มเจ้าหน้าที่ + แอดมิน (ไม่รอผล ไม่ทำให้การบันทึกล้ม) */
export function notifyNeedHelp(officer, note) {
  if (!process.env.TELEGRAM_BOT_TOKEN) return;
  const name = [officer.title, officer.given_name, officer.family_name].filter(Boolean).join("") || officer.username;
  const body = [
    `<b>${escapeTelegramHtml(readinessMeta("need_help").label)}</b>`,
    `เจ้าหน้าที่: ${escapeTelegramHtml(name)} (${escapeTelegramHtml(officer.username || "-")})`,
    officer.department ? `หน่วยงาน: ${escapeTelegramHtml(officer.department)}` : null,
    officer.phone ? `โทร: ${escapeTelegramHtml(officer.phone)}` : null,
    `รายละเอียด: ${escapeTelegramHtml(note || "-")}`,
    "ดูทั้งหมดที่เมนู สถานะความพร้อมเจ้าหน้าที่"
  ].filter(Boolean).join("\n");
  import("@/lib/telegramChannels")
    .then(({ sendCategorized }) => sendCategorized("staff", body))
    .catch((error) => console.error("แจ้งเจ้าหน้าที่ขอความช่วยเหลือไม่สำเร็จ:", error?.message || error));
}
