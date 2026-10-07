import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { publicInternalError } from "@/lib/apiResponse";

// ค้นหาสถานที่ในจังหวัดสตูลเพื่อปักหมุด (หน้ารายงานระดับน้ำ) — หมู่บ้าน สถานพยาบาล ศูนย์พักพิง
// คืนเฉพาะชื่อสถานที่สาธารณะและพิกัด ไม่มีข้อมูลบุคคล
const LIMIT_PER_KIND = 6;

function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

export async function GET(request) {
  const rateLimited = await enforceIpRateLimit(request, "placeSearch");
  if (rateLimited) return rateLimited;

  const q = String(new URL(request.url).searchParams.get("q") || "").trim().slice(0, 60);
  if (q.length < 2) return NextResponse.json({ success: true, data: [] });

  try {
    const pool = await getConnection();
    const like = `%${q}%`;
    const [villages, facilities, shelters] = await Promise.all([
      pool.execute(
        `SELECT villname AS name, moo, subdistnam AS tambon, distname AS district,
                ST_Y(ST_Centroid(ST_SRID(geom, 0))) AS lat, ST_X(ST_Centroid(ST_SRID(geom, 0))) AS lng
         FROM satun_village_polygon
         WHERE villname LIKE ? OR subdistnam LIKE ?
         ORDER BY (villname LIKE ?) DESC, villname, CAST(moo AS UNSIGNED)
         LIMIT ${LIMIT_PER_KIND}`,
        [like, like, like]
      ).then(([rows]) => rows).catch(() => []),
      pool.execute(
        `SELECT name, tambon, district_name AS district, lat, lon AS lng
         FROM health_facilities
         WHERE is_active = 1 AND name LIKE ?
         ORDER BY name LIMIT ${LIMIT_PER_KIND}`,
        [like]
      ).then(([rows]) => rows).catch(() => []),
      pool.execute(
        `SELECT sheltername AS name, tambon, district_name AS district, lat, lon AS lng
         FROM shelter_centers
         WHERE is_active = 1 AND lat IS NOT NULL AND lon IS NOT NULL AND sheltername LIKE ?
         ORDER BY sheltername LIMIT ${LIMIT_PER_KIND}`,
        [like]
      ).then(([rows]) => rows).catch(() => [])
    ]);

    const data = [
      ...villages.map((row) => ({ kind: "village", name: `${row.name}${row.moo ? ` ม.${row.moo}` : ""}`, village: row.name, tambon: row.tambon, district: row.district, lat: toNumber(row.lat), lng: toNumber(row.lng) })),
      ...facilities.map((row) => ({ kind: "health", name: row.name, tambon: row.tambon, district: row.district, lat: toNumber(row.lat), lng: toNumber(row.lng) })),
      ...shelters.map((row) => ({ kind: "shelter", name: row.name, tambon: row.tambon, district: row.district, lat: toNumber(row.lat), lng: toNumber(row.lng) }))
    ].filter((item) => item.lat !== null && item.lng !== null);

    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error("Place search error:", error);
    return publicInternalError("ค้นหาสถานที่ไม่สำเร็จ");
  }
}
