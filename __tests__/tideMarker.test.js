jest.mock("leaflet", () => ({ divIcon: jest.fn((options) => options) }));
jest.mock("react-leaflet", () => ({ Marker: () => null, Tooltip: () => null }));

import { tideSummary, TIDE_MARKER_POSITION } from "@/components/weather/TideMarker";

describe("tideSummary", () => {
  const now = Date.parse("2026-10-19T05:00:00Z"); // 12:00 น. เวลาไทย

  test("ไม่มีข้อมูล → null", () => {
    expect(tideSummary(null, now)).toBeNull();
    expect(tideSummary({ level: null }, now)).toBeNull();
  });

  test("น้ำกำลังขึ้น พร้อมรอบน้ำขึ้น/ลงถัดไป (ข้ามรอบที่ผ่านไปแล้ว)", () => {
    const summary = tideSummary({
      level: 0.84,
      trend: { key: "rising" },
      status: { key: "normal", label: "ปกติ", color: "#16a34a" },
      next_highs: [{ at: "2026-10-19T04:00:00Z", est_level: 1.1 }, { at: "2026-10-19T08:30:00Z", est_level: 1.32 }],
      lows: [{ at: "2026-10-19T02:00:00Z", level: -0.9 }, { at: "2026-10-19T14:40:00Z", level: -1.05 }]
    }, now);
    expect(summary.key).toBe("rising");
    expect(summary.arrow).toBe("↑");
    expect(summary.level).toBe("+0.84 ม.");
    expect(summary.statusLabel).toBe("ปกติ");
    expect(summary.nextHigh).toEqual({ time: "15:30 น.", level: "+1.32 ม." });
    expect(summary.nextLow).toEqual({ time: "21:40 น.", level: "-1.05 ม." });
  });

  test("น้ำลง + หนุนสูง ใช้สีและชื่อสถานะ", () => {
    const summary = tideSummary({ level: -0.2, trend: { key: "falling" }, status: { key: "high", label: "หนุนสูง", color: "#dc2626" } }, now);
    expect(summary.arrow).toBe("↓");
    expect(summary.color).toBe("#dc2626");
    expect(summary.statusLabel).toBe("หนุนสูง");
    expect(summary.nextHigh).toBeNull();
  });

  test("จุดสัญลักษณ์อยู่ในทะเลอันดามันหน้าสตูล", () => {
    const [lat, lon] = TIDE_MARKER_POSITION;
    expect(lat).toBeGreaterThan(6.3);
    expect(lat).toBeLessThan(6.9);
    expect(lon).toBeLessThan(100.0);
  });
});
