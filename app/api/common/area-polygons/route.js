import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

async function loadGeoJson(filename) {
    const filePath = path.join(process.cwd(), filename);
    const text = await readFile(filePath, 'utf8');
    return JSON.parse(text);
}

// API สำหรับดึง polygon ตามระดับ (village, tambon, district)
// ใช้ satun_village_polygon เป็น source หลัก และรวม polygon ด้วย ST_Union
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const level = searchParams.get('level') || 'village';

        let sql = '';
        let data = [];

        if (level === 'district') {
            const districts = await loadGeoJson('ampure.geojson');
            data = (districts.features || []).map((feature, index) => ({
                id: index + 1,
                name: feature.properties?.dis_name || '',
                code: feature.properties?.dis_code || '',
                type: 'district',
                geojson: feature.geometry
            }));
        } else if (level === 'tambon') {
            const tambons = await loadGeoJson('tambonnn.geojson');
            data = (tambons.features || []).map((feature, index) => ({
                id: index + 1,
                name: feature.properties?.tam_name || '',
                district_name: feature.properties?.dis_name || '',
                code: feature.properties?.tum_code || '',
                type: 'tambon',
                geojson: feature.geometry
            }));
        } else {
            // ดึงจาก satun_village_polygon (default: village)
            sql = `
                SELECT 
                    id,
                    villname as name,
                    subdistnam as tambon_name,
                    distname as district_name,
                    villcode as code,
                    ST_AsGeoJSON(geom) as geojson,
                    ST_Y(ST_Centroid(ST_SRID(geom, 0))) as center_lat,
                    ST_X(ST_Centroid(ST_SRID(geom, 0))) as center_lng
                FROM satun_village_polygon
                ORDER BY distname, subdistnam, villname
            `;
            const results = await query(sql);
            data = results.map(row => {
                let geojson = null;
                if (row.geojson) {
                    try {
                        geojson = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
                    } catch (e) {
                        console.error('Error parsing village geojson:', e);
                    }
                }
                return {
                    id: row.id,
                    name: row.name,
                    tambon_name: row.tambon_name,
                    district_name: row.district_name,
                    code: row.code,
                    type: 'village',
                    geojson: geojson,
                    center_lat: row.center_lat,
                    center_lng: row.center_lng
                };
            });
        }

        return NextResponse.json({
            success: true,
            level: level,
            data: data,
            total: data.length
        });

    } catch (error) {
        console.error('Error fetching polygons:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่');
    }
}
