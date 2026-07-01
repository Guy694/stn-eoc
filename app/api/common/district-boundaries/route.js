import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

// API สำหรับดึงข้อมูลเขตอำเภอ
export async function GET(request) {
    try {
        // Query ข้อมูลหมู่บ้านทั้งหมด
        const sql = `
            SELECT 
                distname,
                ST_AsGeoJSON(geom) as geojson
            FROM satun_village_polygon
            ORDER BY distname
        `;

        const results = await query(sql);

        // รวม polygon ตามอำเภอ
        const districtMap = {};

        results.forEach(row => {
            const distName = row.distname;

            if (!districtMap[distName]) {
                districtMap[distName] = {
                    distname: distName,
                    villages: 0,
                    allCoords: []
                };
            }

            districtMap[distName].villages++;

            // แปลง GeoJSON และเก็บ coordinates
            const geoJson = typeof row.geojson === 'string'
                ? JSON.parse(row.geojson)
                : row.geojson;
            if (geoJson.type === 'Polygon') {
                districtMap[distName].allCoords.push(...geoJson.coordinates[0]);
            }
        });

        // สร้าง boundaries สำหรับแต่ละอำเภอ
        const districtBoundaries = Object.entries(districtMap).map(([key, data]) => {
            // หาศูนย์กลางจาก coordinates ทั้งหมด
            const lats = data.allCoords.map(coord => coord[1]);
            const lngs = data.allCoords.map(coord => coord[0]);
            const centerLat = (Math.min(...lats) + Math.max(...lats)) / 2;
            const centerLng = (Math.min(...lngs) + Math.max(...lngs)) / 2;

            // หา convex hull หรือ bounding polygon อย่างง่าย
            // สำหรับความเรียบง่าย เราจะสร้าง bounding box
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);

            // สร้าง bounding box polygon
            const boundaryGeom = {
                type: 'Polygon',
                coordinates: [[
                    [minLng, minLat],
                    [maxLng, minLat],
                    [maxLng, maxLat],
                    [minLng, maxLat],
                    [minLng, minLat]
                ]]
            };

            return {
                distname: data.distname,
                center_lat: centerLat,
                center_lng: centerLng,
                boundary_geom: JSON.stringify(boundaryGeom),
                villages: data.villages
            };
        });

        return NextResponse.json({
            success: true,
            data: districtBoundaries,
            message: `ดึงข้อมูล ${districtBoundaries.length} อำเภอสำเร็จ`
        });

    } catch (error) {
        console.error('Error in district-boundaries API:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลเขตอำเภอ');
    }
}
