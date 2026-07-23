import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

function parseGeometry(value) {
    if (!value) return null;
    if (Buffer.isBuffer(value)) return JSON.parse(value.toString("utf8"));
    if (typeof value === "string") return JSON.parse(value);
    return value;
}

function leafletCoordinates(geometry) {
    const source = geometry?.type === "MultiPolygon"
        ? geometry.coordinates?.[0]?.[0]
        : geometry?.coordinates?.[0];
    return Array.isArray(source) ? source.map(([lng, lat]) => [lat, lng]) : [];
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const district = searchParams.get("district");
        const params = [];
        let districtFilter = "";
        if (district) {
            districtFilter = " AND distname = ?";
            params.push(district);
        }

        const rows = await query(`
            SELECT MIN(id) AS id, subdistnam AS tambname, distname,
                   COUNT(*) AS villages,
                   ST_AsGeoJSON(ST_Collect(
                       ST_SwapXY(ST_GeomFromWKB(ST_AsWKB(geom), 0))
                   )) AS geojson
            FROM satun_village_polygon
            WHERE geom IS NOT NULL ${districtFilter}
            GROUP BY distname, subdistnam
            ORDER BY distname, subdistnam
        `, params);

        const data = rows.map((row) => {
            const geometry = parseGeometry(row.geojson);
            const coordinates = leafletCoordinates(geometry);
            const center = coordinates.length
                ? coordinates.reduce((sum, [lat, lng]) => ({ lat: sum.lat + lat, lng: sum.lng + lng }), { lat: 0, lng: 0 })
                : null;
            return {
                id: row.id,
                tambname: row.tambname,
                subdistnam: row.tambname,
                distname: row.distname,
                villages: Number(row.villages || 0),
                coordinates,
                geojson: geometry,
                center_lat: center ? center.lat / coordinates.length : null,
                center_lng: center ? center.lng / coordinates.length : null
            };
        });

        return NextResponse.json({
            success: true,
            data,
            total: data.length,
            meta: {
                source_type: "database",
                source_name: "satun_village_polygon",
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Error fetching tambon boundaries:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูลเขตตำบล");
    }
}
