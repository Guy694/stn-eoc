import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

function parseGeoJson(value) {
    if (!value) return null;
    if (Buffer.isBuffer(value)) {
        const text = value.toString('utf8');
        return text ? JSON.parse(text) : null;
    }
    return typeof value === 'string' ? JSON.parse(value) : value;
}

function makeFeatureCollection(rows, nameField = 'name') {
    const groups = new Map();

    rows.forEach((row) => {
        const name = row[nameField] || row.name || '-';
        const geometry = parseGeoJson(row.geometry);
        if (!geometry) return;

        if (!groups.has(name)) {
            groups.set(name, {
                name,
                features: []
            });
        }

        groups.get(name).features.push({
            type: 'Feature',
            properties: {
                name,
                distname: row.distname,
                subdistnam: row.subdistnam,
                villname: row.villname
            },
            geometry
        });
    });

    return [...groups.values()].map((group) => ({
        name: group.name,
        geometry: {
            type: 'FeatureCollection',
            features: group.features
        }
    }));
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const level = searchParams.get('level') || 'tambon'; // province, district, tambon

        let sql;
        let results;
        let polygons;

        switch (level) {
            case 'province':
                sql = `
                    SELECT 
                        'สตูล' as name,
                        pro_name,
                        dis_name,
                        ST_AsGeoJSON(geometry) as geometry
                    FROM districts_polygon
                    WHERE pro_name = 'สตูล'
                    ORDER BY dis_code
                `;
                results = await query(sql);
                polygons = makeFeatureCollection(results);
                break;

            case 'district':
                sql = `
                    SELECT 
                        id,
                        dis_name as name,
                        pro_name,
                        dis_code,
                        pro_code,
                        ST_AsGeoJSON(geometry) as geometry
                    FROM districts_polygon
                    WHERE pro_name = 'สตูล'
                    ORDER BY dis_code
                `;
                results = await query(sql);
                polygons = results.map(row => ({
                    id: row.id,
                    name: row.name,
                    pro_name: row.pro_name,
                    dis_code: row.dis_code,
                    pro_code: row.pro_code,
                    geometry: row.geometry ? parseGeoJson(row.geometry) : null
                }));
                break;

            case 'tambon':
            default:
                sql = `
                    SELECT 
                        id,
                        tam_name as name,
                        tam_name,
                        dis_name,
                        pro_name,
                        tum_code,
                        dis_code,
                        pro_code,
                        ST_AsGeoJSON(geometry) as geometry
                    FROM tambons_polygon
                    WHERE pro_name = 'สตูล'
                    ORDER BY dis_name, tam_name
                `;
                results = await query(sql);
                polygons = results.map(row => ({
                    id: row.id,
                    name: row.name,
                    tam_name: row.tam_name,
                    dis_name: row.dis_name,
                    pro_name: row.pro_name,
                    tum_code: row.tum_code,
                    dis_code: row.dis_code,
                    pro_code: row.pro_code,
                    geometry: row.geometry ? parseGeoJson(row.geometry) : null
                }));
                break;
        }

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
