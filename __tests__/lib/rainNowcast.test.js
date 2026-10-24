import { bangkokText, blendTodayHeavyRain, districtRainToday, heavyRainNote, heavyRainTodayText, stationRainToday } from "@/lib/rainNowcast";

const today = "2026-10-24";
const at = (hh, mm = "00") => `${today} ${hh}:${mm}:00`;

describe("ฝนที่ตกแล้ววันนี้ (สถานี)", () => {
  test("รวมฝนรายชั่วโมงตั้งแต่เที่ยงคืน และไม่นับค่าที่ซ้ำ/คาบเกี่ยว", () => {
    const result = stationRainToday([
      { observedAt: "2026-10-23 23:50:00", rain1: 9, rain24: 40 }, // เมื่อวาน ไม่นับ
      { observedAt: at("01"), rain1: 2, rain24: 41 },
      { observedAt: at("02"), rain1: 5, rain24: 45 },
      { observedAt: at("02"), rain1: 5, rain24: 45 }, // ค่าเดิมซ้ำ
      { observedAt: at("02", "20"), rain1: 6, rain24: 47 }, // ห่างไม่ถึง 50 นาที คาบเกี่ยว
      { observedAt: at("03"), rain1: 4, rain24: 49 }
    ], { today });
    expect(result.mm).toBe(11);
    expect(result.observedAt).toBe(at("03"));
  });

  test("ชั่วโมงที่สถานีไม่ส่ง: ใช้ฝนสะสม 24 ชม. ล่าสุด − ค่าตอนเที่ยงคืน", () => {
    const result = stationRainToday([
      { observedAt: at("00", "05"), rain1: null, rain24: 10 },
      { observedAt: at("06"), rain1: 1, rain24: 34 }
    ], { today });
    expect(result.mm).toBe(24);
  });

  test("ไม่เกินฝนสะสม 24 ชม. ล่าสุด", () => {
    const result = stationRainToday([
      { observedAt: at("01"), rain1: 8, rain24: 8 },
      { observedAt: at("02"), rain1: 8, rain24: 12 }
    ], { today });
    expect(result.mm).toBe(12);
  });

  test("ไม่มีรายชั่วโมงแต่ฝน 24 ชม. เป็น 0 = ยังไม่ตก, ข้อมูลไม่พอ = null", () => {
    expect(stationRainToday([{ observedAt: at("09"), rain1: null, rain24: 0 }], { today })).toEqual({ mm: 0, observedAt: at("09") });
    expect(stationRainToday([{ observedAt: at("09"), rain1: null, rain24: 15 }], { today })).toBeNull();
    expect(stationRainToday([], { today })).toBeNull();
  });

  test("อำเภอใช้สถานีที่ตกมากที่สุด", () => {
    const result = districtRainToday([
      { name: "ก", readings: [{ observedAt: at("05"), rain1: 3, rain24: 3 }] },
      { name: "ข", readings: [{ observedAt: at("05"), rain1: 12, rain24: 12 }] },
      { name: "ค", readings: [] }
    ], { today });
    expect(result).toMatchObject({ mm: 12, station: "ข", stations: 2 });
    expect(districtRainToday([], { today })).toBeNull();
  });
});

describe("รวมกับพยากรณ์ชั่วโมงที่เหลือ", () => {
  // ตอนนี้ 21:30 เวลาไทย → เหลือชั่วโมง 22:00 และ 23:00
  const now = Date.parse("2026-10-24T14:30:00Z");
  const time = Array.from({ length: 24 }, (_, h) => `${today}T${String(h).padStart(2, "0")}:00`);
  const member = (late) => time.map((t) => (t.endsWith("22:00") || t.endsWith("23:00") ? late / 2 : 50)); // ชั่วโมงที่ผ่านไปแล้วไม่นับ
  const hourly = { time, precipitation: member(0), precipitation_member01: member(10), precipitation_member02: member(20), precipitation_member03: member(40) };

  test("บอกเวลาไทย", () => {
    expect(bangkokText(now)).toBe("2026-10-24 21:30:00");
  });

  test("ตกแล้ว 20 มม. ต้องการอีก 15 มม. → นับชุดที่ถึง", () => {
    const result = blendTodayHeavyRain({ observedMm: 20, hourly, today, now });
    expect(result).toMatchObject({ members: 4, hours_left: 2, observed_mm: 20, prob_heavy: 50, prob_very_heavy: 25, source: "gauge+forecast" });
  });

  test("ตกแล้วเกิน 35 มม. → 100%", () => {
    expect(blendTodayHeavyRain({ observedMm: 40, hourly, today, now }).prob_heavy).toBe(100);
  });

  test("ข้อมูลไม่ครบ → null (ใช้พยากรณ์ทั้งวันแทน)", () => {
    expect(blendTodayHeavyRain({ observedMm: null, hourly, today, now })).toBeNull();
    expect(blendTodayHeavyRain({ observedMm: 5, hourly: null, today, now })).toBeNull();
  });

  test("ชั่วโมงที่ไม่มีค่า (ข้อมูลทุก 3 ชม.) ไม่ทำให้เสีย", () => {
    const sparse = { time, precipitation: time.map((t) => (t.endsWith("23:00") ? 30 : null)) };
    expect(blendTodayHeavyRain({ observedMm: 10, hourly: sparse, today, now })).toMatchObject({ members: 1, prob_heavy: 100, remaining_median_mm: 30 });
  });
});

describe("ข้อความ", () => {
  test("แยกตามแหล่งข้อมูล", () => {
    expect(heavyRainTodayText({ prob_heavy: 12, source: "forecast" })).toBe("โอกาสฝนหนักวันนี้ 12%");
    expect(heavyRainTodayText({ prob_heavy: 12, source: "gauge+forecast", observed_mm: 0 })).toBe("โอกาสฝนหนักวันนี้ 12%");
    expect(heavyRainTodayText({ prob_heavy: 64, source: "gauge+forecast", observed_mm: 22 })).toBe("ฝนวันนี้ 22 มม. • โอกาสถึงฝนหนัก 64%");
    expect(heavyRainTodayText({ prob_heavy: 100, source: "gauge+forecast", observed_mm: 41.5 })).toBe("ฝนหนักแล้ววันนี้ (41.5 มม.)");
    expect(heavyRainTodayText(null)).toBeNull();
    expect(heavyRainNote({ source: "gauge+forecast", observed_mm: 22, observed_station: "บ้านควน", remaining_median_mm: 6, hours_left: 3 })).toBe("ตกแล้ว 22 มม. (บ้านควน) + คาดอีก ~6 มม.");
    expect(heavyRainNote({ median_mm: 8, p90_mm: 30 })).toBe("ฝนน่าจะได้ราว 8 มม. (มากสุด ~30)");
  });
});
