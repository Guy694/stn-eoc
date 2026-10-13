// เริ่มงานเบื้องหลังของเซิร์ฟเวอร์ (Next.js เรียกครั้งเดียวตอนเซิร์ฟเวอร์เริ่ม)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // ตรวจค่าที่จำเป็นของ production — ไม่หยุดเซิร์ฟเวอร์ แต่เตือนใน log ให้ผู้ดูแลแก้
  if (process.env.NODE_ENV === "production") {
    const { productionConfigWarnings } = await import("./lib/configCheck");
    for (const warning of productionConfigWarnings()) console.warn(`[config] ${warning}`);
  }
  const { startWaterAlertScheduler } = await import("./lib/waterAlertRunner");
  startWaterAlertScheduler();
  const { startPublicPushScheduler } = await import("./lib/publicPushServer");
  startPublicPushScheduler();
  const { startDpmWaterScheduler } = await import("./lib/dpmWaterServer");
  startDpmWaterScheduler();
  const { startHousekeeping } = await import("./lib/housekeeping");
  startHousekeeping();
}
