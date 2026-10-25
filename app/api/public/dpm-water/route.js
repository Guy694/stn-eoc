import { NextResponse } from "next/server";
import { getDpmCanalStations, loadDpmSparklines } from "@/lib/dpmCanalsServer";
import { DDPM_CCTV_CREDIT, DDPM_CCTV_ORIGIN } from "@/lib/ddpmCctv";
import { getSatunWaterLevels } from "@/lib/thaiWaterClient";

// ระดับน้ำสถานี ปภ. ในสตูล พร้อมสถานะตามเกณฑ์ของ ปภ. (หน้าแรก "น้ำในคลองตอนนี้" และป๊อปอัปกล้อง CCTV)
// ?history=1 → เพิ่มระดับน้ำรายชั่วโมง 24 ชม.ล่าสุด
export const dynamic = "force-dynamic";

const THAIWATER_NEARBY_MAX_KM = 3;
const normalizeArea = (value) => String(value || "").replace(/^อ(?:\.|ำเภอ)\s*/, "").replace(/\s+/g, "").trim();
function distanceKm(a, b) {
  const rad = (degree) => degree * Math.PI / 180;
  const dLat = rad(Number(b.lat) - Number(a.lat));
  const dLng = rad(Number(b.lng) - Number(a.lng));
  const haversine = Math.sin(dLat / 2) ** 2 + Math.cos(rad(Number(a.lat))) * Math.cos(rad(Number(b.lat))) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

function attachNearbyThaiWater(stations, thaiWaterStations) {
  return stations.map((station) => {
    const nearby = (thaiWaterStations || [])
      .filter((candidate) => normalizeArea(candidate.amphoe) === normalizeArea(station.amphoe))
      .map((candidate) => ({ station: candidate, distance: distanceKm(station, candidate) }))
      .filter((item) => Number.isFinite(item.distance) && item.distance <= THAIWATER_NEARBY_MAX_KM)
      .sort((a, b) => a.distance - b.distance)[0];
    return { ...station, nearbyThaiWater: nearby ? { ...nearby.station, distanceKm: Number(nearby.distance.toFixed(1)) } : null };
  });
}

export async function GET(request) {
  try {
    const [{ stations: dpmStations, fetchedAt, stale }, thaiWater] = await Promise.all([
      getDpmCanalStations(),
      getSatunWaterLevels().catch(() => ({ stations: [] }))
    ]);
    const stations = attachNearbyThaiWater(dpmStations, thaiWater.stations || []);
    const history = new URL(request.url).searchParams.get("history") === "1" ? await loadDpmSparklines(24).catch(() => ({})) : undefined;
    return NextResponse.json(
      { success: true, stations, fetchedAt: new Date(fetchedAt).toISOString(), stale, ...(history ? { history } : {}), source: DDPM_CCTV_CREDIT, sourceUrl: DDPM_CCTV_ORIGIN },
      { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("DPM water API error:", error?.message || error);
    return NextResponse.json({ success: false, message: "ยังดึงข้อมูลระดับน้ำจาก ปภ. ไม่ได้ในขณะนี้", source: DDPM_CCTV_CREDIT }, { status: 503 });
  }
}
