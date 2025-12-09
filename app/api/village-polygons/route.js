import fs from 'fs';
import path from 'path';
import { NextResponse } from 'next/server';

// ฟังก์ชันแปลง coordinate string เป็น polygon coordinates
function parsePolygonCoordinates(coordString) {
    const coords = coordString.split(',');
    const points = [];

    for (let i = 0; i < coords.length; i += 2) {
        if (i + 1 < coords.length) {
            const lon = parseFloat(coords[i].trim());
            const lat = parseFloat(coords[i + 1].trim());
            if (!isNaN(lon) && !isNaN(lat)) {
                points.push([lat, lon]); // Leaflet ใช้ [lat, lon]
            }
        }
    }

    return points;
}

export async function GET() {
    try {
        const csvPath = path.join(process.cwd(), 'satun_village.csv');
        const fileContent = fs.readFileSync(csvPath, 'utf-8');
        const lines = fileContent.split('\n');

        const polygons = [];

        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            if (!line) continue;

            // แยก CSV โดยคำนึงถึง quote
            const parts = [];
            let current = '';
            let inQuotes = false;

            for (let char of line) {
                if (char === '"') {
                    inQuotes = !inQuotes;
                } else if (char === ',' && !inQuotes) {
                    parts.push(current);
                    current = '';
                } else {
                    current += char;
                }
            }
            parts.push(current);

            if (parts.length < 21) continue;

            const coordString = parts[4].replace(/"/g, '');
            const coordinates = parsePolygonCoordinates(coordString);

            if (coordinates.length > 0) {
                polygons.push({
                    id: i,
                    fid: parseInt(parts[5]) || 0,
                    villname: parts[19] || 'ไม่ระบุ',
                    subdistnam: parts[13] || 'ไม่ระบุ',
                    distname: parts[11] || 'ไม่ระบุ',
                    provname: parts[16] || 'สตูล',
                    num_hh: parseInt(parts[8]) || 0,
                    num_build: parseInt(parts[9]) || 0,
                    area_type: parseInt(parts[14]) || 0,
                    mun_tao_na: parts[17] || '',
                    regname: parts[7] || '',
                    coordinates: coordinates
                });
            }
        }

        return NextResponse.json(polygons);
    } catch (error) {
        console.error('Error loading village polygons:', error);
        return NextResponse.json(
            { error: 'Failed to load village data' },
            { status: 500 }
        );
    }
}
