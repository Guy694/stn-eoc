import { DEFAULT_HOME_THEME, HOME_THEMES, effectiveHomeTheme, resolveHomeTheme } from "@/lib/homeTheme";

describe("ธีมหน้าแรก (ย้อนกลับได้)", () => {
  test("ค่าเริ่มต้นเป็นธีมที่มีอยู่จริง", () => {
    expect(HOME_THEMES).toEqual(expect.arrayContaining(["auto", "sky", "classic"]));
    expect(HOME_THEMES).toContain(DEFAULT_HOME_THEME);
  });
  test("?theme= มาก่อนค่าที่จำในเครื่อง · default ล้างกลับค่าเริ่มต้น · ค่าแปลกใช้ค่าเริ่มต้น", () => {
    expect(resolveHomeTheme("classic", "sky")).toBe("classic");
    expect(resolveHomeTheme(null, "classic")).toBe("classic");
    expect(resolveHomeTheme("default", "classic")).toBe(DEFAULT_HOME_THEME);
    expect(resolveHomeTheme("neon", null)).toBe(DEFAULT_HOME_THEME);
  });
  test("auto: ไม่มีฝนใช้ sky · มีฝนใช้แบบเดิม · ยังไม่รู้สภาพอากาศใช้แบบเดิม", () => {
    expect(effectiveHomeTheme("auto", { rain: 0, cloud: 0 })).toBe("sky");
    expect(effectiveHomeTheme("auto", { rain: 0, cloud: 2 })).toBe("sky");
    expect(effectiveHomeTheme("auto", { rain: 1 })).toBe("classic");
    expect(effectiveHomeTheme("auto", { rain: 3, thunder: true })).toBe("classic");
    expect(effectiveHomeTheme("auto", null)).toBe("classic");
  });
  test("เลือกธีมตายตัว ไม่สนสภาพอากาศ", () => {
    expect(effectiveHomeTheme("sky", { rain: 3 })).toBe("sky");
    expect(effectiveHomeTheme("classic", { rain: 0 })).toBe("classic");
  });
});
