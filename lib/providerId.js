// เข้าสู่ระบบด้วย Provider ID (ผ่าน OAuth ของ Health ID กระทรวงสาธารณสุข)
// ขั้นตอน: Health ID /oauth/redirect → code → /api/v1/token (Health ID access_token)
//        → Provider ID /api/v1/services/token (token_by "Health ID") → /api/v1/services/profile
// อ้างอิง: คู่มือการเชื่อมต่อระบบ Provider ID ด้วย OAuth ของ Health ID (1 ก.ค. 2567)
import crypto from "crypto";
import { getAppBasePath } from "@/lib/thaiIdConfig";

export const PROVIDER_CALLBACK_PATH = "/api/auth/provider-id/callback/";
export const PROVIDER_STATE_COOKIE = "provider_id_state";
export const PROVIDER_LINK_COOKIE = "provider_id_link";
const TIMEOUT_MS = 20000;

const URLS = {
  uat: { health: "https://uat-moph.id.th", provider: "https://uat-provider.id.th" },
  prd: { health: "https://moph.id.th", provider: "https://provider.id.th" }
};

function env(...keys) {
  for (const key of keys) {
    const value = process.env[key];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

const trimSlash = (value) => value.replace(/\/+$/, "");

function requestOrigin(request) {
  const host = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  if (host) return `${request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "https"}://${host}`;
  return new URL(request.url).origin;
}

/** ที่อยู่ของแอป (origin + basePath) สำหรับ redirect กลับหน้าเว็บ */
export function appBaseUrl(request) {
  const configured = env("NEXT_PUBLIC_BASE_URL", "NEXT_PUBLIC_API_URL");
  const origin = configured ? new URL(configured).origin : requestOrigin(request);
  return `${origin}${getAppBasePath()}`;
}

export function getProviderIdConfig(request) {
  const mode = env("PROVIDER_ID_ENV").toLowerCase() === "prd" ? "prd" : "uat";
  return {
    mode,
    healthIdUrl: trimSlash(env("HEALTH_ID_URL") || URLS[mode].health),
    providerUrl: trimSlash(env("PROVIDER_ID_URL") || URLS[mode].provider),
    // ใส่ได้ทั้งชุด UAT และ PRD (เช่น HEALTH_ID_UAT_CLIENT_ID / HEALTH_ID_PRD_CLIENT_ID) แล้วสลับด้วย PROVIDER_ID_ENV
    // หรือใส่ชุดเดียวแบบไม่มี _UAT/_PRD ก็ได้
    healthClientId: env(`HEALTH_ID_${mode.toUpperCase()}_CLIENT_ID`, "HEALTH_ID_CLIENT_ID"),
    healthClientSecret: env(`HEALTH_ID_${mode.toUpperCase()}_CLIENT_SECRET`, "HEALTH_ID_CLIENT_SECRET"),
    providerClientId: env(`PROVIDER_ID_${mode.toUpperCase()}_CLIENT_ID`, "PROVIDER_ID_CLIENT_ID"),
    providerSecretKey: env(`PROVIDER_ID_${mode.toUpperCase()}_SECRET_KEY`, "PROVIDER_ID_SECRET_KEY"),
    // ต้องตรงกับ redirect_uri ที่ลงทะเบียนกับ Health ID ทุกตัวอักษร
    redirectUri: env("PROVIDER_ID_REDIRECT_URI") || `${appBaseUrl(request)}${PROVIDER_CALLBACK_PATH}`
  };
}

export function getProviderIdConfigError(config) {
  const m = (config.mode || "uat").toUpperCase();
  const missing = [
    [`HEALTH_ID_${m}_CLIENT_ID`, config.healthClientId],
    [`HEALTH_ID_${m}_CLIENT_SECRET`, config.healthClientSecret],
    [`PROVIDER_ID_${m}_CLIENT_ID`, config.providerClientId],
    [`PROVIDER_ID_${m}_SECRET_KEY`, config.providerSecretKey]
  ].filter(([, value]) => !value).map(([key]) => key);
  return missing.length ? `ยังไม่ได้ตั้งค่าการเข้าสู่ระบบด้วย Provider ID (${missing.join(", ")})` : null;
}

export function buildHealthIdAuthorizeUrl(config, state) {
  const url = new URL(`${config.healthIdUrl}/oauth/redirect`);
  url.searchParams.set("client_id", config.healthClientId);
  url.searchParams.set("redirect_uri", config.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("state", state);
  return url.toString();
}

export class ProviderIdError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function call(url, init, fetchImpl) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, { ...init, signal: controller.signal, cache: "no-store" });
    const text = await response.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = null; }
    return { status: response.status, ok: response.ok, json };
  } catch (error) {
    if (error?.name === "AbortError") throw new ProviderIdError("timeout", "เชื่อมต่อ Health ID / Provider ID ไม่ทันเวลา กรุณาลองใหม่");
    throw new ProviderIdError("network", "เซิร์ฟเวอร์เชื่อมต่อ Health ID / Provider ID ไม่ได้");
  } finally {
    clearTimeout(timer);
  }
}

/** แลก code เป็น access_token ของ Health ID */
export async function exchangeHealthIdCode(config, code, fetchImpl = fetch) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: config.redirectUri,
    client_id: config.healthClientId,
    client_secret: config.healthClientSecret
  });
  const result = await call(`${config.healthIdUrl}/api/v1/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString()
  }, fetchImpl);
  const token = result.json?.data?.access_token;
  if (!result.ok || !token) {
    const message = result.json?.message || "";
    throw new ProviderIdError("health_token", /redirect uri/i.test(message)
      ? "Redirect URI ไม่ตรงกับที่ลงทะเบียนกับ Health ID"
      : /expired/i.test(message) ? "รหัสยืนยันหมดอายุ กรุณาเข้าสู่ระบบใหม่" : "ยืนยันตัวตนกับ Health ID ไม่สำเร็จ", result.status);
  }
  return token;
}

/** ขอ access_token ของ Provider ID ด้วย token ของ Health ID — ไม่มี Provider ID ได้ 400 */
export async function requestProviderToken(config, healthToken, fetchImpl = fetch) {
  const result = await call(`${config.providerUrl}/api/v1/services/token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: config.providerClientId, secret_key: config.providerSecretKey, token_by: "Health ID", token: healthToken })
  }, fetchImpl);
  const token = result.json?.data?.access_token;
  if (result.status === 400 && /provider id/i.test(result.json?.message || "")) {
    throw new ProviderIdError("no_provider", "บัญชี Health ID นี้ยังไม่มี Provider ID (สำหรับบุคลากรสาธารณสุขที่ลงทะเบียนแล้วเท่านั้น)", 400);
  }
  if (!result.ok || !token) throw new ProviderIdError("provider_token", "ขอสิทธิ์จาก Provider ID ไม่สำเร็จ", result.status);
  return token;
}

/** ข้อมูลบุคคลและหน่วยงานจาก Provider ID */
export async function fetchProviderProfile(config, providerToken, fetchImpl = fetch) {
  const result = await call(`${config.providerUrl}/api/v1/services/profile?position_type=1`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${providerToken}`,
      "client-id": config.providerClientId,
      "secret-key": config.providerSecretKey
    }
  }, fetchImpl);
  if (result.status === 404) throw new ProviderIdError("no_provider", "ไม่พบข้อมูล Provider ID ของบัญชีนี้", 404);
  if (!result.ok || !result.json?.data) throw new ProviderIdError("profile", "ดึงข้อมูลจาก Provider ID ไม่สำเร็จ", result.status);
  return result.json.data;
}

const clean = (value, max = 255) => {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, max) : null;
};

/** แปลงข้อมูลจาก Provider ID เป็นรูปแบบที่ระบบใช้ (ไม่เก็บเลขบัตรประชาชน) */
export function normalizeProviderProfile(data = {}) {
  const orgs = (Array.isArray(data.organization) ? data.organization : data.organization ? [data.organization] : [])
    .map((org) => ({
      hcode: clean(org?.hcode, 20),
      name: clean(org?.hname_th, 255),
      position: clean(org?.position, 255),
      positionType: clean(org?.position_type, 100),
      province: clean(org?.address?.province, 100)
    }));
  const nameParts = String(data.name_th || "").trim().split(/\s+/);
  return {
    accountId: clean(data.account_id, 64),
    hashCid: clean(data.hash_cid, 128),
    providerId: clean(data.provider_id, 40),
    title: clean(data.special_title_th || data.title_th, 50),
    givenName: clean(data.firstname_th || nameParts[0], 100),
    familyName: clean(data.lastname_th || nameParts.slice(1).join(" "), 100),
    organizations: orgs,
    primaryOrg: orgs[0] || null
  };
}

/** hash_cid จาก Provider ID เป็น SHA-256 ของเลขบัตรตรง ๆ (เดาย้อนได้) จึงเก็บเป็น HMAC ด้วย SECRET_KEY อีกชั้น */
export function protectHashCid(hashCid) {
  if (!hashCid) return null;
  const secret = process.env.SECRET_KEY;
  if (!secret) throw new Error("SECRET_KEY is not defined in environment variables");
  return crypto.createHmac("sha256", secret).update(`provider:${String(hashCid).toLowerCase()}`).digest("hex");
}

/** cookie บอกว่ากำลัง "เชื่อมบัญชี" ให้เจ้าหน้าที่คนไหน — ผูกกับ state และลงลายมือชื่อกันแก้ */
export function signLinkIntent(officerId, state) {
  const secret = process.env.SECRET_KEY || "";
  const mac = crypto.createHmac("sha256", secret).update(`${officerId}.${state}`).digest("hex");
  return `${officerId}.${mac}`;
}

export function verifyLinkIntent(value, state) {
  const [id, mac] = String(value || "").split(".");
  const officerId = Number(id);
  if (!Number.isInteger(officerId) || officerId <= 0 || !mac || !state) return null;
  const expected = signLinkIntent(officerId, state).split(".")[1];
  const a = Buffer.from(mac, "hex");
  const b = Buffer.from(expected, "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? officerId : null;
}

export const shortLivedCookie = (maxAge) => ({
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  maxAge,
  path: "/"
});
