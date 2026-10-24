import { freshness, latestTime, FRESHNESS_LIMIT_MINUTES } from "@/lib/dataFreshness";

const NOW = Date.parse("2026-10-24T05:00:00Z"); // 12:00 น. เวลาไทย

describe("dataFreshness", () => {
  test("ข้อมูลสด: บอกเวลาอัปเดต", () => {
    const info = freshness("2026-10-24T04:50:00Z", "water", NOW);
    expect(info).toMatchObject({ known: true, stale: false, ageMinutes: 10 });
    expect(info.label).toBe("อัปเดต 11:50 น.");
  });

  test("ข้อมูลเกินเกณฑ์: ล่าช้า + บอกเวลาล่าสุด", () => {
    const info = freshness("2026-10-24T02:00:00Z", "water", NOW);
    expect(info.stale).toBe(true);
    expect(info.label).toBe("ข้อมูลล่าสุด 09:00 น. • ล่าช้า 3 ชม.");
  });

  test("ข้ามวัน: ใส่วันที่ด้วย", () => {
    const info = freshness("2026-10-22T16:00:00Z", "rain", NOW);
    expect(info.stale).toBe(true);
    expect(info.time).toMatch(/22 ต\.ค\. 23:00 น\./);
  });

  test("เกณฑ์แยกตามชนิด: พยากรณ์ 6 ชม. ยังสด", () => {
    expect(freshness("2026-10-23T23:00:00Z", "forecast", NOW).stale).toBe(false);
    expect(freshness("2026-10-23T23:00:00Z", "rain", NOW).stale).toBe(true);
    expect(FRESHNESS_LIMIT_MINUTES.water).toBe(120);
  });

  test("ไม่มีเวลา → ไม่แสดง", () => {
    expect(freshness(null, "water", NOW)).toMatchObject({ known: false, stale: false, label: "" });
    expect(freshness("abc", "water", NOW).known).toBe(false);
  });

  test("latestTime เลือกเวลาล่าสุด ข้ามค่าว่าง", () => {
    expect(latestTime(["2026-10-24T01:00:00Z", null, "2026-10-24T03:00:00Z", "x"])).toBe(Date.parse("2026-10-24T03:00:00Z"));
    expect(latestTime([])).toBeNull();
  });
});
