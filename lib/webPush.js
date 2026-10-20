// Web Push (RFC 8030) + VAPID (RFC 8292) + เข้ารหัสข้อความ aes128gcm (RFC 8291) ด้วย node:crypto — ไม่ต้องพึ่งแพ็กเกจภายนอก
// กุญแจ VAPID: VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY (base64url) และ VAPID_SUBJECT (mailto: หรือ https:)
// สร้างกุญแจ: npm run push:vapid
import crypto from "node:crypto";

const b64u = (buf) => Buffer.from(buf).toString("base64url");
const fromB64u = (text) => Buffer.from(String(text || ""), "base64url");
const hmac = (key, data) => crypto.createHmac("sha256", key).update(data).digest();

// ปลายทางที่ยอมให้ส่ง (กันการใช้เซิร์ฟเวอร์เราไปยิงที่อยู่อื่น)
const ALLOWED_PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^push\.services\.mozilla\.com$/,
  /^web\.push\.apple\.com$/,
  /^[a-z0-9-]+\.push\.apple\.com$/,
  /^[a-z0-9-]+\.notify\.windows\.com$/
];

export function isAllowedPushEndpoint(endpoint) {
  try {
    const url = new URL(endpoint);
    return url.protocol === "https:" && !url.port && ALLOWED_PUSH_HOSTS.some((re) => re.test(url.hostname)) && endpoint.length <= 1000;
  } catch {
    return false;
  }
}

export function generateVapidKeys() {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  return { publicKey: b64u(ecdh.getPublicKey()), privateKey: b64u(ecdh.getPrivateKey()) };
}

export function vapidConfig(env = process.env) {
  const publicKey = String(env.VAPID_PUBLIC_KEY || "").trim();
  const privateKey = String(env.VAPID_PRIVATE_KEY || "").trim();
  if (fromB64u(publicKey).length !== 65 || fromB64u(privateKey).length !== 32) return null;
  const subject = vapidSubject(env);
  return { publicKey, privateKey, subject: subject || "mailto:admin@localhost", subjectOk: Boolean(subject) };
}

// Apple (iPhone/iPad/Safari) ปฏิเสธการส่งทั้งหมดด้วย 403 BadJwtToken ถ้าผู้ติดต่อ (sub) ไม่ใช่ mailto:/https: ที่ใช้ได้จริง
// เช่น mailto:admin@localhost — Android/Chrome ไม่ตรวจเข้มเท่า จึงเห็นอาการ "Android ได้ iPhone ไม่ได้"
const BAD_HOST = /(^|\.)(localhost|local|internal|invalid|test|example)$|^\d{1,3}(\.\d{1,3}){3}$/i;
export function usableSubject(value) {
  const text = String(value || "").trim();
  const mail = text.match(/^mailto:[^@\s]+@([A-Za-z0-9.-]+\.[A-Za-z]{2,})$/i);
  if (mail) return BAD_HOST.test(mail[1]) ? null : text;
  try {
    const url = new URL(text);
    return url.protocol === "https:" && url.hostname.includes(".") && !BAD_HOST.test(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

/** ผู้ติดต่อของ VAPID: VAPID_SUBJECT → ถ้าใช้ไม่ได้ ใช้ที่อยู่เว็บจริง (NEXT_PUBLIC_APP_URL/APP_URL) */
export function vapidSubject(env = process.env) {
  return usableSubject(env.VAPID_SUBJECT) || usableSubject(env.NEXT_PUBLIC_APP_URL) || usableSubject(env.APP_URL) || null;
}

function signingKey(publicKey, privateKey) {
  const pub = fromB64u(publicKey);
  return crypto.createPrivateKey({
    key: { kty: "EC", crv: "P-256", d: privateKey, x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33, 65)) },
    format: "jwk"
  });
}

/** ส่วนหัว Authorization แบบ VAPID (JWT ES256 อายุ 12 ชม.) */
export function vapidAuthorization(endpoint, { publicKey, privateKey, subject }, now = Date.now()) {
  const header = b64u(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const claims = b64u(JSON.stringify({ aud: new URL(endpoint).origin, exp: Math.floor(now / 1000) + 12 * 3600, sub: subject }));
  const data = `${header}.${claims}`;
  const signature = crypto.sign("sha256", Buffer.from(data), { key: signingKey(publicKey, privateKey), dsaEncoding: "ieee-p1363" });
  return `vapid t=${data}.${b64u(signature)}, k=${publicKey}`;
}

/**
 * เข้ารหัสข้อความตาม RFC 8291 (record เดียว) → body ที่ส่งไปผู้ให้บริการ push
 * keys: { p256dh, auth } จาก PushSubscription; options.salt/asPrivateKey ใช้เฉพาะการทดสอบ
 */
export function encryptPayload(plaintext, keys, { salt = crypto.randomBytes(16), asPrivateKey = null, recordSize = 4096 } = {}) {
  const uaPublic = fromB64u(keys?.p256dh);
  const authSecret = fromB64u(keys?.auth);
  if (uaPublic.length !== 65 || authSecret.length < 16) throw new Error("subscription keys ไม่ถูกต้อง");
  const ecdh = crypto.createECDH("prime256v1");
  if (asPrivateKey) ecdh.setPrivateKey(fromB64u(asPrivateKey));
  else ecdh.generateKeys();
  const asPublic = ecdh.getPublicKey();
  const shared = ecdh.computeSecret(uaPublic);
  const ikm = hmac(hmac(authSecret, shared), Buffer.concat([Buffer.from("WebPush: info\0"), uaPublic, asPublic, Buffer.from([1])]));
  const prk = hmac(salt, ikm);
  const cek = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: aes128gcm\0"), Buffer.from([1])])).subarray(0, 16);
  const nonce = hmac(prk, Buffer.concat([Buffer.from("Content-Encoding: nonce\0"), Buffer.from([1])])).subarray(0, 12);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const record = Buffer.concat([cipher.update(Buffer.concat([Buffer.from(plaintext, "utf8"), Buffer.from([2])])), cipher.final(), cipher.getAuthTag()]);
  const header = Buffer.alloc(21);
  salt.copy(header, 0);
  header.writeUInt32BE(recordSize, 16);
  header.writeUInt8(asPublic.length, 20);
  return Buffer.concat([header, asPublic, record]);
}

/** ส่งหนึ่งเครื่อง → { ok, status, gone } (gone = เครื่องยกเลิก/หมดอายุ ควรลบ) */
export async function sendWebPush(subscription, payload, { vapid, ttl = 6 * 3600, urgency = "high", topic = null, fetchImpl = fetch } = {}) {
  if (!vapid) throw new Error("ยังไม่ได้ตั้งค่า VAPID");
  if (!isAllowedPushEndpoint(subscription.endpoint)) return { ok: false, status: 0, gone: true };
  const body = encryptPayload(JSON.stringify(payload), subscription.keys);
  const headers = {
    TTL: String(ttl),
    Urgency: urgency,
    "Content-Encoding": "aes128gcm",
    "Content-Type": "application/octet-stream",
    Authorization: vapidAuthorization(subscription.endpoint, vapid)
  };
  if (topic) headers.Topic = String(topic).replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32);
  try {
    const response = await fetchImpl(subscription.endpoint, { method: "POST", headers, body, signal: AbortSignal.timeout(15000) });
    const ok = response.status >= 200 && response.status < 300;
    // เหตุผลที่ผู้ให้บริการปฏิเสธ (Apple ส่ง JSON { reason }) — ใช้บอกผู้ดูแลว่าต้องแก้อะไร
    let reason = null;
    if (!ok) {
      const text = await response.text?.().catch(() => "") || "";
      try { reason = JSON.parse(text)?.reason || null; } catch { reason = text.slice(0, 80) || null; }
    }
    return { ok, status: response.status, gone: response.status === 404 || response.status === 410, reason };
  } catch (error) {
    return { ok: false, status: 0, gone: false, error: error.message };
  }
}
