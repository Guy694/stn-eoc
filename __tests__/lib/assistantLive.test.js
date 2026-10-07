import { actionsForTopic, answerLive, buildSnapshot, detectDistrict, detectLiveIntent } from "@/lib/assistantLive";

const data = {
  now: Date.parse("2026-10-07T15:00:00Z"),
  districts: [
    {
      district_name: "ละงู", risk_level: "watch", risk_reasons: ["ฝนวัดได้ 40 มม. ใน 24 ชม."], weather_condition: "ฝนตกปานกลาง",
      rain_now: { stations: 4, raining: 2 }, rain_now_text: "ฝนตกปานกลาง (2/4 สถานี)", rainfall_24h: 40, rain_source: "gauge",
      rain_gauge: { max_station: "บ้านนาข่า" }, heavy_rain_today: { prob_heavy: 30 }, heavy_rain_tomorrow: { prob_heavy: 55 }, temperature: 26,
      forecast_daily: [
        { forecast_datetime: "2026-10-07T12:00:00+07:00", weather_condition: "ฝนตก", rainfall_median: 20, prob_heavy: 30, risk_level: "watch" },
        { forecast_datetime: "2026-10-08T12:00:00+07:00", weather_condition: "ฝนตกหนัก", rainfall_median: 38, prob_heavy: 55, risk_level: "watch" }
      ]
    },
    { district_name: "เมืองสตูล", risk_level: "normal", risk_reasons: [], weather_condition: "มีเมฆมาก", rain_now: { stations: 3, raining: 0 }, rainfall_24h: 2, temperature: 28, forecast_daily: [] }
  ],
  warnings: [],
  waterStations: [
    { id: "1", name: "ละงู", river: "คลองละงู", amphoe: "ละงู", bankDiff: -0.3, trend: { label: "น้ำขึ้น" } },
    { id: "2", name: "เมืองสตูล", river: "คลองมำบัง", amphoe: "เมืองสตูล", bankDiff: -1.2 }
  ],
  waterObservedAt: "2026-10-07T14:40:00Z",
  shelters: [],
  sheltersOpen: false,
  facilities: [{ name: "รพ.ละงู", typecode: "รพ.ชุมชน", district_name: "ละงู", service_status: "open" }],
  openEvents: []
};

describe("assistantLive", () => {
  test("หาอำเภอจากข้อความ และใช้พื้นที่ของผู้ใช้เมื่อไม่ได้ระบุ", () => {
    expect(detectDistrict("ฝนที่ละงูตอนนี้")).toBe("ละงู");
    expect(detectDistrict("อำเภอเมืองน้ำท่วมไหม")).toBe("เมืองสตูล");
    expect(detectDistrict("ฝนตกไหม", "อ.ท่าแพ")).toBe("ท่าแพ");
    expect(detectDistrict("ฝนตกไหม", "กรุงเทพ")).toBeNull();
  });

  test("แยกประเภทคำถามสด และไม่จับคำถามความรู้ทั่วไป", () => {
    expect(detectLiveIntent("ระดับน้ำคลองละงูตอนนี้")).toBe("water");
    expect(detectLiveIntent("พรุ่งนี้ฝนจะตกหนักไหม")).toBe("forecast");
    expect(detectLiveIntent("ตอนนี้ฝนตกที่ไหนบ้าง")).toBe("rain");
    expect(detectLiveIntent("ศูนย์พักพิงที่ใกล้ที่สุด")).toBe("shelter");
    expect(detectLiveIntent("จะติดตามคำขอได้ยังไง")).toBe("track");
    expect(detectLiveIntent("น้ำท่วมควรเตรียมตัวอย่างไร")).toBeNull();
  });

  test("ตอบระดับน้ำของอำเภอที่ถาม", () => {
    const result = answerLive("ระดับน้ำที่ละงูเป็นยังไง", data);
    expect(result.intent).toBe("water");
    expect(result.answer).toMatch(/ใกล้ตลิ่ง/);
    expect(result.answer).toMatch(/น้ำขึ้น/);
    expect(result.actions.length).toBeGreaterThan(0);
  });

  test("ตอบฝนและพยากรณ์ตามพื้นที่ของผู้ใช้", () => {
    expect(answerLive("ฝนตอนนี้เป็นยังไง", data, { district: "ละงู" }).answer).toMatch(/40 มม/);
    expect(answerLive("พรุ่งนี้ฝนจะตกไหม", data, { district: "ละงู" }).answer).toMatch(/พรุ่งนี้.*55%/);
  });

  test("ศูนย์พักพิงตอน EOC ปิด และประกาศเตือนตอนไม่มี", () => {
    expect(answerLive("ศูนย์พักพิงอยู่ที่ไหน", data).answer).toMatch(/ยังไม่มีศูนย์พักพิงที่เปิด/);
    expect(answerLive("มีประกาศเตือนไหม", data).answer).toMatch(/ยังไม่มีประกาศเตือน/);
  });

  test("สรุปข้อมูลให้ AI มีเวลาและพื้นที่", () => {
    const snapshot = buildSnapshot(data, { district: "ละงู" });
    expect(snapshot).toMatch(/อ\.ละงู: ความเสี่ยงเฝ้าระวัง/);
    expect(snapshot).toMatch(/สถานีน้ำ ละงู/);
    expect(snapshot).toMatch(/ผู้ใช้สนใจพื้นที่: อ\.ละงู/);
  });

  test("ปุ่มลัดสำหรับคำตอบจาก AI มาจากรายการที่กำหนด", () => {
    expect(actionsForTopic("น้ำท่วมควรเตรียมตัวอย่างไร")[0].href).toBe("/public/my-risk");
    expect(actionsForTopic("สวัสดี")).toEqual([]);
  });
});
