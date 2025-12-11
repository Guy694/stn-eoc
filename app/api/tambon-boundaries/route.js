import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// API สำหรับดึงข้อมูลเขตตำบล
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const district = searchParams.get('district');

        // Query ข้อมูลหมู่บ้านทั้งหมด
        let sql = `
            SELECT 
                villcode,
                subdistnam as tambname,
                distname,
                ST_AsGeoJSON(geom) as geojson
            FROM satun_village_polygon
        `;

        const params = [];
        if (district) {
            sql += ' WHERE distname = ?';
            params.push(district);
        }

        sql += ' ORDER BY distname, subdistnam';

        const results = await query(sql, params);

        // รวม polygon ตามตำบล (ฝั่ง JavaScript)
        const tambonMap = {};

        results.forEach(row => {
            const key = `${row.distname}|${row.tambname}`;

            if (!tambonMap[key]) {
                tambonMap[key] = {
                    tambname: row.tambname,
                    distname: row.distname,
                    villages: 0,
                    allCoords: []
                };
            }

            tambonMap[key].villages++;

            // แปลง GeoJSON และเก็บ coordinates
            const geoJson = JSON.parse(row.geojson);
            if (geoJson.type === 'Polygon') {
                tambonMap[key].allCoords.push(...geoJson.coordinates[0]);
            } else if (geoJson.type === 'MultiPolygon') {
                tambonMap[key].allCoords.push(...geoJson.coordinates[0][0]);
            }
        });

        // สร้าง boundary สำหรับแต่ละตำบล (Convex Hull แบบง่าย)
        const boundaries = Object.values(tambonMap).map((tambon, index) => {
            // หา min/max lat/lon เพื่อสร้าง bounding box
            const lats = tambon.allCoords.map(c => c[1]);
            const lons = tambon.allCoords.map(c => c[0]);

            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLon = Math.min(...lons);
            const maxLon = Math.max(...lons);

            // สร้าง bounding box coordinates (swap to lat,lon for Leaflet)
            const coordinates = [
                [minLat, minLon],
                [maxLat, minLon],
                [maxLat, maxLon],
                [minLat, maxLon],
                [minLat, minLon]
            ];

            return {
                id: index + 1,
                tambname: tambon.tambname,
                distname: tambon.distname,
                villages: tambon.villages,
                coordinates: coordinates
            };
        });

        return NextResponse.json({
            success: true,
            data: boundaries,
            total: boundaries.length
        });

    } catch (error) {
        console.error('Error fetching tambon boundaries:', error);
        return NextResponse.json(
            { error: 'Failed to fetch tambon boundaries', details: error.message },
            { status: 500 }
        );
    }
}