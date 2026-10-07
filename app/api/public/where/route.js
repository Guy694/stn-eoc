import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { pointInGeometry } from "@/lib/healthFacilityStatus";
import { enforceIpRateLimit } from "@/lib/rateLimit";

// พิกัด → หมู่บ้าน/ตำบล/อำเภอ (ทำที่เซิร์ฟเวอร์ เพื่อไม่ต้องส่งขอบเขตทั้งจังหวัด ~1.6 MB ไปมือถือ)
const CACHE_MS = 24 * 60 * 60 * 1000;
let cache = null;

function parseGeometry(value) {
  if (!value) return null;
  try {
    if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
    return typeof value === "string" ? JSON.parse(value) : value;
  } catch {
    return null;
  }
}

function firstPair(coordinates) {
  let node = coordinates;
  while (Array.isArray(node) && Array.isArray(node[0])) node = node[0];
  return Array.isArray(node) ? node : null;
}

function swapPairs(coordinates) {
  if (!Array.isArray(coordinates)) return coordinates;
  if (typeof coordinates[0] === "number") return [coordinates[1], coordinates[0]];
  return coordinates.map(swapPairs);
}

// บางแถวเก็บพิกัดเป็น [lat, lng] — สตูลมีลองจิจูด ~100 ละติจูด ~7 จึงแยกได้ชัด
function normalizeGeometry(geometry) {
  const pair = firstPair(geometry?.coordinates);
  if (!pair) return null;
  return pair[0] < 20 && pair[1] > 90 ? { ...geometry, coordinates: swapPairs(geometry.coordinates) } : geometry;
}

function bbox(geometry) {
  const box = [Infinity, Infinity, -Infinity, -Infinity];
  const walk = (node) => {
    if (typeof node?.[0] === "number") {
      box[0] = Math.min(box[0], node[0]); box[1] = Math.min(box[1], node[1]);
      box[2] = Math.max(box[2], node[0]); box[3] = Math.max(box[3], node[1]);
      return;
    }
    (node || []).forEach(walk);
  };
  walk(geometry.coordinates);
  return box;
}

async function loadAreas() {
  if (cache && Date.now() - cache.at < CACHE_MS) return cache;
  const [villages, tambons] = await Promise.all([
    query(`SELECT villname AS name, moo, subdistnam AS tambon, distname AS district, ST_AsGeoJSON(geom) AS geojson
           FROM satun_village_polygon WHERE geom IS NOT NULL`),
    query(`SELECT tam_name AS tambon, dis_name AS district, ST_AsGeoJSON(geometry) AS geojson
           FROM tambons_polygon WHERE pro_code = '91' AND geometry IS NOT NULL`)
  ]);
  const prepare = (rows) => rows
    .map((row) => {
      const geometry = normalizeGeometry(parseGeometry(row.geojson));
      return geometry ? { ...row, geojson: undefined, geometry, box: bbox(geometry) } : null;
    })
    .filter(Boolean);
  cache = { villages: prepare(villages), tambons: prepare(tambons), at: Date.now() };
  return cache;
}

function find(list, lat, lng) {
  return list.find((item) => lng >= item.box[0] && lng <= item.box[2] && lat >= item.box[1] && lat <= item.box[3]
    && pointInGeometry(lat, lng, item.geometry)) || null;
}

// POST: พิกัดบ้านเป็นข้อมูลส่วนบุคคล ไม่ใส่ใน URL (จะไปค้างใน access log / cache กลาง)
export async function POST(request) {
  const limited = await enforceIpRateLimit(request, "geoLookup", { store: "memory" });
  if (limited) return limited;
  const body = await request.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ success: false, message: "พิกัดไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const { villages, tambons } = await loadAreas();
    const village = find(villages, lat, lng);
    const tambon = village ? null : find(tambons, lat, lng);
    const villageName = village && !["", "-", "ไม่มีข้อมูล"].includes(String(village.name || "").trim()) ? village.name : null;
    const data = village
      ? { village: villageName, moo: villageName ? village.moo || null : null, tambon: village.tambon, district: village.district, in_satun: true }
      : tambon
        ? { village: null, moo: null, tambon: tambon.tambon, district: tambon.district, in_satun: true }
        : { village: null, moo: null, tambon: null, district: null, in_satun: false };
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Where API error:", error);
    return publicInternalError("ระบุพื้นที่ไม่สำเร็จ");
  }
}
