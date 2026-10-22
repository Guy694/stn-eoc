// บันทึกการเข้าชมเพื่อความปลอดภัย (IP + ตำแหน่งโดยประมาณจาก IP) — ส่วนที่ไม่แตะฐานข้อมูล ทดสอบได้
//
// ตำแหน่งมาจาก (ตามลำดับ):
//  1) header ที่ proxy/CDN ใส่ให้ เช่น Cloudflare (cf-ipcountry, cf-ipcity, cf-region, cf-iplatitude/longitude)
//     หรือ nginx GeoIP (x-geo-country, x-geo-region, x-geo-city, x-geo-latitude, x-geo-longitude)
//  2) บริการค้นหาตำแหน่งจาก IP ที่ผู้ดูแลตั้งเอง (VISITOR_GEO_LOOKUP_URL เช่น https://ipwho.is/{ip}) — ไม่ตั้ง = ไม่ส่ง IP ออกนอกระบบ
// ไม่ขอ GPS จากผู้เข้าชม

export const DEFAULT_VISITOR_LOG_DAYS = 90;

export function visitorLogRetentionDays(env = process.env) {
  const value = Number.parseInt(env.VISITOR_LOG_RETENTION_DAYS || "", 10);
  return Number.isInteger(value) && value >= 7 && value <= 3650 ? value : DEFAULT_VISITOR_LOG_DAYS;
}

/** IP ภายในองค์กร/เครือข่ายส่วนตัว (หาตำแหน่งจาก IP ไม่ได้) */
export function classifyIp(ip) {
  const value = String(ip || "").trim().toLowerCase();
  if (!value || value === "unknown") return "unknown";
  if (/^(10\.|127\.|192\.168\.|169\.254\.)/.test(value)) return "private";
  const match = value.match(/^172\.(\d+)\./);
  if (match && Number(match[1]) >= 16 && Number(match[1]) <= 31) return "private";
  if (/^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(value)) return "private"; // CGNAT
  if (value === "::1" || value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe80")) return "private";
  return "public";
}

/** path ที่บันทึก: ตัด query/hash ออก (อาจมีเลขติดตามหรือข้อมูลส่วนตัว) และตัดความยาว */
export function cleanPath(value) {
  let path = String(value || "").split(/[?#]/)[0].trim();
  if (!path.startsWith("/")) return null;
  path = path.replace(/^\/stn-eoc(?=\/|$)/, "") || "/";
  if (/[\s<>"']/.test(path)) return null;
  return path.slice(0, 255);
}

/** หน้าเจ้าหน้าที่หรือหน้าสาธารณะ */
export function areaOf(path) {
  return /^\/(admin|eoc|dashboard|analytics|profile|settings|announcements)(\/|$)/.test(path || "") ? "staff" : "public";
}

export function referrerHost(value, ownHost = "") {
  try {
    const host = new URL(String(value || "")).hostname.toLowerCase();
    if (!host || host === String(ownHost || "").toLowerCase()) return null;
    return host.slice(0, 120);
  } catch {
    return null;
  }
}

/** อุปกรณ์และเบราว์เซอร์จาก user agent */
export function describeUserAgent(userAgent) {
  const ua = String(userAgent || "");
  const device = /ipad|tablet|(android(?!.*mobile))/i.test(ua) ? "tablet" : /mobi|iphone|android/i.test(ua) ? "mobile" : ua ? "desktop" : "other";
  const browser = /edg\//i.test(ua) ? "Edge"
    : /line\//i.test(ua) ? "LINE"
      : /fban|fbav/i.test(ua) ? "Facebook"
        : /samsungbrowser/i.test(ua) ? "Samsung Internet"
          : /chrome|crios/i.test(ua) ? "Chrome"
            : /firefox|fxios/i.test(ua) ? "Firefox"
              : /safari/i.test(ua) ? "Safari"
                : /bot|crawler|spider|curl|wget|python/i.test(ua) ? "บอท/สคริปต์" : "อื่น ๆ";
  return { device, browser };
}

const text = (value, max) => {
  const clean = String(value ?? "").trim();
  if (!clean || clean === "XX" || clean === "T1") return null;
  try {
    return decodeURIComponent(clean).slice(0, max);
  } catch {
    return clean.slice(0, max);
  }
};
const coord = (value, limit) => {
  const number = Number.parseFloat(value);
  return Number.isFinite(number) && Math.abs(number) <= limit ? Number(number.toFixed(6)) : null;
};

/** ตำแหน่งจาก header ของ proxy/CDN (ถ้ามี) */
export function geoFromHeaders(headers) {
  const get = (name) => headers?.get?.(name) ?? null;
  const country = text(get("cf-ipcountry") || get("x-vercel-ip-country") || get("x-geo-country"), 8);
  if (!country) return null;
  return {
    country,
    region: text(get("cf-region") || get("x-vercel-ip-country-region") || get("x-geo-region"), 80),
    city: text(get("cf-ipcity") || get("x-vercel-ip-city") || get("x-geo-city"), 80),
    latitude: coord(get("cf-iplatitude") || get("x-vercel-ip-latitude") || get("x-geo-latitude"), 90),
    longitude: coord(get("cf-iplongitude") || get("x-vercel-ip-longitude") || get("x-geo-longitude"), 180),
    source: "headers"
  };
}

/** แปลงผลจากบริการค้นหาตำแหน่ง (รองรับรูปแบบ ipwho.is / ip-api.com / ipinfo.io) */
export function parseGeoLookup(json) {
  if (!json || json.success === false || json.status === "fail") return null;
  const [locLat, locLon] = String(json.loc || "").split(",");
  const country = text(json.country_code || json.countryCode || json.country, 8);
  if (!country) return null;
  return {
    country,
    region: text(json.region || json.regionName, 80),
    city: text(json.city, 80),
    latitude: coord(json.latitude ?? json.lat ?? locLat, 90),
    longitude: coord(json.longitude ?? json.lon ?? locLon, 180),
    source: "lookup"
  };
}

export function geoLookupUrl(ip, env = process.env) {
  const template = String(env.VISITOR_GEO_LOOKUP_URL || "").trim();
  if (!template || !/^https:\/\//i.test(template) || !template.includes("{ip}")) return null;
  if (classifyIp(ip) !== "public") return null;
  return template.replace("{ip}", encodeURIComponent(ip));
}

/** ข้อความตำแหน่งสำหรับแสดงผล */
export function locationLabel(row) {
  if (row?.network === "private") return "เครือข่ายภายใน";
  const parts = [row?.city, row?.region].filter(Boolean);
  const country = row?.country === "TH" ? "ไทย" : row?.country;
  if (!parts.length && !country) return "ไม่ทราบตำแหน่ง";
  return [...parts, country].filter(Boolean).join(", ");
}
