import { getDbConfig, getDbTimezone } from "@/lib/db";

describe("db time zone", () => {
  it("ค่าเริ่มต้นเป็นเวลาไทย", () => {
    expect(getDbTimezone({})).toBe("+07:00");
    expect(getDbConfig({}).timezone).toBe("+07:00");
  });
  it("ตั้งผ่าน DB_TIMEZONE ได้ และกันค่าผิดรูปแบบ", () => {
    expect(getDbTimezone({ DB_TIMEZONE: "+00:00" })).toBe("+00:00");
    expect(getDbTimezone({ DB_TIMEZONE: "Asia/Bangkok'; DROP" })).toBe("+07:00");
  });
});
