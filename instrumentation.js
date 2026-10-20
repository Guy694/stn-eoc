// เริ่มงานเบื้องหลังของเซิร์ฟเวอร์ (Next.js เรียกครั้งเดียวตอนเซิร์ฟเวอร์เริ่ม)
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // ต่อเครือข่ายภายนอกด้วย IPv4 ก่อน และไม่สลับ IPv4/IPv6 อัตโนมัติ
  // Node 22 ลองแต่ละที่อยู่เพียง 250 ms แล้วข้ามไปที่อยู่ถัดไป (รวม IPv6 ที่ container ใช้ไม่ได้) — ปลายทางที่ไกล
  // เช่น Apple (web.push.apple.com) จึงหมดเวลาทุกที่อยู่ (ETIMEDOUT) ทั้งที่เครื่อง host ต่อได้ → iPhone ไม่ได้รับแจ้งเตือน
  // ปิดได้ด้วย NETWORK_IPV4_FIRST=off
  if (!["off", "0", "false", "no"].includes(String(process.env.NETWORK_IPV4_FIRST || "").trim().toLowerCase())) {
    const [{ setDefaultResultOrder }, net] = await Promise.all([import("node:dns"), import("node:net")]);
    setDefaultResultOrder("ipv4first");
    net.setDefaultAutoSelectFamily?.(false);
  }
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
