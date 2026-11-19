import { countUpValue, decimalsOf, easeOutCubic, motionAllowed, rainBarPercent, rainRipple } from "@/lib/publicMotion";

describe("publicMotion", () => {
  test("easeOutCubic อยู่ในช่วง 0–1 และจบที่ค่าเต็ม", () => {
    expect(easeOutCubic(0)).toBe(0);
    expect(easeOutCubic(1)).toBe(1);
    expect(easeOutCubic(2)).toBe(1);
    expect(easeOutCubic(-1)).toBe(0);
    expect(easeOutCubic(0.5)).toBeGreaterThan(0.5);
  });

  test("countUpValue นับจากค่าเดิมไปค่าใหม่ ปัดตามทศนิยม", () => {
    expect(countUpValue(0, 80, 0)).toBe(0);
    expect(countUpValue(0, 80, 1)).toBe(80);
    expect(countUpValue(10, 12.5, 1, 1)).toBe(12.5);
    expect(Number.isInteger(countUpValue(0, 33, 0.37))).toBe(true);
    expect(countUpValue(0, "–", 0.5)).toBe("–");
  });

  test("decimalsOf", () => {
    expect(decimalsOf(12)).toBe(0);
    expect(decimalsOf(12.5)).toBe(1);
    expect(decimalsOf("8.25")).toBe(2);
    expect(decimalsOf("–")).toBe(0);
  });

  test.each([
    [0, null],
    [null, null],
    [0.4, { rings: 1, level: "light" }],
    [5, { rings: 2, level: "moderate" }],
    [32, { rings: 3, level: "heavy" }]
  ])("rainRipple(%p)", (mm, expected) => {
    if (expected === null) expect(rainRipple(mm)).toBeNull();
    else expect(rainRipple(mm)).toMatchObject(expected);
  });

  test("ฝนยิ่งหนัก วงยิ่งกระเพื่อมเร็ว", () => {
    expect(rainRipple(32).durationS).toBeLessThan(rainRipple(8).durationS);
    expect(rainRipple(8).durationS).toBeLessThan(rainRipple(1).durationS);
  });

  test("rainBarPercent", () => {
    expect(rainBarPercent(84)).toBe(84);
    expect(rainBarPercent(140)).toBe(100);
    expect(rainBarPercent(-3)).toBe(0);
    expect(rainBarPercent(null)).toBeNull();
    expect(rainBarPercent("x")).toBeNull();
  });

  test("motionAllowed ปิดเมื่อขอลดการเคลื่อนไหวหรือประหยัดข้อมูล", () => {
    expect(motionAllowed()).toBe(true);
    expect(motionAllowed({ reducedMotion: true })).toBe(false);
    expect(motionAllowed({ saveData: true })).toBe(false);
  });
});
