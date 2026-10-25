import { normalizeWaterReportSetting, waterReportStatus } from "@/lib/waterReportSetting";

describe("เมนูรายงานระดับน้ำ: ผู้ดูแลระบบเปิด/ปิดได้", () => {
  const flood = [{ eoc_type: "flood" }];
  const disease = [{ eoc_type: "disease" }];
  test("ค่าเริ่มต้น = ตาม EOC อุทกภัย (พฤติกรรมเดิม)", () => {
    expect(normalizeWaterReportSetting(null).mode).toBe("auto");
    expect(normalizeWaterReportSetting({ mode: "weird" }).mode).toBe("auto");
    expect(waterReportStatus("auto", flood)).toEqual({ open: true, reason: "eoc" });
    expect(waterReportStatus("auto", disease)).toEqual({ open: false, reason: "eoc" });
  });
  test("เปิดตลอด / ปิด ไม่ขึ้นกับ EOC", () => {
    expect(waterReportStatus("on", [])).toEqual({ open: true, reason: "admin" });
    expect(waterReportStatus("off", flood)).toEqual({ open: false, reason: "admin" });
  });
});
