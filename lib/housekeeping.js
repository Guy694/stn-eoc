// งานบ้านประจำวัน (production): ลบ session ที่หมดอายุนานแล้ว และตัวนับ rate limit ที่หมดอายุ
// การลบข้อมูลประชาชนตามระยะเก็บ (PDPA) ไม่ทำอัตโนมัติ — ใช้ npm run pdpa:retention -- --apply ตามรอบที่ตกลงกัน
import { query } from "@/lib/db";
import { HOUSEKEEPING } from "@/lib/pdpaRetention.mjs";
import { withSchedulerLock } from "@/lib/schedulerLock";

export async function runHousekeeping() {
  const result = {};
  for (const [label, sql] of HOUSEKEEPING) {
    try {
      result[label] = (await query(sql)).affectedRows || 0;
    } catch (error) {
      if (error?.code !== "ER_NO_SUCH_TABLE") console.warn(`[housekeeping] ${label}:`, error.message);
    }
  }
  return result;
}

export function startHousekeeping() {
  if (process.env.NODE_ENV !== "production" || String(process.env.HOUSEKEEPING || "").toLowerCase() === "off") return false;
  if (globalThis.__housekeepingTimer) return true;
  const tick = () => withSchedulerLock("housekeeping", runHousekeeping)
    .then((result) => {
      if (result?.skipped) return;
      const removed = Object.values(result).reduce((sum, value) => sum + value, 0);
      if (removed) console.info(`[housekeeping] ลบข้อมูลหมดอายุ ${removed} แถว`);
    })
    .catch((error) => console.warn("[housekeeping] ไม่สำเร็จ:", error.message));
  globalThis.__housekeepingTimer = setInterval(tick, 24 * 60 * 60 * 1000);
  setTimeout(tick, 5 * 60 * 1000);
  return true;
}
