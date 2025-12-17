import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        // ดึงข้อมูล polygon จาก database
        const sql = `
            SELECT 
                villcode,
                villname,
                subdistnam,
                distname,
                num_hh,
                ST_AsGeoJSON(geom) as geojson
            FROM satun_village_polygon
            ORDER BY distname, subdistnam, villname
        `;

        const results = await query(sql);

        // แปลง GeoJSON string เป็น object และดึง coordinates
        const polygons = results.map((row, index) => {
            const geoJson = JSON.parse(row.geojson);

            // แปลง coordinates จาก GeoJSON format
            let coordinates = [];
            if (geoJson.type === 'Polygon') {
                // Polygon มี array ของ rings, เราใช้ ring แรก (outer ring)
                coordinates = geoJson.coordinates[0].map(coord => [coord[1], coord[0]]); // swap lng,lat to lat,lng
            } else if (geoJson.type === 'MultiPolygon') {
                // MultiPolygon ใช้ polygon แรก
                coordinates = geoJson.coordinates[0][0].map(coord => [coord[1], coord[0]]);
            }

            // สร้าง unique id จาก villcode และ index เพื่อป้องกัน duplicate
            const uniqueId = `${row.villcode || 'unknown'}-${index}`;

            return {
                id: uniqueId,
                villcode: row.villcode,
                villname: row.villname,
                subdistnam: row.subdistnam,
                distname: row.distname,
                num_hh: row.num_hh || 0,
                coordinates: coordinates
            };
        });

        return NextResponse.json(polygons);

    } catch (error) {
        console.error('Error fetching village polygons:', error);
        return NextResponse.json(
            { error: 'Failed to fetch village polygons', details: error.message },
            { status: 500 }
        );
    }
}
