import { analyzeSeaLevel, bucketize, classifyHigh, findExtrema, parseIocRows, parseIocTime, percentile } from "@/lib/seaLevel";

const HOUR = 3600e3;
// น้ำขึ้นลงจำลอง: รอบ 12.42 ชม. แอมพลิจูดเปลี่ยนตามรอบน้ำเกิด-น้ำตาย 14.77 วัน ระดับเฉลี่ย 2.3 ม.
function synthetic({ days = 30, end = Date.UTC(2026, 9, 9, 5, 0), surgeHours = 0, surge = 0 } = {}) {
  const points = [];
  for (let t = end - days * 24 * HOUR; t <= end; t += 60e3) {
    const spring = 1 + 0.45 * Math.cos((2 * Math.PI * (t - end)) / (14.77 * 24 * HOUR));
    let v = 2.3 + 1.0 * spring * Math.cos((2 * Math.PI * (t - end + 2 * HOUR)) / (12.42 * HOUR));
    if (surgeHours && t > end - surgeHours * HOUR) v += surge;
    points.push({ t, v });
  }
  return { points, end };
}

describe("seaLevel", () => {
  it("อ่านเวลา/แถวจาก IOC (UTC) และตัดค่า missing/เซนเซอร์อื่น", () => {
    expect(parseIocTime("2026-10-09 04:45:00")).toBe(Date.UTC(2026, 9, 9, 4, 45));
    const rows = [
      { slevel: 3.2, stime: "2026-10-09 04:45:00", sensor: "rad" },
      { slevel: -999, stime: "2026-10-09 04:46:00", sensor: "rad" },
      { slevel: 1.1, stime: "2026-10-09 04:44:00", sensor: "prs" },
      { slevel: 3.1, stime: "2026-10-09 04:44:00", sensor: "rad" }
    ];
    expect(parseIocRows(rows, "rad").map((p) => p.v)).toEqual([3.1, 3.2]);
  });

  it("เฉลี่ยรายช่วงและหายอดน้ำขึ้น/ลง ห่างกันราว 12.4 ชม.", () => {
    const { points } = synthetic({ days: 3 });
    const { highs, lows } = findExtrema(bucketize(points));
    expect(highs.length).toBeGreaterThanOrEqual(5);
    expect(lows.length).toBeGreaterThanOrEqual(5);
    const gaps = highs.slice(1).map((h, i) => (h.t - highs[i].t) / HOUR);
    for (const gap of gaps) expect(gap).toBeGreaterThan(11.9);
    for (const gap of gaps) expect(gap).toBeLessThan(13);
  });

  it("percentile และการจัดระดับการหนุน", () => {
    expect(percentile([1, 2, 3, 4, 5], 0.5)).toBe(3);
    const thresholds = { p75: 1.2, p90: 1.4, max: 1.6 };
    expect(classifyHigh(1.0, thresholds).key).toBe("normal");
    expect(classifyHigh(1.25, thresholds).key).toBe("elevated");
    expect(classifyHigh(1.45, thresholds).key).toBe("high");
    expect(classifyHigh(1.7, thresholds).key).toBe("record");
  });

  it("วิเคราะห์ 30 วัน: ระดับเทียบค่าเฉลี่ย, น้ำขึ้นครั้งถัดไป, กราฟ 48 ชม.", () => {
    const { points, end } = synthetic();
    const result = analyzeSeaLevel(points, { now: end + 5 * 60e3 });
    expect(result.stale).toBe(false);
    expect(Math.abs(result.level)).toBeLessThan(1.6);
    expect(result.thresholds.cycles).toBeGreaterThan(40);
    expect(result.thresholds.high).toBeGreaterThan(result.thresholds.elevated);
    expect(result.next_highs.length).toBeGreaterThanOrEqual(2);
    expect(new Date(result.next_highs[0].at).getTime()).toBeGreaterThan(end);
    expect(result.series.length).toBeGreaterThan(250);
    expect(result.phase.key).toBe("spring"); // ปลายข้อมูลอยู่ที่ยอดน้ำเกิด
  });

  it("น้ำทะเลหนุนผิดปกติ (คลื่นพายุ +60 ซม. ในวันล่าสุด) → หนุนสูงสุดในรอบ 30 วัน", () => {
    const { points, end } = synthetic({ surgeHours: 20, surge: 0.6 });
    const result = analyzeSeaLevel(points, { now: end });
    expect(result.status.key).toBe("record");
  });

  it("ข้อมูลเก่าเกิน 3 ชม. → stale", () => {
    const { points, end } = synthetic({ days: 30 });
    expect(analyzeSeaLevel(points, { now: end + 4 * HOUR }).stale).toBe(true);
    expect(analyzeSeaLevel([], {})).toBeNull();
  });
});
