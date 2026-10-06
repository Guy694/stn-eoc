import { query } from "@/lib/db";

// ปุ่ม "ขอความช่วยเหลือ" ของประชาชนใช้ได้เฉพาะเมื่อมีศูนย์ปฏิบัติการ (EOC) เปิดอยู่เท่านั้น
// ใช้ฟังก์ชันนี้ที่ฝั่งเซิร์ฟเวอร์เป็นตัวตัดสิน (หน้าเว็บแค่แสดงผลตามผลนี้)
export const HELP_CLOSED_MESSAGE =
  "ขณะนี้ศูนย์ปฏิบัติการ (EOC) ยังไม่เปิด จึงยังไม่รับคำขอความช่วยเหลือผ่านเว็บไซต์ หากเป็นเหตุฉุกเฉินโทร 1669";

export const PROBLEM_CLOSED_MESSAGE =
  "ขณะนี้ศูนย์ปฏิบัติการ (EOC) ยังไม่เปิด จึงยังไม่รับแจ้งจุดปัญหาผ่านเว็บไซต์ หากเป็นเหตุฉุกเฉินโทร 1669 หรือ 1784";

export async function getOpenEocSessions() {
  return query(
    `SELECT id, eoc_type, session_number, disease_name
     FROM eoc_sessions
     WHERE status = 'active'
     ORDER BY opened_at DESC`,
    []
  );
}

export async function hasOpenEoc() {
  const sessions = await getOpenEocSessions();
  return sessions.length > 0;
}
