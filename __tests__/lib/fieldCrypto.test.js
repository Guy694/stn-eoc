import { decryptField, decryptJsonField, encryptField } from "@/lib/fieldCrypto";

const env = { SECRET_KEY: "test-secret-key-at-least-32-characters!!" };
const opts = { purpose: "vulnerable-person", field: "name", env };

describe("fieldCrypto", () => {
  it("เข้ารหัสแล้วถอดกลับได้ และไม่มีข้อความจริงในผลลัพธ์", () => {
    const payload = encryptField("นางสมศรี ใจดี", opts);
    expect(payload.startsWith("v1:")).toBe(true);
    expect(payload).not.toContain("สมศรี");
    expect(decryptField(payload, opts)).toBe("นางสมศรี ใจดี");
  });

  it("ค่าเดิมเข้ารหัสสองครั้งได้ผลต่างกัน (IV สุ่ม)", () => {
    expect(encryptField("x", opts)).not.toBe(encryptField("x", opts));
  });

  it("เก็บ object เป็น JSON ได้ (พิกัด)", () => {
    const payload = encryptField({ lat: 6.62, lng: 100.07 }, { ...opts, field: "location" });
    expect(decryptJsonField(payload, { ...opts, field: "location" })).toEqual({ lat: 6.62, lng: 100.07 });
  });

  it("ค่าว่างคืน null", () => {
    expect(encryptField("", opts)).toBeNull();
    expect(encryptField(null, opts)).toBeNull();
    expect(decryptField(null, opts)).toBeNull();
  });

  it("ย้ายค่าไปฟิลด์อื่น / ใช้กุญแจอื่น / แก้ไขค่า → ถอดรหัสไม่ได้", () => {
    const payload = encryptField("0812345678", { ...opts, field: "phone" });
    expect(() => decryptField(payload, { ...opts, field: "name" })).toThrow();
    expect(() => decryptField(payload, { ...opts, field: "phone", env: { SECRET_KEY: "another-secret-key-32-characters-long" } })).toThrow();
    const parts = payload.split(":");
    parts[2] = parts[2].slice(0, -2) + (parts[2].endsWith("AA") ? "BB" : "AA");
    expect(() => decryptField(parts.join(":"), { ...opts, field: "phone" })).toThrow();
  });

  it("VULNERABLE_DATA_KEY มาก่อน SECRET_KEY", () => {
    const own = { ...env, VULNERABLE_DATA_KEY: "dedicated-vulnerable-key-1234567890" };
    const payload = encryptField("x", { ...opts, env: own });
    expect(() => decryptField(payload, opts)).toThrow();
    expect(decryptField(payload, { ...opts, env: own })).toBe("x");
  });

  it("ไม่มีกุญแจ → แจ้งชัดเจน", () => {
    expect(() => encryptField("x", { ...opts, env: {} })).toThrow(/กุญแจเข้ารหัส/);
  });
});
