import { DEFAULT_MESSAGE, maintenanceDecision, normalizeState, validateMaintenanceInput } from "@/lib/maintenanceRules";

describe("maintenanceRules", () => {
  const on = { enabled: true, allow_officers: false };
  it("ระบบเปิดปกติ → ผ่านทุกคำขอ", () => {
    expect(maintenanceDecision({ pathname: "/public", state: { enabled: false } })).toBe("pass");
  });
  it("ปิดปรับปรุง: หน้า/ API ถูกปิด ยกเว้นหน้าเข้าสู่ระบบและแอดมิน", () => {
    expect(maintenanceDecision({ pathname: "/", state: on })).toBe("block-page");
    expect(maintenanceDecision({ pathname: "/api/public/pm25", state: on })).toBe("block-api");
    expect(maintenanceDecision({ pathname: "/login/", state: on })).toBe("pass");
    expect(maintenanceDecision({ pathname: "/auth/thaiid/pending/", state: on })).toBe("pass");
    expect(maintenanceDecision({ pathname: "/maintenance/", state: on })).toBe("pass");
    expect(maintenanceDecision({ pathname: "/eoc/flood/", state: on, role: "admin" })).toBe("pass");
    expect(maintenanceDecision({ pathname: "/eoc/flood/", state: on, role: "staff" })).toBe("block-page");
    expect(maintenanceDecision({ pathname: "/eoc/flood/", state: { ...on, allow_officers: true }, role: "staff" })).toBe("pass");
  });
  it("ตรวจค่าที่แอดมินส่ง", () => {
    const now = Date.UTC(2026, 9, 9, 7);
    expect(validateMaintenanceInput({ enabled: true, message: "  " }, now).value).toMatchObject({ enabled: true, message: DEFAULT_MESSAGE, until: null });
    expect(validateMaintenanceInput({ until: "2026-10-09T05:00:00Z" }, now).error).toMatch(/อนาคต/);
    expect(validateMaintenanceInput({ until: "ไม่ใช่วันที่" }, now).error).toBeTruthy();
    expect(validateMaintenanceInput({ enabled: true, until: "2026-10-09T10:00:00Z" }, now).value.until).toBe("2026-10-09T10:00:00.000Z");
  });
  it("อ่านค่าจากฐานข้อมูลได้ทั้ง string และ object", () => {
    expect(normalizeState('{"enabled":true,"message":"x"}')).toMatchObject({ enabled: true, message: "x" });
    expect(normalizeState(null)).toMatchObject({ enabled: false });
  });
});
