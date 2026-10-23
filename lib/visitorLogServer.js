// บันทึก/อ่านประวัติผู้เข้าชม (ฝั่งเซิร์ฟเวอร์)
import { query } from "@/lib/db";
import { getAuthSession, getSessionToken } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/clientIp";
import {
  areaOf, classifyIp, cleanPath, describeUserAgent, geoFromHeaders, geoLookupUrl, normalizeGps, parseGeoLookup, referrerHost
} from "@/lib/visitorLog";

const GEO_CACHE_MS = 24 * 60 * 60 * 1000;
const geoCache = new Map();

async function cachedGeo(ip) {
  const hit = geoCache.get(ip);
  if (hit && Date.now() - hit.at < GEO_CACHE_MS) return hit.geo;
  // ใช้ตำแหน่งที่เคยหาได้ของ IP เดียวกันใน 7 วัน (ไม่ต้องถามบริการภายนอกซ้ำ)
  const rows = await query(
    `SELECT country, region, city, latitude, longitude, geo_source FROM visitor_access_log
     WHERE ip_address = ? AND country IS NOT NULL AND visited_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
     ORDER BY id DESC LIMIT 1`,
    [ip]
  ).catch(() => []);
  if (rows[0]) {
    const geo = { country: rows[0].country, region: rows[0].region, city: rows[0].city, latitude: rows[0].latitude, longitude: rows[0].longitude, source: rows[0].geo_source || "cache" };
    geoCache.set(ip, { at: Date.now(), geo });
    return geo;
  }
  return null;
}

async function lookupGeo(ip) {
  const url = geoLookupUrl(ip);
  if (!url) return null;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(3000), headers: { accept: "application/json" } });
    if (!response.ok) return null;
    const geo = parseGeoLookup(await response.json());
    geoCache.set(ip, { at: Date.now(), geo });
    return geo;
  } catch {
    return null;
  }
}

/** ผู้ใช้ที่เข้าสู่ระบบอยู่ (ถ้ามี) — ไม่มีคุกกี้ = ไม่แตะฐานข้อมูล session */
async function currentUser(request) {
  if (!getSessionToken(request)) return null;
  try {
    const auth = await getAuthSession(request, { allowPasswordChangeRequired: true });
    return auth.success ? auth.user : null;
  } catch {
    return null;
  }
}

/**
 * บันทึกการเข้าชม 1 ครั้ง
 * @returns {Promise<{ saved: boolean, reason?: string }>}
 */
export async function recordVisitorAccess(request, { path, referrer, gps } = {}) {
  const cleanedPath = cleanPath(path);
  if (!cleanedPath) return { saved: false, reason: "path" };
  const ip = getClientIp(request);
  const userAgent = getUserAgent(request);
  const { device, browser } = describeUserAgent(userAgent);
  const network = classifyIp(ip);
  const user = await currentUser(request);
  const ownHost = request.headers.get("host")?.split(":")[0] || "";
  const geo = network === "public" ? (geoFromHeaders(request.headers) || await cachedGeo(ip)) : null;

  const columns = ["ip_address", "area", "path", "referrer_host", "user_id", "username", "role", "device", "browser", "user_agent", "network", "country", "region", "city", "latitude", "longitude", "geo_source"];
  const values = [
    ip, areaOf(cleanedPath), cleanedPath, referrerHost(referrer, ownHost),
    user?.id || null, user?.username || null, user?.role || null,
    device, browser, String(userAgent || "").slice(0, 300), network,
    geo?.country || null, geo?.region || null, geo?.city || null, geo?.latitude ?? null, geo?.longitude ?? null, geo?.source || null
  ];
  // GPS ที่ผู้ใช้อนุญาต (ปัดแล้ว ≈ 1 กม.)
  const point = normalizeGps(gps);
  if (point) {
    columns.push("gps_latitude", "gps_longitude", "gps_accuracy_m", "gps_context");
    values.push(point.latitude, point.longitude, point.accuracy, point.context);
  }
  let result;
  try {
    result = await query(`INSERT INTO visitor_access_log (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`, values);
  } catch (error) {
    // ยังไม่ได้รัน migration คอลัมน์ GPS → บันทึกส่วนอื่นไว้ก่อน
    if (!point || error?.code !== "ER_BAD_FIELD_ERROR") throw error;
    result = await query(`INSERT INTO visitor_access_log (${columns.slice(0, 17).join(", ")}) VALUES (${columns.slice(0, 17).map(() => "?").join(", ")})`, values.slice(0, 17));
  }

  // ยังไม่รู้ตำแหน่ง และผู้ดูแลตั้งบริการค้นหาไว้ → หาเบื้องหลัง แล้วเติมให้แถวนี้ (ไม่ทำให้หน้าเว็บช้า)
  if (!geo && result?.insertId && geoLookupUrl(ip)) {
    void lookupGeo(ip).then((found) => {
      if (!found) return;
      return query(
        `UPDATE visitor_access_log SET country = ?, region = ?, city = ?, latitude = ?, longitude = ?, geo_source = ? WHERE id = ?`,
        [found.country, found.region, found.city, found.latitude, found.longitude, found.source, result.insertId]
      );
    }).catch(() => {});
  }
  return { saved: true };
}

let gpsColumnsReady = null;
/** คอลัมน์ GPS (มีหลัง migration 20261023_visitor_gps) */
async function gpsColumns() {
  if (gpsColumnsReady === null) {
    const rows = await query(
      `SELECT COUNT(*) AS n FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'visitor_access_log' AND COLUMN_NAME = 'gps_latitude'`
    ).catch(() => [{ n: 0 }]);
    gpsColumnsReady = Number(rows[0]?.n || 0) > 0;
  }
  return gpsColumnsReady ? ", gps_latitude, gps_longitude, gps_accuracy_m, gps_context" : "";
}

const ALLOWED_RANGES = { "1": 1, "7": 7, "30": 30, "90": 90 };

/** อ่านประวัติสำหรับผู้ดูแล: ตัวกรอง + สรุป + หน้า */
/** ตัวกรองร่วมของรายการและแผนที่ */
async function buildFilters(searchParams) {
  const days = ALLOWED_RANGES[searchParams.get("days") || "7"] || 7;
  const area = ["public", "staff"].includes(searchParams.get("area")) ? searchParams.get("area") : "";
  const q = String(searchParams.get("q") || "").trim().slice(0, 100);
  const loggedIn = searchParams.get("user") === "1";
  const where = ["visited_at > DATE_SUB(NOW(), INTERVAL ? DAY)"];
  const params = [String(days)];
  if (area) { where.push("area = ?"); params.push(area); }
  if (loggedIn) where.push("user_id IS NOT NULL");
  if (searchParams.get("gps") === "1" && (await gpsColumns())) where.push("gps_latitude IS NOT NULL");
  if (q) {
    where.push("(ip_address LIKE ? OR path LIKE ? OR username LIKE ? OR city LIKE ? OR region LIKE ?)");
    const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
    params.push(like, like, like, like, like);
  }
  return { days, area, q, loggedIn, whereSql: where.join(" AND "), params };
}

export const MAX_MAP_POINTS = 3000;

/**
 * จุดบนแผนที่ผู้เข้าชม: รวมการเข้าชมที่ตำแหน่งเดียวกัน (GPS ที่อนุญาตก่อน ไม่มีจึงใช้ตำแหน่งจาก IP ปัด ≈ 1 กม.)
 * คืน { points: [{ lat, lon, kind, visits, ips, staff, users, last_seen }], truncated }
 */
export async function readVisitorPoints(searchParams) {
  const { whereSql, params } = await buildFilters(searchParams);
  const gps = Boolean(await gpsColumns());
  const lat = gps ? "COALESCE(gps_latitude, ROUND(latitude, 2))" : "ROUND(latitude, 2)";
  const lon = gps ? "COALESCE(gps_longitude, ROUND(longitude, 2))" : "ROUND(longitude, 2)";
  const kind = gps ? "IF(gps_latitude IS NOT NULL, 'gps', 'ip')" : "'ip'";
  const rows = await query(
    `SELECT ${lat} AS lat, ${lon} AS lon, ${kind} AS kind,
            COUNT(*) AS visits, COUNT(DISTINCT ip_address) AS ips, SUM(area = 'staff') AS staff,
            SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT username ORDER BY username SEPARATOR ','), ',', 8) AS users,
            COUNT(DISTINCT username) AS user_count,
            SUBSTRING_INDEX(GROUP_CONCAT(DISTINCT ip_address ORDER BY ip_address SEPARATOR ','), ',', 5) AS sample_ips,
            MAX(visited_at) AS last_seen
     FROM visitor_access_log
     WHERE ${whereSql} AND ${lat} IS NOT NULL AND ${lon} IS NOT NULL
     GROUP BY lat, lon, kind
     ORDER BY visits DESC
     LIMIT ${MAX_MAP_POINTS + 1}`,
    params
  );
  const points = rows.slice(0, MAX_MAP_POINTS).map((row) => ({
    lat: Number(row.lat),
    lon: Number(row.lon),
    kind: row.kind,
    visits: Number(row.visits || 0),
    ips: Number(row.ips || 0),
    staff: Number(row.staff || 0),
    users: row.users ? String(row.users).split(",").filter(Boolean) : [],
    userCount: Number(row.user_count || 0),
    sampleIps: row.sample_ips ? String(row.sample_ips).split(",") : [],
    lastSeen: row.last_seen
  }));
  const [unlocated] = await query(
    `SELECT COUNT(*) AS n FROM visitor_access_log WHERE ${whereSql} AND (${lat} IS NULL OR ${lon} IS NULL)`,
    params
  );
  return { points, truncated: rows.length > MAX_MAP_POINTS, unlocated: Number(unlocated?.n || 0) };
}

export async function readVisitorLog(searchParams) {
  const { days, area, q, loggedIn, whereSql, params } = await buildFilters(searchParams);
  const page = Math.max(1, Number.parseInt(searchParams.get("page") || "1", 10) || 1);
  const size = Math.min(100, Math.max(10, Number.parseInt(searchParams.get("size") || "50", 10) || 50));

  const [summary] = await query(
    `SELECT COUNT(*) AS visits, COUNT(DISTINCT ip_address) AS unique_ips,
            COUNT(DISTINCT user_id) AS staff_users, SUM(area = 'staff') AS staff_visits
            ${(await gpsColumns()) ? ", SUM(gps_latitude IS NOT NULL) AS gps_visits" : ", 0 AS gps_visits"}
     FROM visitor_access_log WHERE ${whereSql}`, params
  );
  const rows = await query(
    `SELECT id, visited_at, ip_address, area, path, referrer_host, user_id, username, role, device, browser, network,
            country, region, city, latitude, longitude, geo_source${await gpsColumns()}
     FROM visitor_access_log WHERE ${whereSql}
     ORDER BY visited_at DESC, id DESC LIMIT ${size} OFFSET ${(page - 1) * size}`, params
  );
  const topIps = await query(
    `SELECT ip_address, COUNT(*) AS visits, MAX(visited_at) AS last_seen,
            MAX(username) AS username, MAX(network) AS network, MAX(country) AS country, MAX(region) AS region, MAX(city) AS city
     FROM visitor_access_log WHERE ${whereSql}
     GROUP BY ip_address ORDER BY visits DESC LIMIT 10`, params
  );
  const places = await query(
    `SELECT COALESCE(city, region, country, IF(network = 'private', 'เครือข่ายภายใน', 'ไม่ทราบตำแหน่ง')) AS place,
            COUNT(*) AS visits, COUNT(DISTINCT ip_address) AS unique_ips
     FROM visitor_access_log WHERE ${whereSql}
     GROUP BY place ORDER BY visits DESC LIMIT 10`, params
  );
  return {
    filters: { days, area, q, loggedIn, page, size },
    summary: {
      visits: Number(summary?.visits || 0),
      uniqueIps: Number(summary?.unique_ips || 0),
      staffUsers: Number(summary?.staff_users || 0),
      staffVisits: Number(summary?.staff_visits || 0),
      gpsVisits: Number(summary?.gps_visits || 0)
    },
    total: Number(summary?.visits || 0),
    rows,
    topIps,
    places
  };
}
