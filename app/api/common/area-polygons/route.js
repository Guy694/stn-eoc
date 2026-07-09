import { NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import path from 'path';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

function parseGeoJsonValue(value) {
    if (!value) return null;

    if (Buffer.isBuffer(value)) {
        const text = value.toString('utf8');
        return text ? JSON.parse(text) : null;
    }

    if (typeof value === 'string') {
        return JSON.parse(value);
    }

    return value;
}

function collectCoordinatePairs(coordinates, pairs = []) {
    if (!Array.isArray(coordinates)) return pairs;

    if (
        coordinates.length >= 2
        && typeof coordinates[0] === 'number'
        && typeof coordinates[1] === 'number'
    ) {
        pairs.push(coordinates);
        return pairs;
    }

    coordinates.forEach((item) => collectCoordinatePairs(item, pairs));
    return pairs;
}

function getGeoJsonCenter(geometry) {
    const pairs = collectCoordinatePairs(geometry?.coordinates);
    if (pairs.length === 0) return { center_lat: null, center_lng: null };

    const bounds = pairs.reduce((acc, [lng, lat]) => ({
        minLng: Math.min(acc.minLng, lng),
        maxLng: Math.max(acc.maxLng, lng),
        minLat: Math.min(acc.minLat, lat),
        maxLat: Math.max(acc.maxLat, lat)
    }), {
        minLng: Number.POSITIVE_INFINITY,
        maxLng: Number.NEGATIVE_INFINITY,
        minLat: Number.POSITIVE_INFINITY,
        maxLat: Number.NEGATIVE_INFINITY
    });

    return {
        center_lat: (bounds.minLat + bounds.maxLat) / 2,
        center_lng: (bounds.minLng + bounds.maxLng) / 2
    };
}

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
                    moo,
                    subdistnam as tambon_name,
                    distname as district_name,
                    villcode as code,
                    ST_AsGeoJSON(geom) as geojson
                FROM satun_village_polygon
                ORDER BY distname, subdistnam, CAST(moo AS UNSIGNED), villname
            `;
            const results = await query(sql);
            data = results.map(row => {
                let geojson = null;
                if (row.geojson) {
                    try {
                        geojson = parseGeoJsonValue(row.geojson);
                    } catch (e) {
                        console.error('Error parsing village geojson:', e);
                    }
                }
                const center = getGeoJsonCenter(geojson);
                return {
                    id: row.id,
                    name: row.name,
                    moo: row.moo,
                    tambon_name: row.tambon_name,
                    district_name: row.district_name,
                    code: row.code,
                    type: 'village',
                    geojson: geojson,
                    center_lat: center.center_lat,
                    center_lng: center.center_lng
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
