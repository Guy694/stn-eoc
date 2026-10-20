import { buildTestAlert, serverChecklist } from "@/lib/alertTest";

describe("alertTest", () => {
  test("แจ้งเตือนทดสอบติดป้าย [ทดสอบ] ทุกแบบ", () => {
    const water = buildTestAlert({ kind: "water", level: "critical", by: "แอดมิน" });
    expect(water).toMatchObject({ kind: "water", level: "critical", state: "overflow" });
    expect(water.title).toContain("[ทดสอบ]");
    expect(water.message).toContain("ไม่ใช่เหตุการณ์จริง");
    expect(water.message).toContain("แอดมิน");
    expect(buildTestAlert({ kind: "rain", level: "serious" })).toMatchObject({ kind: "rain", level: "serious", state: "watch" });
    expect(buildTestAlert({ level: "bogus" }).level).toBe("critical");
  });

  test("รายการตรวจบอกว่าข้อไหนยังไม่พร้อม", () => {
    const checks = serverChecklist({
      now: Date.now(), scheduler: "10", logReady: true, lastAlert: { title: "x", created_at: new Date().toISOString() }, alerts24h: 2,
      telegramReady: true, sendingEnabled: true, vapidReady: true, pushAuto: false, subscriptions: 3, officerDevices: 1
    });
    const failing = checks.filter((c) => !c.ok).map((c) => c.key);
    expect(failing).toEqual(["auto"]);
    expect(checks.find((c) => c.key === "log").detail).toContain("24 ชม. 2 เรื่อง");
  });
});
