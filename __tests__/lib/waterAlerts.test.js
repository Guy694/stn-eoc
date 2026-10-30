import { detectWaterAlerts, formatWaterAlertTelegram, isDangerResolved, nextState, rawState, thresholdsFromEnv } from "@/lib/waterAlerts";

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

// ─── สถานี ปภ. 5 ระดับ [ทดสอบ] ───────────────────────────────────────────
describe("สถานี ปภ. แยก 5 ระดับ", () => {
  const TH = { watch: 2, warning: 3, danger: 4, critical: 5 };
  const dpm = (statusCode, level, over = {}) => ({
    id: "STN05", name: "[ทดสอบ] สะพานข้ามคลองท่าแพ", amphoe: "ท่าแพ", tambon: "ท่าแพ", river: "คลองท่าแพ", source: "ddpm",
    statusCode, level, waterLevelMsl: level, bankLevelMsl: 6, bankDiff: level - 6, thresholds: TH, observedAt: new Date().toISOString(), ...over
  });
  const run = (prev, station) => detectWaterAlerts([station], new Map([[station.id, prev]]));

  test("ขึ้นทีละระดับ แจ้งทุกครั้ง พร้อมชื่อระดับและเกณฑ์ถัดไป", () => {
    const steps = [["normal", dpm(2, 2.1), "watch", "เฝ้าระวัง", "serious"], ["watch", dpm(3, 3.05), "warning", "เตือนภัย", "serious"],
      ["warning", dpm(4, 4.1), "danger", "อันตราย", "critical"], ["danger", dpm(5, 5.2), "critical", "วิกฤต", "critical"]];
    for (const [prev, station, state, label, level] of steps) {
      const { alerts } = run(prev, station);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({ state, previousState: prev, level });
      expect(alerts[0].title).toContain(`ระดับน้ำ${label}`);
    }
    expect(run("normal", dpm(3, 3.05)).alerts[0].lines.join("\n")).toMatch(/เกณฑ์ถัดไป: อันตราย 4\.00 ม\. \(อีก 0\.95 ม\.\)/);
  });

  test("แนวโน้มจากรอบตรวจแสดงในข้อความ", () => {
    const station = dpm(3, 3.05, { trend: { arrow: "↑", label: "น้ำขึ้น" } });
    expect(run("watch", station).alerts[0].lines.join("\n")).toContain("แนวโน้ม: ↑ น้ำขึ้น");
  });

  test("ลดระดับ: กันแกว่งรอบเกณฑ์ และแจ้งเฉพาะตอนลงจากอันตรายหรือกลับปกติ", () => {
    // ต่ำกว่าเกณฑ์อันตราย (4) เพียง 0.03 ม. ยังไม่ถือว่าลด
    expect(run("danger", dpm(3, 3.97)).updates[0].state).toBe("danger");
    expect(run("danger", dpm(3, 3.97)).alerts).toHaveLength(0);
    // ลดพ้นเกณฑ์ 0.10 ม. → ลดระดับ และแจ้ง
    const down = run("danger", dpm(3, 3.8));
    expect(down.updates[0].state).toBe("warning");
    expect(down.alerts[0]).toMatchObject({ level: "info", previousState: "danger", state: "warning" });
    expect(down.alerts[0].title).toContain("ลดลงเป็นเตือนภัย");
    // เตือนภัย → เฝ้าระวัง เงียบ · เตือนภัย → ปกติ แจ้งว่ากลับปกติ · เฝ้าระวัง → ปกติ เงียบ
    expect(run("warning", dpm(2, 2.5)).alerts).toHaveLength(0);
    expect(run("warning", dpm(1, 1.5)).alerts[0].title).toContain("กลับสู่เกณฑ์ปกติ");
    expect(run("watch", dpm(1, 1.5)).alerts).toHaveLength(0);
  });

  test("เกณฑ์ที่ไม่มีค่า (null) ไม่ถูกตีเป็น 0 จนลดระดับไม่ได้", () => {
    const station = dpm(1, 1.5, { thresholds: { watch: null, warning: null, danger: null, critical: null } });
    expect(run("danger", station).updates[0].state).toBe("normal");
  });

  test("สถานะเดิมแบบ near/overflow ในฐานข้อมูลอ่านเป็นเฝ้าระวัง/อันตราย", () => {
    expect(run("overflow", dpm(5, 5.2)).alerts[0]).toMatchObject({ previousState: "danger", state: "critical" });
    expect(run("near", dpm(2, 2.1)).alerts).toHaveLength(0);
  });

  test("isDangerResolved: ลงจากอันตราย/วิกฤตเท่านั้น", () => {
    const a = (previousState, state) => ({ kind: "water", source: "ddpm", previousState, state });
    expect(isDangerResolved(a("danger", "warning"))).toBe(true);
    expect(isDangerResolved(a("critical", "danger"))).toBe(false);
    expect(isDangerResolved(a("warning", "watch"))).toBe(false);
    expect(isDangerResolved({ kind: "water", previousState: "overflow", state: "near" })).toBe(true);
  });
});
