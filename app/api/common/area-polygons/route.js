import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

// API สำหรับดึง polygon ตามระดับ (village, tambon, district)
// ใช้ satun_village_polygon เป็น source หลัก และรวม polygon ด้วย ST_Union
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const level = searchParams.get('level') || 'village';

        let sql = '';
        let data = [];

        if (level === 'district') {
            // ดึง polygon ของทุกหมู่บ้านในแต่ละอำเภอ (MariaDB ไม่รองรับ ST_Union aggregate)
            sql = `
                SELECT 
                    id,
                    villname,
                    distname as name,
                    LEFT(villcode, 4) as code,
                    ST_AsGeoJSON(geom) as geojson
                FROM satun_village_polygon
                ORDER BY distname, villname
            `;
            const results = await query(sql);

            // จัดกลุ่ม polygon ตามอำเภอ
            const districtMap = new Map();
            results.forEach(row => {
                const distName = row.name;
                if (!districtMap.has(distName)) {
                    districtMap.set(distName, {
                        id: row.id,
                        name: distName,
                        code: row.code,
                        type: 'district',
                        polygons: []
                    });
                }
                if (row.geojson) {
                    try {
                        const geojson = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
                        districtMap.get(distName).polygons.push(geojson);
                    } catch (e) {
                        console.error('Error parsing district geojson:', e);
                    }
                }
            });

            // แปลง Map เป็น array และสร้าง MultiPolygon/GeometryCollection
            data = Array.from(districtMap.values()).map(dist => {
                let geojson = null;
                if (dist.polygons.length === 1) {
                    geojson = dist.polygons[0];
                } else if (dist.polygons.length > 1) {
                    // รวมเป็น GeometryCollection
                    geojson = {
                        type: 'GeometryCollection',
                        geometries: dist.polygons
                    };
                }
                return {
                    id: dist.id,
                    name: dist.name,
                    code: dist.code,
                    type: 'district',
                    geojson: geojson
                };
            });
        } else if (level === 'tambon') {
            // ดึง polygon ของทุกหมู่บ้านในแต่ละตำบล (MariaDB ไม่รองรับ ST_Union aggregate)
            sql = `
                SELECT 
                    id,
                    villname,
                    subdistnam as name,
                    distname as district_name,
                    LEFT(villcode, 6) as code,
                    ST_AsGeoJSON(geom) as geojson
                FROM satun_village_polygon
                ORDER BY distname, subdistnam, villname
            `;
            const results = await query(sql);

            // จัดกลุ่ม polygon ตามตำบล
            const tambonMap = new Map();
            results.forEach(row => {
                const key = `${row.district_name}-${row.name}`;
                if (!tambonMap.has(key)) {
                    tambonMap.set(key, {
                        id: row.id,
                        name: row.name,
                        district_name: row.district_name,
                        code: row.code,
                        type: 'tambon',
                        polygons: []
                    });
                }
                if (row.geojson) {
                    try {
                        const geojson = typeof row.geojson === 'string' ? JSON.parse(row.geojson) : row.geojson;
                        tambonMap.get(key).polygons.push(geojson);
                    } catch (e) {
                        console.error('Error parsing tambon geojson:', e);
                    }
                }
            });

            // แปลง Map เป็น array และสร้าง MultiPolygon/GeometryCollection
            data = Array.from(tambonMap.values()).map(tambon => {
                let geojson = null;
                if (tambon.polygons.length === 1) {
                    geojson = tambon.polygons[0];
                } else if (tambon.polygons.length > 1) {
                    // รวมเป็น GeometryCollection
                    geojson = {
                        type: 'GeometryCollection',
                        geometries: tambon.polygons
                    };
                }
                return {
                    id: tambon.id,
                    name: tambon.name,
                    district_name: tambon.district_name,
                    code: tambon.code,
                    type: 'tambon',
                    geojson: geojson
                };
            });
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
