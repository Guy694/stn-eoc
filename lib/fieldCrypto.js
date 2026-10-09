// เข้ารหัสข้อมูลอ่อนไหวรายฟิลด์ก่อนเก็บลงฐานข้อมูล (AES-256-GCM)
// - กุญแจแยกตามวัตถุประสงค์ (HKDF จาก VULNERABLE_DATA_KEY หรือ SECRET_KEY) ไม่ใช้กุญแจเดียวกับ cookie/HMAC
// - AAD = วัตถุประสงค์ + ชื่อฟิลด์ → ย้ายค่าที่เข้ารหัสไปใส่ฟิลด์อื่นแล้วถอดรหัสไม่ได้
// - รูปแบบ: "v1:<iv>:<ciphertext>:<tag>" (base64url)
// ห้าม import ไฟล์นี้ในโค้ดฝั่งเบราว์เซอร์
import crypto from "node:crypto";

const VERSION = "v1";
const keyCache = new Map();

function masterSecret(env = process.env) {
  const value = env.VULNERABLE_DATA_KEY || env.SECRET_KEY || "";
  if (value.length < 16) {
    const error = new Error("ยังไม่ได้ตั้งค่ากุญแจเข้ารหัส (VULNERABLE_DATA_KEY หรือ SECRET_KEY อย่างน้อย 16 ตัวอักษร)");
    error.code = "missing_encryption_key";
    throw error;
  }
  return value;
}

function keyFor(purpose, env) {
  const secret = masterSecret(env);
  const cacheKey = `${purpose}\u0000${secret}`;
  if (!keyCache.has(cacheKey)) {
    const key = Buffer.from(crypto.hkdfSync("sha256", secret, "stn-eoc-field-crypto", `${purpose}:${VERSION}`, 32));
    keyCache.set(cacheKey, key);
  }
  return keyCache.get(cacheKey);
}

const aad = (purpose, field) => Buffer.from(`${purpose}|${field}`, "utf8");

/** เข้ารหัสค่า (สตริงหรือ object → JSON) คืน null ถ้าค่าว่าง */
export function encryptField(value, { purpose, field, env = process.env }) {
  if (value === null || value === undefined || value === "") return null;
  const plain = typeof value === "string" ? value : JSON.stringify(value);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", keyFor(purpose, env), iv);
  cipher.setAAD(aad(purpose, field));
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  return [VERSION, iv.toString("base64url"), encrypted.toString("base64url"), cipher.getAuthTag().toString("base64url")].join(":");
}

/** ถอดรหัส คืนสตริง (หรือ null) — ค่าผิดรูป/กุญแจไม่ตรง → throw */
export function decryptField(payload, { purpose, field, env = process.env }) {
  if (payload === null || payload === undefined || payload === "") return null;
  const parts = String(payload).split(":");
  if (parts.length !== 4 || parts[0] !== VERSION) throw new Error("รูปแบบข้อมูลเข้ารหัสไม่ถูกต้อง");
  const decipher = crypto.createDecipheriv("aes-256-gcm", keyFor(purpose, env), Buffer.from(parts[1], "base64url"));
  decipher.setAAD(aad(purpose, field));
  decipher.setAuthTag(Buffer.from(parts[3], "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(parts[2], "base64url")), decipher.final()]).toString("utf8");
}

/** ถอดรหัสแล้ว JSON.parse (สำหรับฟิลด์ที่เก็บเป็น object) */
export function decryptJsonField(payload, options) {
  const text = decryptField(payload, options);
  if (text === null) return null;
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
