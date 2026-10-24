import { APP_VERSION, APP_VERSION_LABEL } from "@/lib/appVersion";
import pkg from "../../package.json";

test("เวอร์ชันที่แสดงตรงกับ package.json", () => {
  expect(APP_VERSION).toBe(pkg.version);
  expect(APP_VERSION_LABEL).toBe(`v.${pkg.version}`);
});
