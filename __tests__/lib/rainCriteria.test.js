import { RAIN_CATEGORIES, rainCategory } from "@/lib/thaiWaterRain";
import { HEAVY_RAIN_MM, VERY_HEAVY_RAIN_MM, assessDistrictRisk } from "@/lib/forecastSignals";
import { HEAVY_RAIN_MM as HISTORY_HEAVY, VERY_HEAVY_RAIN_MM as HISTORY_VERY_HEAVY } from "@/lib/hydroHistory";
import { DEFAULT_RAIN_THRESHOLDS } from "@/lib/waterAlerts";
import { homeAdvice, officialNotice, riskSpeechText } from "@/lib/myRisk";

describe("เกณฑ์ฝน 24 ชม. ตามรายงาน ปภ. (ร่วมกับกรมอุตุฯ)", () => {
  test("ประเภทฝน: เล็กน้อย 0.1–10.0 • ปานกลาง 10.1–35.0 • หนัก 35.1–90.0 • หนักมาก 90.1 ขึ้นไป", () => {
    expect(RAIN_CATEGORIES.map((item) => [item.label, item.min])).toEqual([
      ["ไม่มีฝน", 0], ["ฝนเล็กน้อย", 0.1], ["ฝนปานกลาง", 10.1], ["ฝนหนัก", 35.1], ["ฝนหนักมาก", 90.1]
    ]);
    expect([0.1, 10, 10.1, 35, 35.1, 90, 90.1].map((mm) => rainCategory(mm).key)).toEqual(["light", "light", "moderate", "moderate", "heavy", "heavy", "very_heavy"]);
  });

  test("ทุกจุดในระบบใช้เกณฑ์เดียวกัน", () => {
    expect([HEAVY_RAIN_MM, HISTORY_HEAVY, DEFAULT_RAIN_THRESHOLDS.watchMm]).toEqual([35.1, 35.1, 35.1]);
    expect([VERY_HEAVY_RAIN_MM, HISTORY_VERY_HEAVY, DEFAULT_RAIN_THRESHOLDS.severeMm]).toEqual([90.1, 90.1, 90.1]);
  });

  test("ฝน 35.0 มม. ยังเป็นปานกลาง ไม่นับความเสี่ยงฝน, 35.1 มม. นับเป็นฝนหนัก", () => {
    expect(assessDistrictRisk({ observedRain24h: 35 }).score).toBe(0);
    expect(assessDistrictRisk({ observedRain24h: 35.1 }).score).toBe(1);
    expect(assessDistrictRisk({ observedRain24h: 90 }).score).toBe(2);
    expect(assessDistrictRisk({ observedRain24h: 90.1 }).score).toBe(3);
  });
});

describe("บ้านฉันเสี่ยงไหม: ย้ำให้รอประกาศอพยพอย่างเป็นทางการ", () => {
  test("แสดงเฉพาะระดับเสี่ยงสูงและวิกฤต", () => {
    expect(officialNotice("normal")).toBeNull();
    expect(officialNotice("watch")).toBeNull();
    expect(officialNotice("high").body).toMatch(/รอประกาศแจ้งเตือนอย่างเป็นทางการจากกรมป้องกันและบรรเทาสาธารณภัย \(ปภ\.\)/);
    expect(officialNotice("critical").urgent).toMatch(/1784/);
  });

  test("คำแนะนำไม่สั่งให้ออกจากบ้านเอง และเสียงอ่านมีข้อความนี้", () => {
    expect(homeAdvice("critical").join(" ")).not.toMatch(/ออกจากบ้านก่อนน้ำมา/);
    expect(homeAdvice("critical").join(" ")).toMatch(/เมื่อมีประกาศจาก ปภ\./);
    expect(riskSpeechText({ label: "วิกฤต", notice: officialNotice("critical") })).toMatch(/ยังไม่ใช่คำสั่งอพยพ/);
  });
});
