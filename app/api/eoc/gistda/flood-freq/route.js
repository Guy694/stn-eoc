import { NextResponse } from 'next/server';
import { publicInternalError } from '@/lib/apiResponse';

const GISTDA_API_BASE = 'https://api-gateway.gistda.or.th/api/2.0';
const GISTDA_API_KEY = process.env.GISTDA_API_KEY || '';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const offset = searchParams.get('offset') || '0';
        const limit = searchParams.get('limit') || '100';

        // Mock data สำหรับกรณีที่ไม่มี API key หรือ API ไม่ตอบสนอง
        const mockData = {
            type: "FeatureCollection",
            features: [
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [100.0673, 6.6238],
                            [100.0673, 6.7238],
                            [100.1673, 6.7238],
                            [100.1673, 6.6238],
                            [100.0673, 6.6238]
                        ]]
                    },
                    properties: {
                        province: "สตูล",
                        district: "เมืองสตูล",
                        tambon: "พิมาน",
                        frequency: 5,
                        frequency_level: "สูง",
                        last_flood_year: 2024,
                        description: "พื้นที่อุทกภัยน้ำท่วมซ้ำซาก ประมาณ 5 ครั้งใน 10 ปี"
                    }
                },
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [100.0873, 6.6438],
                            [100.0873, 6.7438],
                            [100.1873, 6.7438],
                            [100.1873, 6.6438],
                            [100.0873, 6.6438]
                        ]]
                    },
                    properties: {
                        province: "สตูล",
                        district: "เมืองสตูล",
                        tambon: "คลองขุด",
                        frequency: 3,
                        frequency_level: "ปานกลาง",
                        last_flood_year: 2024,
                        description: "พื้นที่อุทกภัยน้ำท่วมซ้ำซาก ประมาณ 3 ครั้งใน 10 ปี"
                    }
                },
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[
                            [99.9873, 6.5938],
                            [99.9873, 6.6938],
                            [100.0873, 6.6938],
                            [100.0873, 6.5938],
                            [99.9873, 6.5938]
                        ]]
                    },
                    properties: {
                        province: "สตูล",
                        district: "ละงู",
                        tambon: "กำแพง",
                        frequency: 7,
                        frequency_level: "สูงมาก",
                        last_flood_year: 2024,
                        description: "พื้นที่อุทกภัยน้ำท่วมซ้ำซาก ประมาณ 7 ครั้งใน 10 ปี"
                    }
                }
            ]
        };

        // ถ้ามี API key ให้ลองเรียก API จริง
        if (GISTDA_API_KEY) {
            try {
                const apiUrl = `${GISTDA_API_BASE}/resources/features/flood-freq?offset=${offset}&limit=${limit}`;

                const response = await fetch(apiUrl, {
                    headers: {
                        'Authorization': `Bearer ${GISTDA_API_KEY}`,
                        'Accept': 'application/json'
                    },
                    next: { revalidate: 3600 } // Cache 1 hour
                });

                if (response.ok) {
                    const data = await response.json();
                    return NextResponse.json({
                        success: true,
                        data: data,
                        source: 'gistda'
                    });
                }
            } catch {
            }
        }

        // Return mock data
        return NextResponse.json({
            success: true,
            data: mockData,
            useMockData: true,
            source: 'mock'
        });

    } catch (error) {
        console.error('Error fetching flood frequency data:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่อุทกภัยน้ำท่วมซ้ำซาก');
    }
}
