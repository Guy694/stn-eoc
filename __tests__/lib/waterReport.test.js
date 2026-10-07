import { WATER_LEVELS, isWaterLevel, parseLatLng, travelForPassability, waterLevelText, waterReportTitle } from "@/lib/waterReport";
import { suggestTitle, titleTemplates, toPublicIncident } from "@/lib/incidentPublishing";

describe("waterReport", () => {
  test("มี 6 ระดับ เรียงจากต่ำไปสูง", () => {
    expect(WATER_LEVELS).toHaveLength(6);
    const fills = WATER_LEVELS.map((item) => item.fill);
    expect([...fills].sort((a, b) => a - b)).toEqual(fills);
    expect(isWaterLevel("knee_waist")).toBe(true);
    expect(isWaterLevel("30")).toBe(false);
  });

  test("waterLevelText แสดงรหัสช่วง และรองรับค่าเก่าที่เป็นตัวเลข", () => {
    expect(waterLevelText("knee_waist")).toBe("เข่า–เอว (50–100 ซม.)");
    expect(waterLevelText("30")).toBe("30 ซม.");
    expect(waterLevelText("")).toBe("");
  });

  test("การสัญจรแปลงเป็น travel_status เดิม", () => {
    expect(travelForPassability("car")).toBe("passable");
    expect(travelForPassability("boat")).toBe("impassable");
    expect(travelForPassability("x")).toBeNull();
  });

  test("หัวข้อเผยแพร่", () => {
    expect(waterReportTitle({ water_level: "waist_chest", travel_status: "impassable" })).toBe("น้ำท่วมระดับเอว–อก (100–130 ซม.) — รถผ่านไม่ได้");
    expect(waterReportTitle({ water_level: "dry" })).toBe("น้ำลดแล้ว / ต่ำกว่าข้อเท้า");
    expect(waterReportTitle({ water_level: "15" })).toBeNull();
  });

  test.each([
    ["https://www.google.com/maps/place/x/@6.6238,100.0673,15z", 6.6238, 100.0673],
    ["https://maps.google.com/?q=6.61,100.06", 6.61, 100.06],
    ["https://www.google.com/maps/dir/?api=1&destination=6.7%2C99.9", 6.7, 99.9],
    ["https://www.google.com/maps/place/x/data=!3d6.8123!4d99.95", 6.8123, 99.95],
    ["6.6238, 100.0673", 6.6238, 100.0673],
    ["ตำแหน่งของฉัน 6.62381 100.06732", 6.62381, 100.06732]
  ])("parseLatLng อ่าน %s", (text, lat, lng) => {
    const result = parseLatLng(text);
    expect(result.ok).toBe(true);
    expect(result.lat).toBeCloseTo(lat);
    expect(result.lng).toBeCloseTo(lng);
    expect(result.nearSatun).toBe(true);
  });

  test("parseLatLng: ลิงก์ย่อ / นอกสตูล / ไม่มีพิกัด", () => {
    expect(parseLatLng("https://maps.app.goo.gl/abc").ok).toBe(false);
    expect(parseLatLng("https://maps.app.goo.gl/abc").error).toMatch(/ลิงก์แบบย่อ/);
    expect(parseLatLng("13.7563, 100.5018").nearSatun).toBe(false);
    expect(parseLatLng("hello").ok).toBe(false);
    expect(parseLatLng("").error).toBe("");
  });
});

describe("incidentPublishing + ระดับน้ำ", () => {
  const report = { report_type: "problem_point", problem_category: "flood", water_level: "knee_waist", travel_status: "difficult" };

  test("หัวข้อแนะนำใช้ระดับน้ำ", () => {
    expect(suggestTitle(report)).toBe("น้ำท่วมระดับเข่า–เอว (50–100 ซม.) — เฉพาะรถสูง");
    expect(titleTemplates(report)[0]).toBe(suggestTitle(report));
  });

  test("จุดน้ำท่วมแบบเดิม (ไม่มีรหัสระดับ) ใช้หัวข้อเดิม", () => {
    expect(suggestTitle({ ...report, water_level: "" })).not.toMatch(/ระดับ/);
  });

  test("ข้อมูลสาธารณะมีระดับน้ำ/แนวโน้ม แต่ไม่มีข้อมูลผู้แจ้ง", () => {
    const pub = toPublicIncident({ ...report, id: 1, first_name: "ก", phone: "0812345678", water_trend: "rising", latitude: 6.62, longitude: 100.06 });
    expect(pub.water_level).toBe("knee_waist");
    expect(pub.water_trend).toBe("rising");
    expect(JSON.stringify(pub)).not.toContain("0812345678");
    expect(toPublicIncident({ ...report, water_level: "45", water_trend: "x" }).water_level).toBeNull();
  });
});
