import { answerResolved, buildSnapshot, detectLiveIntent, isAdviceQuestion, resolveQuestion, waterChange } from "@/lib/assistantLive";

const data = {
  now: Date.parse("2026-10-21T08:00:00Z"),
  districts: [{ district_name: "ละงู", risk_level: "watch", risk_reasons: ["[ทดสอบ] ฝน 40 มม."], weather_condition: "ฝนตก", rainfall_24h: 40, temperature: 26, forecast_daily: [] }],
  warnings: [],
  waterStations: [
    { id: "1", name: "[ทดสอบ] ละงู", river: "คลองละงู", amphoe: "ละงู", bankDiff: -0.3, waterLevel: 2.5 },
    { id: "2", name: "[ทดสอบ] เมืองสตูล", river: "คลองมำบัง", amphoe: "เมืองสตูล", bankDiff: -1.2, waterLevel: 1.0 }
  ],
  waterHistory: { 1: [{ t: "2026-10-20 15:00:00", level: 2.1 }, { t: "2026-10-21 14:00:00", level: 2.45 }] },
  waterObservedAt: "2026-10-21T07:40:00Z",
  shelters: [], sheltersOpen: false, facilities: [], openEvents: [{ type: "disease", label: "โรคไข้เลือดออก" }],
  sea: { status: { key: "high", label: "หนุนสูง", advice: "[ทดสอบ] เฝ้าระวังริมคลอง" }, observed_at: "2026-10-21T07:30:00Z", next_highs: [{ at: "2026-10-21T10:15:00Z" }], station: "ลังกาวี" },
  events: [{ type: "disease", label: "โรคระบาด", detail: { disease_name: "ไข้เลือดออก", patients_total: 120, patients_last7: 30, change_pct: 25, districts: [{ district: "ละงู", value: 50 }] } }],
  recentAlerts: [{ title: "[ทดสอบ] เฝ้าระวังน้ำท่วม", body: "ฝนตกหนัก", created_at: "2026-10-21T06:00:00Z" }],
  hotlines: [{ name: "[ทดสอบ] ศูนย์ฯ", phone: "000" }]
};

describe("ผู้ช่วย EOC: เข้าใจคำถามต่อเนื่อง", () => {
  const history = [{ role: "user", content: "ระดับน้ำในคลองตอนนี้" }, { role: "assistant", content: "..." }];

  test("\"แล้วละงูล่ะ\" ใช้หัวข้อจากคำถามก่อนหน้า และเปลี่ยนอำเภอ", () => {
    const resolved = resolveQuestion("แล้วละงูล่ะ", history);
    expect(resolved).toMatchObject({ intent: "water", district: "ละงู", followUp: true });
    expect(answerResolved(resolved, data).answer).toContain("ละงู");
  });

  test("คำถามใหม่ที่มีหัวข้อเอง ไม่ยึดหัวข้อเก่า", () => {
    expect(resolveQuestion("พรุ่งนี้ฝนจะตกหนักไหม", history)).toMatchObject({ intent: "forecast", followUp: false });
  });

  test("ไม่มีบทสนทนาก่อนหน้า: ไม่เดาหัวข้อ", () => {
    expect(resolveQuestion("แล้วละงูล่ะ", []).intent).toBeNull();
  });
});

describe("ผู้ช่วย EOC: แยกคำถามขอคำแนะนำ", () => {
  test("คำถามขอคำแนะนำส่งให้ AI คิดต่อ ส่วนคำถามสถานะตอบจากข้อมูลได้เลย", () => {
    expect(isAdviceQuestion("ควรอพยพไหม น้ำในคลองสูงแล้ว")).toBe(true);
    expect(isAdviceQuestion("ควรเตรียมของอะไรไปศูนย์พักพิง")).toBe(true);
    expect(isAdviceQuestion("พาผู้สูงอายุติดเตียงออกจากบ้านตอนนี้ได้ไหม")).toBe(true);
    expect(isAdviceQuestion("ระดับน้ำในคลองตอนนี้")).toBe(false);
  });
});

describe("ผู้ช่วย EOC: ข้อมูลใหม่ที่ตอบได้", () => {
  test("แนวโน้มน้ำ 24 ชม. จากประวัติ", () => {
    expect(waterChange(data.waterStations[0], data.waterHistory)).toBe(40);
    expect(waterChange(data.waterStations[1], data.waterHistory)).toBeNull();
    const resolved = resolveQuestion("ระดับน้ำคลองละงูตอนนี้", []);
    expect(answerResolved(resolved, data).answer).toContain("24 ชม. ขึ้น 40 ซม.");
  });

  test("น้ำทะเลหนุน ตัวเลขเหตุการณ์ และเบอร์ฉุกเฉิน", () => {
    expect(detectLiveIntent("น้ำทะเลหนุนวันนี้เป็นยังไง")).toBe("sea");
    expect(answerResolved({ intent: "sea" }, data).answer).toContain("หนุนสูง");
    expect(detectLiveIntent("ตอนนี้มีผู้ป่วยกี่ราย")).toBe("event");
    expect(answerResolved({ intent: "event" }, data).answer).toMatch(/ไข้เลือดออก.*120/);
    expect(detectLiveIntent("เบอร์ฉุกเฉินมีอะไรบ้าง")).toBe("hotline");
    expect(answerResolved({ intent: "hotline" }, data).answer).toContain("1669");
  });

  test("ข้อมูลที่ส่งให้ AI มีน้ำทะเล เหตุการณ์ แจ้งเตือนล่าสุด และเบอร์ฉุกเฉิน", () => {
    const snapshot = buildSnapshot(data);
    expect(snapshot).toContain("น้ำทะเลหน้าสตูล: หนุนสูง");
    expect(snapshot).toContain("ไข้เลือดออก");
    expect(snapshot).toContain("[ทดสอบ] เฝ้าระวังน้ำท่วม");
    expect(snapshot).toContain("1784");
    expect(snapshot).toContain("24 ชม. ขึ้น 40 ซม.");
  });
});
