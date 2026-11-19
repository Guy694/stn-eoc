import { isCronRequest } from "@/lib/cronSecret";

const req = (value) => ({ headers: { get: (name) => (name === "x-cron-secret" ? value : null) } });

describe("isCronRequest", () => {
  it("ผ่านเมื่อ secret ตรงกันเท่านั้น", () => {
    expect(isCronRequest(req("s3cret-value"), "s3cret-value")).toBe(true);
    expect(isCronRequest(req("s3cret-valuX"), "s3cret-value")).toBe(false);
    expect(isCronRequest(req("short"), "s3cret-value")).toBe(false);
  });

  it("ไม่ตั้ง secret หรือไม่ส่ง header = ไม่ผ่าน", () => {
    expect(isCronRequest(req(""), "")).toBe(false);
    expect(isCronRequest(req(null), "s3cret-value")).toBe(false);
    expect(isCronRequest(req("x"), undefined)).toBe(false);
  });
});
