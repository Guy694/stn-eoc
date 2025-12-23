import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

export async function GET() {
    try {
        // ดึงข้อมูล polygon จาก database
        const sql = `
            SELECT 
                id,
                villcode,
                villname,
                subdistnam,
                distname,
                provname,
                num_hh,
                num_build,
                mun_tao_na,
                ST_AsGeoJSON(geom) as geojson
            FROM satun_village_polygon
            ORDER BY distname, subdistnam, villname
        `;

        const results = await query(sql);

        // แปลง GeoJSON string เป็น object และดึง coordinates
        const polygons = results.map((row) => {
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

            return {
                id: row.id, // ใช้ id จริงจาก database
                villcode: row.villcode,
                villname: row.villname,
                subdistnam: row.subdistnam,
                distname: row.distname,
                provname: row.provname || 'สตูล',
                num_hh: row.num_hh || 0,
                num_build: row.num_build || 0,
                mun_tao_na: row.mun_tao_na || '',
                coordinates: coordinates,
                geom: row.geojson // เก็บ GeoJSON ไว้สำหรับใช้งานอื่น
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
