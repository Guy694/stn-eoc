// กันงานเบื้องหลังทำงานซ้อนกันเมื่อเปิดเซิร์ฟเวอร์หลายตัว (PM2 cluster / หลาย container)
// ใช้ MySQL GET_LOCK แบบไม่รอ: เครื่องที่ได้ล็อกทำงาน เครื่องอื่นข้ามรอบนั้น
// หมายเหตุ: ล็อกผูกกับการเชื่อมต่อ ถ้าเซิร์ฟเวอร์ดับกลางคัน MySQL ปล่อยล็อกให้เอง
import { getPool } from "@/lib/db";

export const LOCK_PREFIX = "stn-eoc:";

export async function withSchedulerLock(name, task, { pool = getPool() } = {}) {
  const key = `${LOCK_PREFIX}${name}`.slice(0, 64);
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query("SELECT GET_LOCK(?, 0) AS got", [key]);
    if (Number(rows?.[0]?.got) !== 1) return { skipped: true, reason: "locked" };
    try {
      return await task();
    } finally {
      await connection.query("SELECT RELEASE_LOCK(?)", [key]).catch(() => {});
    }
  } finally {
    connection.release();
  }
}
