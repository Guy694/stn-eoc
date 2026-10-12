// เริ่มงานเบื้องหลังของเซิร์ฟเวอร์ (Next.js เรียกครั้งเดียวตอนเซิร์ฟเวอร์เริ่ม)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { startWaterAlertScheduler } = await import("./lib/waterAlertRunner");
  startWaterAlertScheduler();
  const { startPublicPushScheduler } = await import("./lib/publicPushServer");
  startPublicPushScheduler();
  const { startDpmWaterScheduler } = await import("./lib/dpmWaterServer");
  startDpmWaterScheduler();
}
