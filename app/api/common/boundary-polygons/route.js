import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const level = searchParams.get('level') || 'tambon'; // province, district, tambon

        let sql;
        let results;

        switch (level) {
            case 'province':
                // รวม polygon ทั้งหมดของจังหวัด
                sql = `
                    SELECT 
                        'สตูล' as name,
                        ST_AsGeoJSON(ST_Union(geom)) as geometry
                    FROM satun_village_polygon
                    WHERE provname = 'สตูล'
                `;
                results = await query(sql);
                break;

            case 'district':
                // รวม polygon แยกตามอำเภอ
                sql = `
                    SELECT 
                        distname as name,
                        ST_AsGeoJSON(ST_Union(geom)) as geometry
                    FROM satun_village_polygon
                    WHERE provname = 'สตูล'
                    GROUP BY distname
                `;
                results = await query(sql);
                break;

            case 'tambon':
            default:
                // แสดง polygon แยกตามตำบล (ทั้งหมด)
                sql = `
                    SELECT 
                        id,
                        area_name as name,
                        distname,
                        subdistnam,
                        villname,
                        ST_AsGeoJSON(geom) as geometry
                    FROM satun_village_polygon
                    ORDER BY distname, subdistnam, villname
                `;
                results = await query(sql);
                break;
        }

        // แปลง geometry string เป็น JSON object
        const polygons = results.map(row => ({
            ...row,
            geometry: row.geometry ? JSON.parse(row.geometry) : null
        }));

        return Response.json({
            success: true,
            level,
            count: polygons.length,
            data: polygons
        });

    } catch (error) {
        console.error('Error fetching boundary polygons:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลขอบเขต');
    }
}
