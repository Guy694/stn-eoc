import { detectWaterAlerts, formatWaterAlertTelegram, nextState, rawState, thresholdsFromEnv } from "@/lib/waterAlerts";

const NOW = Date.parse("2026-10-07T12:00:00+07:00");
const station = (bankDiff, over = {}) => ({
  id: "1095881",
  name: "บ้านปันจอร์",
  river: "คลองดุสน",
  tambon: "ย่านซื่อ",
  amphoe: "ควนโดน",
  bankDiff,
  waterLevelMsl: 23.2 + bankDiff,
  bankLevelMsl: 23.2,
  situationLevel: bankDiff > 0 ? 5 : 3,
  trend: { value: "rising", label: "น้ำขึ้น", arrow: "↑", change: 0.15 },
  observedAt: "2026-10-07T11:40:00+07:00",
  ...over
});
const run = (stations, states = new Map()) => detectWaterAlerts(stations, states, { now: NOW });

describe("waterAlerts", () => {
  test("สถานะตามระยะห่างตลิ่ง", () => {
    expect(rawState(station(-3.19))).toBe("normal");
    expect(rawState(station(-0.4))).toBe("near");
    expect(rawState(station(0.05))).toBe("overflow");
    expect(rawState({ bankDiff: null, situationLevel: 5 })).toBe("overflow");
    expect(rawState({ bankDiff: null, situationLevel: 3 })).toBeNull();
  });

  test("ปกติ → ล้นตลิ่ง แจ้งระดับวิกฤต พร้อมรายละเอียด", () => {
    const { alerts, updates } = run([station(0.12)]);
    expect(updates[0].state).toBe("overflow");
    expect(alerts).toHaveLength(1);
    expect(alerts[0]).toMatchObject({ level: "critical", state: "overflow", previousState: "normal" });
    expect(alerts[0].title).toBe("🚨 น้ำล้นตลิ่ง — สถานีบ้านปันจอร์");
    expect(alerts[0].lines).toContain("สูงกว่าตลิ่ง 0.12 ม.");
    expect(alerts[0].lines.join("\n")).toMatch(/↑ น้ำขึ้น \(\+0\.15 ม\.\)/);
  });

  test("ไม่แจ้งซ้ำเมื่อสถานะเดิม", () => {
    expect(run([station(0.3)], new Map([["1095881", "overflow"]])).alerts).toHaveLength(0);
    expect(run([station(-2)], new Map([["1095881", "normal"]])).alerts).toHaveLength(0);
  });

  test("ใกล้ล้น → ล้น แจ้งอีกครั้ง (สถานการณ์แย่ลง)", () => {
    const first = run([station(-0.3)]);
    expect(first.alerts[0].level).toBe("serious");
    const second = run([station(0.01)], new Map([["1095881", "near"]]));
    expect(second.alerts[0].level).toBe("critical");
  });

  test("กันแกว่ง: น้ำปริ่มตลิ่งขึ้นลงไม่แจ้งรัว", () => {
    const states = new Map([["1095881", "overflow"]]);
    expect(nextState("overflow", station(-0.05))).toBe("overflow");
    expect(run([station(-0.05)], states).alerts).toHaveLength(0);
    expect(nextState("near", station(-0.6))).toBe("near");
    expect(nextState("near", station(-0.71))).toBe("normal");
  });

  test("น้ำลดต่ำกว่าตลิ่ง แจ้งว่าคลี่คลาย / ใกล้ล้นกลับปกติไม่ต้องแจ้ง", () => {
    const down = run([station(-0.3)], new Map([["1095881", "overflow"]]));
    expect(down.alerts[0]).toMatchObject({ level: "info", state: "near", title: "✅ น้ำลดลงต่ำกว่าตลิ่งแล้ว — สถานีบ้านปันจอร์" });
    const quiet = run([station(-2)], new Map([["1095881", "near"]]));
    expect(quiet.alerts).toHaveLength(0);
    expect(quiet.updates[0]).toMatchObject({ state: "normal", changed: true });
  });

  test("ข้อมูลเก่าเกิน 3 ชม. ไม่ใช้ตัดสินการเตือน", () => {
    const { alerts, updates } = run([station(0.5, { observedAt: "2026-10-07T07:00:00+07:00" })]);
    expect(alerts).toHaveLength(0);
    expect(updates).toHaveLength(0);
  });

  test("ข้อความ Telegram escape และมีที่มา", () => {
    const [alert] = run([station(0.12, { name: "A<B" })]).alerts;
    const text = formatWaterAlertTelegram(alert, { escape: (value) => String(value).replace(/</g, "&lt;"), link: "https://eoc.example/stn-eoc/public/weather-watch" });
    expect(text).toContain("<b>🚨 น้ำล้นตลิ่ง — สถานีA&lt;B</b>");
    expect(text).toContain("ThaiWater");
    expect(text).toContain('href="https://eoc.example/stn-eoc/public/weather-watch"');
  });

  test("เกณฑ์ใกล้ล้นจาก env", () => {
    expect(thresholdsFromEnv({ WATER_ALERT_NEAR_M: "1" }).nearMeters).toBe(1);
    expect(thresholdsFromEnv({ WATER_ALERT_NEAR_M: "abc" }).nearMeters).toBe(0.5);
  });
});
