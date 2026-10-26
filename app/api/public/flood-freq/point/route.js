import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { pointInGeometry } from "@/lib/healthFacilityStatus";
import { getFloodFreqData } from "@/lib/gistdaFloodFreqClient";
import { FLOOD_FREQ_TOTAL_YEARS, FLOOD_FREQ_YEARS, thaiYear } from "@/lib/floodFreq";

const NEARBY_RADIUS_M = 200;
const MAX_NEARBY_AREAS = 5;
const METERS_PER_DEGREE = 111_320;

function polygonRings(geometry) {
  if (geometry?.type === "Polygon") return [geometry.coordinates || []];
  if (geometry?.type === "MultiPolygon") return geometry.coordinates || [];
  return [];
}

function geometryBounds(geometry) {
  const bounds = [Infinity, Infinity, -Infinity, -Infinity];
  const visit = (node) => {
    if (typeof node?.[0] === "number" && typeof node?.[1] === "number") {
      bounds[0] = Math.min(bounds[0], node[0]);
      bounds[1] = Math.min(bounds[1], node[1]);
      bounds[2] = Math.max(bounds[2], node[0]);
      bounds[3] = Math.max(bounds[3], node[1]);
      return;
    }
    (node || []).forEach(visit);
  };
  visit(geometry?.coordinates);
  return bounds;
}

function distanceToGeometryMeters(lat, lng, geometry) {
  if (pointInGeometry(lat, lng, geometry)) return 0;
  const latRadians = (lat * Math.PI) / 180;
  const xScale = METERS_PER_DEGREE * Math.cos(latRadians);
  let minDistance = Infinity;
  for (const polygon of polygonRings(geometry)) {
    for (const ring of polygon) {
      for (let index = 0; index < ring.length; index += 1) {
        const start = ring[index];
        const end = ring[(index + 1) % ring.length];
        const ax = (start[0] - lng) * xScale;
        const ay = (start[1] - lat) * METERS_PER_DEGREE;
        const bx = (end[0] - lng) * xScale;
        const by = (end[1] - lat) * METERS_PER_DEGREE;
        const dx = bx - ax;
        const dy = by - ay;
        const lengthSquared = dx * dx + dy * dy;
        const ratio = lengthSquared ? Math.max(0, Math.min(1, -(ax * dx + ay * dy) / lengthSquared)) : 0;
        minDistance = Math.min(minDistance, Math.hypot(ax + ratio * dx, ay + ratio * dy));
      }
    }
  }
  return minDistance;
}

// ตรวจว่าพิกัดอยู่ในแปลง GISTDA ที่เคยพบพื้นที่น้ำท่วมหรือไม่
// POST เพื่อไม่ใส่พิกัดส่วนบุคคลไว้ใน URL หรือ access log
export async function POST(request) {
  const limited = await enforceIpRateLimit(request, "floodFreqPoint", { store: "memory" });
  if (limited) return limited;

  const body = await request.json().catch(() => ({}));
  const lat = Number(body?.lat);
  const lng = Number(body?.lng);
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) {
    return NextResponse.json({ success: false, message: "พิกัดไม่ถูกต้อง" }, { status: 400 });
  }

  try {
    const data = await getFloodFreqData();
    const latRadius = NEARBY_RADIUS_M / METERS_PER_DEGREE;
    const lngRadius = latRadius / Math.max(0.1, Math.cos((lat * Math.PI) / 180));
    const nearby = (data.geojson?.features || []).flatMap((feature) => {
      const bounds = geometryBounds(feature.geometry);
      if (lng < bounds[0] - lngRadius || lng > bounds[2] + lngRadius || lat < bounds[1] - latRadius || lat > bounds[3] + latRadius) return [];
      const distance = distanceToGeometryMeters(lat, lng, feature.geometry);
      if (distance > NEARBY_RADIUS_M) return [];
      const properties = feature.properties || {};
      return [{
        frequency: Number(properties.freq || 0),
        years: properties.years || [],
        distance_m: Math.round(distance),
        distance_exact_m: distance,
        district: properties.district || null,
        tambon: properties.tambon || null
      }];
    }).sort((a, b) => a.distance_exact_m - b.distance_exact_m || b.frequency - a.frequency);
    const exact = nearby.filter((area) => area.distance_exact_m === 0);
    const strongest = [...exact].sort((a, b) => b.frequency - a.frequency)[0] || null;
    const nearbyAreas = nearby.slice(0, MAX_NEARBY_AREAS).map(({ distance_exact_m, ...area }) => area);
    return NextResponse.json({
      success: true,
      source: "GISTDA (สทอภ.)",
      period: `พ.ศ. ${thaiYear(FLOOD_FREQ_YEARS.from)}–${thaiYear(FLOOD_FREQ_YEARS.to)}`,
      years_count: FLOOD_FREQ_TOTAL_YEARS,
      nearby_radius_m: NEARBY_RADIUS_M,
      fetched_at: data.fetched_at,
      source_updated_at: data.source_updated_at,
      data: strongest ? {
        found: true,
        frequency: strongest.frequency,
        years: strongest.years,
        matching_patches: exact.length
      } : { found: false, frequency: 0, years: [], matching_patches: 0 },
      nearby_areas: nearbyAreas
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("GISTDA flood frequency point lookup error:", error?.message || error);
    return publicInternalError("ตรวจสอบประวัติน้ำท่วมจาก GISTDA ไม่สำเร็จ");
  }
}
