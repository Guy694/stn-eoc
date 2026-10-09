import crypto from "node:crypto";
import { encryptPayload, generateVapidKeys, isAllowedPushEndpoint, sendWebPush, vapidAuthorization, vapidConfig } from "@/lib/webPush";

const b64u = (buf) => Buffer.from(buf).toString("base64url");

describe("webPush", () => {
  test("RFC 8291 Appendix A test vector", () => {
    const body = encryptPayload("When I grow up, I want to be a watermelon", {
      p256dh: "BCVxsr7N_eNgVRqvHtD0zTZsEc6-VV-JvLexhqUzORcxaOzi6-AYWXvTBHm4bjyPjs7Vd8pZGH6SRpkNtoIAiw4",
      auth: "BTBZMqHH6r4Tts7J_aSIgg"
    }, { salt: Buffer.from("DGv6ra1nlYgDCS1FRnbzlw", "base64url"), asPrivateKey: "yfWPiYE-n46HLnH0KqZOF1fJJU3MYrct3AELtAQ-oRw" });
    expect(b64u(body)).toBe("DGv6ra1nlYgDCS1FRnbzlwAAEABBBP4z9KsN6nGRTbVYI_c7VJSPQTBtkgcy27mlmlMoZIIgDll6e3vCYLocInmYWAmS6TlzAC8wEqKK6PBru3jl7A_yl95bQpu6cVPTpK4Mqgkf1CXztLVBSt2Ks3oZwbuwXPXLWyouBWLVWGNWQexSgSxsj_Qulcy4a-fN");
  });

  test("round trip with a browser-like key pair (Thai text)", () => {
    const ua = crypto.createECDH("prime256v1");
    ua.generateKeys();
    const auth = crypto.randomBytes(16);
    const text = JSON.stringify({ title: "เตือนภัย จ.สตูล", body: "ฝนตกหนัก อ.ละงู" });
    const body = encryptPayload(text, { p256dh: b64u(ua.getPublicKey()), auth: b64u(auth) });
    // ถอดรหัสแบบฝั่งเบราว์เซอร์
    const salt = body.subarray(0, 16);
    const idlen = body.readUInt8(20);
    const asPublic = body.subarray(21, 21 + idlen);
    const shared = ua.computeSecret(asPublic);
    const h = (k, d) => crypto.createHmac("sha256", k).update(d).digest();
    const ikm = h(h(auth, shared), Buffer.concat([Buffer.from("WebPush: info\0"), ua.getPublicKey(), asPublic, Buffer.from([1])]));
    const prk = h(salt, ikm);
    const cek = h(prk, Buffer.from("Content-Encoding: aes128gcm\0\x01", "binary")).subarray(0, 16);
    const nonce = h(prk, Buffer.from("Content-Encoding: nonce\0\x01", "binary")).subarray(0, 12);
    const record = body.subarray(21 + idlen);
    const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(record.subarray(record.length - 16));
    const plain = Buffer.concat([decipher.update(record.subarray(0, record.length - 16)), decipher.final()]);
    expect(plain[plain.length - 1]).toBe(2);
    expect(plain.subarray(0, -1).toString("utf8")).toBe(text);
  });

  test("VAPID JWT verifies with the public key", () => {
    const keys = generateVapidKeys();
    const header = vapidAuthorization("https://fcm.googleapis.com/fcm/send/abc", { ...keys, subject: "mailto:eoc@example.go.th" }, 1_800_000_000_000);
    const [, token, k] = header.match(/^vapid t=([^,]+), k=(.+)$/);
    expect(k).toBe(keys.publicKey);
    const [h, c, s] = token.split(".");
    const claims = JSON.parse(Buffer.from(c, "base64url").toString());
    expect(claims).toMatchObject({ aud: "https://fcm.googleapis.com", sub: "mailto:eoc@example.go.th", exp: 1_800_000_000 + 43200 });
    const pub = Buffer.from(keys.publicKey, "base64url");
    const key = crypto.createPublicKey({ key: { kty: "EC", crv: "P-256", x: b64u(pub.subarray(1, 33)), y: b64u(pub.subarray(33)) }, format: "jwk" });
    expect(crypto.verify("sha256", Buffer.from(`${h}.${c}`), { key, dsaEncoding: "ieee-p1363" }, Buffer.from(s, "base64url"))).toBe(true);
  });

  test("endpoint allowlist blocks non push services", () => {
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com/fcm/send/x")).toBe(true);
    expect(isAllowedPushEndpoint("https://web.push.apple.com/QOx")).toBe(true);
    expect(isAllowedPushEndpoint("https://wns2-par02p.notify.windows.com/w/?token=x")).toBe(true);
    expect(isAllowedPushEndpoint("http://fcm.googleapis.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://169.254.169.254/latest")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com.evil.com/x")).toBe(false);
    expect(isAllowedPushEndpoint("https://fcm.googleapis.com:8443/x")).toBe(false);
  });

  test("vapidConfig validates key lengths", () => {
    const keys = generateVapidKeys();
    expect(vapidConfig({ VAPID_PUBLIC_KEY: keys.publicKey, VAPID_PRIVATE_KEY: keys.privateKey, VAPID_SUBJECT: "mailto:a@b.c" })).toMatchObject({ subject: "mailto:a@b.c" });
    expect(vapidConfig({ VAPID_PUBLIC_KEY: "x", VAPID_PRIVATE_KEY: keys.privateKey })).toBeNull();
  });

  test("sendWebPush posts encrypted body and reports gone subscriptions", async () => {
    const keys = generateVapidKeys();
    const ua = crypto.createECDH("prime256v1");
    ua.generateKeys();
    const sub = { endpoint: "https://fcm.googleapis.com/fcm/send/abc", keys: { p256dh: b64u(ua.getPublicKey()), auth: b64u(crypto.randomBytes(16)) } };
    const calls = [];
    const fetchImpl = async (url, init) => { calls.push({ url, init }); return { status: 410 }; };
    const result = await sendWebPush(sub, { title: "x" }, { vapid: { ...keys, subject: "mailto:a@b.c" }, fetchImpl, topic: "flood alert!" });
    expect(result).toEqual({ ok: false, status: 410, gone: true });
    expect(calls[0].init.headers["Content-Encoding"]).toBe("aes128gcm");
    expect(calls[0].init.headers.Topic).toBe("floodalert");
    const blocked = await sendWebPush({ ...sub, endpoint: "https://evil.example/x" }, {}, { vapid: { ...keys, subject: "x" }, fetchImpl });
    expect(blocked.gone).toBe(true);
    expect(calls).toHaveLength(1);
  });
});
