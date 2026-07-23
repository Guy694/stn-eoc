import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

function parseGeometry(value) {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
    if (typeof value === "string") return JSON.parse(value);
    return value;
}

function collectPairs(coordinates, pairs = []) {
    if (!Array.isArray(coordinates)) return pairs;
    if (coordinates.length >= 2 && typeof coordinates[0] === "number" && typeof coordinates[1] === "number") {
        pairs.push(coordinates);
        return pairs;
    }
    coordinates.forEach((item) => collectPairs(item, pairs));
    return pairs;
}

function centerOf(geometry) {
    const pairs = collectPairs(geometry?.coordinates);
    if (!pairs.length) return { center_lat: null, center_lng: null };
    const totals = pairs.reduce((sum, [lng, lat]) => ({ lat: sum.lat + lat, lng: sum.lng + lng }), { lat: 0, lng: 0 });
    return { center_lat: totals.lat / pairs.length, center_lng: totals.lng / pairs.length };
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const level = searchParams.get("level") || "village";
        if (!["village", "tambon", "district"].includes(level)) {
            return NextResponse.json({ success: false, message: "ระดับพื้นที่ไม่ถูกต้อง" }, { status: 400 });
        }

        let rows;
        if (level === "district") {
            rows = await query(`
                SELECT MIN(id) AS id, distname AS name, distname AS district_name,
                       COUNT(*) AS village_count,
                       ST_AsGeoJSON(ST_Collect(
                           ST_SwapXY(ST_GeomFromWKB(ST_AsWKB(geom), 0))
                       )) AS geojson
                FROM satun_village_polygon
                WHERE geom IS NOT NULL
                GROUP BY distname
                ORDER BY distname
            `);
        } else if (level === "tambon") {
            rows = await query(`
                SELECT MIN(id) AS id, subdistnam AS name, subdistnam AS tambon_name,
                       distname AS district_name, COUNT(*) AS village_count,
                       ST_AsGeoJSON(ST_Collect(
                           ST_SwapXY(ST_GeomFromWKB(ST_AsWKB(geom), 0))
                       )) AS geojson
                FROM satun_village_polygon
                WHERE geom IS NOT NULL
                GROUP BY distname, subdistnam
                ORDER BY distname, subdistnam
            `);
        } else {
            rows = await query(`
                SELECT id, villname AS name, moo, subdistnam AS tambon_name,
                       distname AS district_name, villcode AS code,
                       ST_AsGeoJSON(geom) AS geojson
                FROM satun_village_polygon
                ORDER BY distname, subdistnam, CAST(moo AS UNSIGNED), villname
            `);
        }

        const data = rows.map((row) => {
            const geojson = parseGeometry(row.geojson);
            return { ...row, type: level, geojson, ...centerOf(geojson) };
        });
        return NextResponse.json({
            success: true,
            level,
            data,
            total: data.length,
            meta: {
                source_type: "database",
                source_name: "satun_village_polygon",
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Error fetching polygons:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่");
    }
}
