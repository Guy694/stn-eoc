import { query } from "@/lib/db";

const DISTRICTS = [
  { name: "เมืองสตูล", aliases: ["เมือง", "อำเภอเมือง", "อ.เมือง", "mueang", "mueang satun"], lat: 6.6238, lon: 100.0673 },
  { name: "ควนโดน", aliases: ["อำเภอควนโดน", "อ.ควนโดน", "khuan don"], lat: 6.787, lon: 100.077 },
  { name: "ควนกาหลง", aliases: ["อำเภอควนกาหลง", "อ.ควนกาหลง", "khuan kalong"], lat: 6.846, lon: 100.071 },
  { name: "ท่าแพ", aliases: ["อำเภอท่าแพ", "อ.ท่าแพ", "tha phae"], lat: 6.79, lon: 99.97 },
  { name: "ละงู", aliases: ["อำเภอละงู", "อ.ละงู", "la-ngu", "langu", "la ngu"], lat: 6.884, lon: 99.788 },
  { name: "ทุ่งหว้า", aliases: ["อำเภอทุ่งหว้า", "อ.ทุ่งหว้า", "thung wa"], lat: 7.11, lon: 99.755 },
  { name: "มะนัง", aliases: ["อำเภอมะนัง", "อ.มะนัง", "manang"], lat: 6.965, lon: 99.958 }
];

const CORRIDORS = [
  {
    key: "mueang-langu-main",
    districts: ["เมืองสตูล", "ท่าแพ", "ละงู"],
    labels: ["เมืองสตูล", "ท่าแพ", "ละงู"],
    name: "เส้นหลัก เมืองสตูล - ท่าแพ - ละงู",
    routeHint: "ใช้ถนนสายหลักแนว สตูล-ละงู (ทล.406) ผ่านท่าแพ"
  },
  {
    key: "mueang-langu-east",
    districts: ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ละงู"],
    labels: ["เมืองสตูล", "ควนโดน", "ควนกาหลง", "ละงู"],
    name: "เส้นสำรองฝั่งตะวันออก",
    routeHint: "พิจารณาเส้นทางผ่านควนโดน/ควนกาหลง หากเส้นหลักมีรายงานปิดถนน"
  },
  {
    key: "mueang-langu-south",
    districts: ["เมืองสตูล", "ท่าแพ", "ละงู", "ทุ่งหว้า"],
    labels: ["เมืองสตูล", "ท่าแพ", "ละงู"],
    name: "เส้นเลียบพื้นที่ละงู",
    routeHint: "ใช้ได้เมื่อจุดหมายอยู่ตอนใต้/ชายฝั่งของละงู แต่ต้องตรวจรายงานถนนล่าสุด"
  }
];

const SEVERITY_SCORE = {
  "สูงมาก": 5,
  "สูง": 4,
  severe: 4,
  "ปานกลาง": 3,
  moderate: 3,
  "ต่ำ": 1,
  mild: 1,
  safe: 0,
  "ไม่มี": 0
};

function normalizeText(value) {
  return String(value || "").toLowerCase().replace(/\s+/g, "");
}

function findDistrict(text, preferredDirection = "from") {
  const normalized = normalizeText(text);
  const matches = DISTRICTS.filter((district) => {
    const names = [district.name, ...district.aliases];
    return names.some((name) => normalized.includes(normalizeText(name)));
  });

  if (matches.length <= 1) return matches[0] || null;

  const directionPatterns = preferredDirection === "to"
    ? [/ไป(.+)/, /ถึง(.+)/, /ปลายทาง(.+)/]
    : [/(?:จาก|อยู่)(.+?)(?:จะ|ไป|ถึง|$)/, /ต้นทาง(.+?)(?:ไป|ถึง|$)/];

  for (const pattern of directionPatterns) {
    const matched = String(text || "").match(pattern);
    if (!matched?.[1]) continue;
    const part = normalizeText(matched[1]);
    const scoped = matches.find((district) => [district.name, ...district.aliases].some((name) => part.includes(normalizeText(name))));
    if (scoped) return scoped;
  }

  return preferredDirection === "to" ? matches[matches.length - 1] : matches[0];
}

export function isRouteAdviceQuestion(message) {
  const text = normalizeText(message);
  return /(ไปได้ไหม|ไปได้หรือไม่|เส้นทาง|เดินทาง|ถนน|ทางไหน|route|travel)/i.test(text)
    && /(ไป|จาก|ถึง|อำเภอ|อ\.)/i.test(String(message || ""));
}

export function parseRouteQuestion(message) {
  return {
    from: findDistrict(message, "from"),
    to: findDistrict(message, "to")
  };
}

function haversineKm(a, b) {
  const radius = 6371;
  const dLat = (b.lat - a.lat) * Math.PI / 180;
  const dLon = (b.lon - a.lon) * Math.PI / 180;
  const lat1 = a.lat * Math.PI / 180;
  const lat2 = b.lat * Math.PI / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return 2 * radius * Math.asin(Math.sqrt(h));
}

function distancePointToSegmentKm(point, start, end) {
  const x = point.lon;
  const y = point.lat;
  const x1 = start.lon;
  const y1 = start.lat;
  const x2 = end.lon;
  const y2 = end.lat;
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) return haversineKm(point, start);
  const t = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy)));
  const projection = { lat: y1 + t * dy, lon: x1 + t * dx };
  return haversineKm(point, projection);
}

async function hasTable(tableName) {
  try {
    const rows = await query(`
      SELECT TABLE_NAME
      FROM INFORMATION_SCHEMA.TABLES
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
      LIMIT 1
    `, [tableName]);
    return rows.length > 0;
  } catch (error) {
    console.error(`Route advice table check failed for ${tableName}:`, error);
    return false;
  }
}

async function fetchActiveFloodSession() {
  if (!await hasTable("eoc_sessions")) return null;
  try {
    const rows = await query(`
      SELECT id, session_number, opened_at, status
      FROM eoc_sessions
      WHERE eoc_type = 'flood'
      ORDER BY status = 'active' DESC, opened_at DESC
      LIMIT 1
    `, []);
    return rows[0] || null;
  } catch (error) {
    console.error("Route advice session lookup failed:", error);
    return null;
  }
}

async function fetchFloodRisks(sessionId) {
  if (!sessionId || !await hasTable("flood_records")) return [];
  try {
    return query(`
      SELECT
        id,
        district,
        tambon,
        village,
        flood_level,
        water_depth_cm,
        flood_start_date,
        updated_at
      FROM flood_records
      WHERE session_id = ?
        AND flood_level <> 'ไม่มี'
      ORDER BY
        FIELD(flood_level, 'สูงมาก', 'สูง', 'ปานกลาง', 'ต่ำ', 'ไม่มี'),
        flood_start_date DESC
      LIMIT 200
    `, [sessionId]);
  } catch (error) {
    console.error("Route advice flood risk lookup failed:", error);
    return [];
  }
}

async function fetchTrafficReports() {
  if (!await hasTable("public_incident_reports")) return [];
  try {
    return query(`
      SELECT
        id,
        district,
        sub_district,
        village,
        latitude,
        longitude,
        description,
        water_level,
        urgency,
        travel_status,
        report_type,
        occurred_at,
        reviewed_at
      FROM public_incident_reports
      WHERE status = 'verified'
        AND disaster_type = 'flood'
        AND (
          report_type = 'traffic_report'
          OR travel_status IS NOT NULL
          OR description LIKE '%ถนน%'
          OR description LIKE '%เส้นทาง%'
        )
      ORDER BY COALESCE(reviewed_at, occurred_at) DESC
      LIMIT 200
    `, []);
  } catch (error) {
    console.error("Route advice traffic report lookup failed:", error);
    return [];
  }
}

async function fetchOsrmRoute(from, to) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 3500);
  try {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?alternatives=true&overview=full&geometries=geojson&steps=true&language=th`;
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    const data = await response.json();
    return data.routes?.map((route, index) => ({
      index,
      distanceKm: route.distance ? route.distance / 1000 : null,
      durationMin: route.duration ? route.duration / 60 : null,
      geometry: route.geometry,
      roadNames: [...new Set((route.legs || []).flatMap((leg) => (leg.steps || []).map((step) => step.name).filter(Boolean)))].slice(0, 8)
    })) || null;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function routeDistricts(from, to) {
  const exact = CORRIDORS.filter((route) => route.districts.includes(from.name) && route.districts.includes(to.name));
  if (exact.length > 0) return exact;
  return [{
    key: "direct",
    districts: [from.name, to.name],
    labels: [from.name, to.name],
    name: `เส้นทาง ${from.name} - ${to.name}`,
    routeHint: `ใช้เส้นทางหลักจาก${from.name}ไป${to.name} และตรวจจุดเสี่ยงตามอำเภอรายทาง`
  }];
}

function scoreRoute(route, from, to, floodRisks, trafficReports) {
  const districts = new Set(route.districts);
  const routePoints = route.labels
    .map((name) => DISTRICTS.find((district) => district.name === name))
    .filter(Boolean);
  const floodMatches = floodRisks.filter((item) => districts.has(item.district));
  const trafficMatches = trafficReports.filter((item) => {
    if (districts.has(item.district)) return true;
    const lat = Number(item.latitude);
    const lon = Number(item.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon) || routePoints.length < 2) return false;
    return routePoints.some((point, index) => {
      const next = routePoints[index + 1];
      if (!next) return false;
      return distancePointToSegmentKm({ lat, lon }, point, next) <= 8;
    });
  });

  const floodScore = floodMatches.reduce((sum, item) => sum + (SEVERITY_SCORE[item.flood_level] || 0), 0);
  const trafficScore = trafficMatches.reduce((sum, item) => {
    const status = normalizeText(item.travel_status);
    if (status.includes("impassable") || status.includes("blocked") || status.includes("ปิด") || status.includes("ผ่านไม่ได้")) return sum + 5;
    if (status.includes("difficult") || status.includes("caution") || status.includes("ลำบาก") || status.includes("ระวัง")) return sum + 3;
    if (status.includes("passable") || status.includes("normal") || status.includes("ปกติ")) return sum;
    return sum + 2;
  }, 0);
  const score = floodScore + trafficScore;
  const level = score >= 8 ? "ไม่แนะนำ" : score >= 3 ? "ควรระวัง" : "ไปได้";

  return {
    ...route,
    distanceKm: haversineKm(from, to),
    riskScore: score,
    level,
    floodMatches: floodMatches.slice(0, 8),
    trafficMatches: trafficMatches.slice(0, 8)
  };
}

function formatTravelStatus(status) {
  const normalized = normalizeText(status);
  if (normalized.includes("impassable") || normalized.includes("blocked") || normalized.includes("ปิด") || normalized.includes("ผ่านไม่ได้")) {
    return "ผ่านไม่ได้/ควรหลีกเลี่ยง";
  }
  if (normalized.includes("difficult") || normalized.includes("caution") || normalized.includes("ลำบาก") || normalized.includes("ระวัง")) {
    return "สัญจรลำบาก/ต้องระวัง";
  }
  if (normalized.includes("passable") || normalized.includes("normal") || normalized.includes("ปกติ")) {
    return "สัญจรได้";
  }
  return status || "มีรายงาน";
}

function buildAnswer({ from, to, routes, osrmRoutes, activeSession }) {
  const best = [...routes].sort((a, b) => a.riskScore - b.riskScore)[0];
  const osrm = osrmRoutes?.[0];
  const roadNames = osrm?.roadNames?.length ? ` เส้นทางจาก routing engine พบถนน/ช่วงทาง เช่น ${osrm.roadNames.join(", ")}.` : "";
  const distance = osrm?.distanceKm ? ` ระยะทางประมาณ ${osrm.distanceKm.toFixed(1)} กม. ใช้เวลาประมาณ ${Math.round(osrm.durationMin || 0)} นาทีในสภาพปกติ.` : "";
  const routeLead = best?.level === "ไม่แนะนำ"
    ? "ยังไม่พบเส้นทางที่แนะนำให้ใช้จากข้อมูลปัจจุบัน ตัวเลือกที่ควรตรวจสอบเพิ่มเติม"
    : "เส้นทางแนะนำ";
  const sessionText = activeSession
    ? `อ้างอิงข้อมูล EOC flood session #${activeSession.session_number || activeSession.id} (${activeSession.status || "ไม่ทราบสถานะ"})`
    : "อ้างอิงข้อมูลล่าสุดในระบบ";

  const riskLines = routes.map((route, index) => {
    const flood = route.floodMatches.length
      ? `พื้นที่น้ำท่วม ${route.floodMatches.map((item) => `${item.district}/${item.tambon || "-"}(${item.flood_level})`).slice(0, 3).join(", ")}`
      : "ไม่พบพื้นที่น้ำท่วมในอำเภอรายทาง";
    const traffic = route.trafficMatches.length
      ? `รายงานถนน ${route.trafficMatches.map((item) => `${item.district || "-"}:${formatTravelStatus(item.travel_status)}`).slice(0, 2).join(", ")}`
      : "ไม่พบรายงานถนนปิด/เส้นทางผิดปกติ";
    return `${index + 1}. ${route.name}: ${route.level} - ${route.routeHint} (${flood}; ${traffic})`;
  }).join("\n");

  return `จาก${from.name}ไป${to.name}: ${best?.level || "ยังประเมินไม่ได้"}\n\n${routeLead}: ${best?.name || "-"} - ${best?.routeHint || "-"}${distance}${roadNames}\n\n${sessionText}\n${riskLines}\n\nหมายเหตุ: คำตอบนี้ประเมินจากข้อมูลน้ำท่วมและรายงานถนนในระบบ ไม่ใช่การยืนยันจากเจ้าหน้าที่ภาคสนามแบบเรียลไทม์ หากพบป้ายปิดทางหรือระดับน้ำสูง ให้หลีกเลี่ยงทันทีและโทร 1784/1669 ตามความจำเป็น`;
}

export async function getRouteAdvice({ message, from: fromInput, to: toInput }) {
  const parsed = parseRouteQuestion(message || "");
  const from = typeof fromInput === "string" ? findDistrict(fromInput, "from") : fromInput || parsed.from;
  const to = typeof toInput === "string" ? findDistrict(toInput, "to") : toInput || parsed.to;

  if (!from || !to) {
    return {
      success: false,
      message: "กรุณาระบุต้นทางและปลายทางเป็นชื่ออำเภอในจังหวัดสตูล เช่น จากอำเภอเมืองไปอำเภอละงู"
    };
  }

  const [activeSession, trafficReports, osrmRoutes] = await Promise.all([
    fetchActiveFloodSession(),
    fetchTrafficReports(),
    fetchOsrmRoute(from, to)
  ]);
  const floodRisks = await fetchFloodRisks(activeSession?.id);
  const routes = routeDistricts(from, to).map((route) => scoreRoute(route, from, to, floodRisks, trafficReports));

  return {
    success: true,
    from,
    to,
    activeSession,
    routes,
    osrmRoutes,
    answer: buildAnswer({ from, to, routes, osrmRoutes, activeSession })
  };
}
