import { analyzeTideModel, combinedStatus, compareObserved, densify, parseModelHourly } from "@/lib/tideModel";

const HOUR = 3600e3;
const end = Date.UTC(2026, 9, 16, 0);
const now = Date.UTC(2026, 9, 9, 7);
// พยากรณ์จำลองรายชั่วโมง 92 วันย้อนหลัง + 7 วันล่วงหน้า: น้ำขึ้นลงครึ่งวัน + รอบน้ำเกิด-น้ำตาย
function modelSeries({ shiftMs = 0, scale = 1, offset = 0, surgeFrom = Infinity, surge = 0 } = {}) {
  const points = [];
  for (let t = now - 92 * 24 * HOUR; t <= end; t += HOUR) {
    const spring = 1 + 0.45 * Math.cos((2 * Math.PI * (t - now)) / (14.77 * 24 * HOUR));
    let v = offset + scale * spring * 1.1 * Math.cos((2 * Math.PI * (t + shiftMs - now)) / (12.42 * HOUR));
    if (t >= surgeFrom) v += surge;
    points.push({ t, v: Math.round(v * 100) / 100 });
  }
  return points;
}

describe("tideModel", () => {
  it("อ่าน hourly ของ Open-Meteo (เวลา GMT) และข้ามค่า null", () => {
    const points = parseModelHourly({ time: ["2026-10-09T00:00", "2026-10-09T01:00"], sea_level_height_msl: [1.2, null] });
    expect(points).toEqual([{ t: Date.UTC(2026, 9, 9, 0), v: 1.2 }]);
    expect(densify([{ t: 0, v: 0 }, { t: HOUR, v: 0.6 }]).length).toBe(7);
  });

  it("หาเกณฑ์หนุนจาก 92 วัน และน้ำขึ้น 3 วันข้างหน้าพร้อมสถานะ", () => {
    const result = analyzeTideModel(modelSeries(), { now });
    expect(result.thresholds.cycles).toBeGreaterThan(150);
    expect(result.thresholds.high).toBeGreaterThan(result.thresholds.elevated);
    expect(result.upcoming_highs.length).toBeGreaterThanOrEqual(5);
    expect(result.phase.key).toBe("spring"); // ตอนนี้อยู่ที่ยอดน้ำเกิดของข้อมูลจำลอง
    expect(["elevated", "high", "record"]).toContain(result.upcoming_highs[0].status);
    expect(result.series.length).toBe(97);
  });

  it("เทียบค่าวัดจริง: เลื่อนเวลา/ต่างศูนย์อ้างอิงแต่ไม่มีคลื่นพายุ → ผลต่างใกล้ 0 และเข้ากันได้ดี", () => {
    const model = modelSeries();
    const observed = [];
    for (let t = now - 48 * HOUR; t <= now; t += 60e3) {
      const spring = 1 + 0.45 * Math.cos((2 * Math.PI * (t - now)) / (14.77 * 24 * HOUR));
      observed.push({ t, v: 3.2 + 1.2 * spring * 1.1 * Math.cos((2 * Math.PI * (t + 30 * 60e3 - now)) / (12.42 * HOUR)) });
    }
    const result = compareObserved(observed, model, { now });
    expect(result.usable).toBe(true);
    expect(Math.abs(result.anomaly_m)).toBeLessThan(0.05);
    expect(result.lag_minutes).toBe(30);
  });

  it("ค่าจริงสูงกว่าพยากรณ์ 45 ซม. ใน 6 ชม. ล่าสุด → ยกระดับเป็นหนุนสูง", () => {
    const model = modelSeries();
    const observed = [];
    for (let t = now - 48 * HOUR; t <= now; t += 60e3) {
      const spring = 1 + 0.45 * Math.cos((2 * Math.PI * (t - now)) / (14.77 * 24 * HOUR));
      observed.push({ t, v: 1.1 * spring * Math.cos((2 * Math.PI * (t - now)) / (12.42 * HOUR)) + (t > now - 6 * HOUR ? 0.45 : 0) });
    }
    const comparison = compareObserved(observed, model, { now });
    expect(comparison.anomaly_m).toBeGreaterThan(0.3);
    const tide = analyzeTideModel(modelSeries({ scale: 0.5 }), { now });
    const status = combinedStatus(tide, { ...comparison, usable: true }, now);
    expect(["high", "record"]).toContain(status.key);
    expect(status.reasons[0]).toMatch(/สูงกว่าที่คาด/);
  });
});
