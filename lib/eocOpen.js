import { query } from "@/lib/db";

// ปุ่ม "ขอความช่วยเหลือ" ของประชาชนใช้ได้เฉพาะเมื่อมีศูนย์ปฏิบัติการ (EOC) เปิดอยู่เท่านั้น
// ใช้ฟังก์ชันนี้ที่ฝั่งเซิร์ฟเวอร์เป็นตัวตัดสิน (หน้าเว็บแค่แสดงผลตามผลนี้)
export const HELP_CLOSED_MESSAGE =
  "ขณะนี้ศูนย์ปฏิบัติการ (EOC) ยังไม่เปิด จึงยังไม่รับคำขอความช่วยเหลือผ่านเว็บไซต์ หากเป็นเหตุฉุกเฉินโทร 1669";

export const PROBLEM_CLOSED_MESSAGE =
  "ขณะนี้ศูนย์ปฏิบัติการ (EOC) ยังไม่เปิด จึงยังไม่รับแจ้งจุดปัญหาผ่านเว็บไซต์ หากเป็นเหตุฉุกเฉินโทร 1669 หรือ 1784";

// เหตุการณ์ที่ "เปิดอยู่จริง": ครั้งที่สถานะ active และสวิตช์ EOC ของประเภทนั้น (eoc_status) ไม่ได้ปิดไว้
// กันกรณีข้อมูลเก่ามีครั้งที่ค้างสถานะ active ทั้งที่ปิด EOC แล้ว → หน้าประชาชนยังแสดงศูนย์พักพิง/ปุ่มขอความช่วยเหลือ
export async function getOpenEocSessions() {
  try {
    return await query(
      `SELECT es.id, es.eoc_type, es.session_number, es.disease_name
       FROM eoc_sessions es
       WHERE es.status = 'active'
         AND NOT EXISTS (SELECT 1 FROM eoc_status st WHERE st.eoc_type = es.eoc_type AND st.is_active = 0)
       ORDER BY es.opened_at DESC`,
      []
    );
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") throw error;
    return query(
      `SELECT id, eoc_type, session_number, disease_name FROM eoc_sessions WHERE status = 'active' ORDER BY opened_at DESC`,
      []
    );
  }
}

export async function hasOpenEoc() {
  const sessions = await getOpenEocSessions();
  return sessions.length > 0;
}

export const WATER_CLOSED_MESSAGE =
  "ขณะนี้ยังไม่ได้เปิดศูนย์ปฏิบัติการด้านอุทกภัย จึงยังไม่รับรายงานระดับน้ำผ่านเว็บไซต์ หากเป็นเหตุฉุกเฉินโทร 1669 หรือ 1784";
