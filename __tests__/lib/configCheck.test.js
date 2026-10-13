import { productionConfigWarnings } from "@/lib/configCheck";

test("ตั้งค่าครบ ไม่มีคำเตือน", () => {
  expect(productionConfigWarnings({ TRUST_PROXY: "1", APP_URL: "https://eoc.example.go.th", SECRET_KEY: "x".repeat(40), VULNERABLE_DATA_KEY: "k", DB_USER: "stneoc_app" })).toEqual([]);
});

test("ค่าที่ขาด/เสี่ยงขึ้นคำเตือนครบ", () => {
  const warnings = productionConfigWarnings({ DB_USER: "root" });
  expect(warnings.join("\n")).toMatch(/TRUST_PROXY/);
  expect(warnings.join("\n")).toMatch(/APP_URL/);
  expect(warnings.join("\n")).toMatch(/SECRET_KEY/);
  expect(warnings.join("\n")).toMatch(/root/);
});
