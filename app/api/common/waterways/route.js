import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const SATUN_BBOX = {
    south: 6.25,
    west: 99.45,
    north: 7.2,
    east: 100.35
};
const WATERWAY_TYPES = 'river|stream|canal|drain|ditch';
const CACHE_MS = 6 * 60 * 60 * 1000;
const OVERPASS_ENDPOINTS = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter'
];

let cachedPayload = null;
let cachedAt = 0;

function buildOverpassQuery() {
    const { south, west, north, east } = SATUN_BBOX;
    return `[out:json][timeout:25];(way["waterway"~"${WATERWAY_TYPES}"](${south},${west},${north},${east}););out body;>;out skel qt;`;
}

function wayTypeLabel(type) {
    return {
        river: 'แม่น้ำ',
        stream: 'ลำธาร',
        canal: 'คลอง',
        drain: 'ทางระบายน้ำ',
        ditch: 'คูน้ำ'
    }[type] || 'เส้นทางน้ำ';
}

function transformOverpassToGeoJson(payload) {
    const nodeMap = new Map();
    const ways = [];

    for (const element of payload.elements || []) {
        if (element.type === 'node') {
            nodeMap.set(element.id, [element.lon, element.lat]);
        } else if (element.type === 'way' && element.tags?.waterway) {
            ways.push(element);
        }
    }

    const features = ways
        .map((way) => {
            const coordinates = (way.nodes || [])
                .map((nodeId) => nodeMap.get(nodeId))
                .filter(Boolean);
            if (coordinates.length < 2) return null;

            return {
                type: 'Feature',
                properties: {
                    id: way.id,
                    name: way.tags?.name || way.tags?.['name:th'] || '',
                    waterway: way.tags?.waterway || 'waterway',
                    label: wayTypeLabel(way.tags?.waterway),
                    intermittent: way.tags?.intermittent === 'yes',
                    source: 'OpenStreetMap'
                },
                geometry: {
                    type: 'LineString',
                    coordinates
                }
            };
        })
        .filter(Boolean);

    return {
        type: 'FeatureCollection',
        features
    };
}

async function fetchOverpassData() {
    const query = buildOverpassQuery();
    let lastError = null;

    for (const endpoint of OVERPASS_ENDPOINTS) {
        try {
            const url = new URL(endpoint);
            url.searchParams.set('data', query);
            const response = await fetch(url, {
                headers: {
                    Accept: 'application/json',
                    'User-Agent': 'stn-eoc/1.0 waterways-layer'
                },
                cache: 'no-store'
            });

            if (!response.ok) {
                throw new Error(`Overpass ${response.status}`);
            }

            return {
                sourceEndpoint: endpoint,
                payload: await response.json()
            };
        } catch (error) {
            lastError = error;
        }
    }

    throw lastError || new Error('Overpass request failed');
}

export async function GET() {
    try {
        const now = Date.now();
        if (cachedPayload && now - cachedAt < CACHE_MS) {
            return NextResponse.json(cachedPayload, {
                headers: { 'Cache-Control': 'public, max-age=3600' }
            });
        }

        const { sourceEndpoint, payload } = await fetchOverpassData();
        const geojson = transformOverpassToGeoJson(payload);
        cachedPayload = {
            success: true,
            data: geojson,
            count: geojson.features.length,
            bbox: SATUN_BBOX,
            source: 'OpenStreetMap Overpass API',
            source_endpoint: sourceEndpoint,
            fetched_at: new Date(now).toISOString()
        };
        cachedAt = now;

        return NextResponse.json(cachedPayload, {
            headers: { 'Cache-Control': 'public, max-age=3600' }
        });
    } catch (error) {
        console.error('Error fetching waterways:', error);
        return NextResponse.json(
            {
                success: false,
                error: 'ไม่สามารถโหลดข้อมูลเส้นทางน้ำได้',
                data: { type: 'FeatureCollection', features: [] }
            },
            { status: 502 }
        );
    }
}
