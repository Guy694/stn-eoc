import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/appVersion";
import pkg from "../../package.json";

test("เวอร์ชันที่แสดงตรงกับ package.json", () => {
  expect(APP_VERSION).toBe(pkg.version);
  expect(APP_VERSION_LABEL).toBe(`v.${pkg.version}`);
});

describe("ลิขสิทธิ์", () => {
  const { copyrightYears, COPYRIGHT_OWNER_EN } = require("@/lib/appVersion");
  test("ปีสิ้นสุดตามปีปัจจุบัน", () => {
    expect(copyrightYears(new Date("2026-10-24"))).toBe("2025–2026");
    expect(copyrightYears(new Date("2027-01-02"))).toBe("2025–2027");
    expect(copyrightYears(new Date("2025-06-01"))).toBe("2025");
  });
  test("LICENSE และ package.json ระบุเจ้าของเดียวกัน", () => {
    const fs = require("node:fs");
    const path = require("node:path");
    const root = process.env.STN_ROOT || process.cwd();
    expect(fs.readFileSync(path.join(root, "LICENSE"), "utf8")).toContain(COPYRIGHT_OWNER_EN);
    expect(JSON.parse(fs.readFileSync(path.join(root, "package.json"), "utf8")).license).toBe("UNLICENSED");
  });
});
