import { NextResponse } from 'next/server';

// API Proxy สำหรับดึงข้อมูลน้ำท่วมจาก GISTDA
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = searchParams.get('days') || '30';
        const limit = searchParams.get('limit') || '1000';
        const offset = searchParams.get('offset') || '0';

        // สร้าง URL สำหรับเรียก GISTDA API
        const gistdaUrl = `https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/${days}days?limit=${limit}&offset=${offset}&pv_idn=91`;

        // ถ้ามี API Key ให้เพิ่ม header
        const headers = {
            'accept': 'application/json',
            'Content-Type': 'application/json'
        };

        // ถ้ามี API Key ใน environment variable
        // ลองหลายวิธีส่ง API key
        if (process.env.GISTDA_API_KEY) {
            headers['apikey'] = process.env.GISTDA_API_KEY;
            headers['X-API-Key'] = process.env.GISTDA_API_KEY;
            headers['api-key'] = process.env.GISTDA_API_KEY;
        }

        console.log('Fetching GISTDA data from:', gistdaUrl);
        console.log('Has API Key:', !!process.env.GISTDA_API_KEY);

        const response = await fetch(gistdaUrl, {
            method: 'GET',
            headers: headers,
            cache: 'no-store' // ไม่ cache เพื่อให้ได้ข้อมูลล่าสุด
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('GISTDA API Error:', response.status, errorText);

            // ถ้า error 407 หมายความว่าต้องการ authentication
            if (response.status === 407) {
                return NextResponse.json({
                    success: false,
                    error: 'Authentication Required',
                    message: 'กรุณาตั้งค่า GISTDA_API_KEY ใน .env.local',
                    useMockData: true,
                    data: getMockFloodData()
                }, { status: 200 }); // ส่ง 200 เพื่อให้ UI รับ mock data
            }

            return NextResponse.json({
                success: false,
                error: 'Failed to fetch data from GISTDA',
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();

        // แปลงข้อมูล GISTDA ให้อยู่ในรูปแบบที่ใช้งานง่าย
        const processedData = {
            success: true,
            source: 'GISTDA',
            timestamp: new Date().toISOString(),
            total: data.total || 0,
            features: data.features || [],
            // สร้างสรุปข้อมูล
            summary: {
                totalAreas: data.features?.length || 0,
                provinces: [...new Set(data.features?.map(f => f.properties?.province) || [])],
                lastUpdate: data.last_update || new Date().toISOString()
            }
        };

        return NextResponse.json(processedData);

    } catch (error) {
        console.error('Error in GISTDA API proxy:', error);

        // ส่ง mock data แทนถ้า error
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            message: error.message,
            useMockData: true,
            data: getMockFloodData()
        }, { status: 200 });
    }
}

// ข้อมูลจำลองสำหรับทดสอบ
function getMockFloodData() {
    return {
        success: true,
        source: 'MOCK',
        timestamp: new Date().toISOString(),
        total: 5,
        features: [
            {
                type: 'Feature',
                properties: {
                    province: 'สตูล',
                    district: 'เมืองสตูล',
                    tambon: 'ควนสตอ',
                    flood_level: 'moderate',
                    water_depth: 50,
                    affected_area: 1200,
                    description: 'พื้นที่น้ำท่วมบริเวณตำบลควนสตอ',
                    date: '2025-12-11'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [100.0673, 6.6238]
                }
            },
            {
                type: 'Feature',
                properties: {
                    province: 'สตูล',
                    district: 'เมืองสตูล',
                    tambon: 'คลองขุด',
                    flood_level: 'mild',
                    water_depth: 30,
                    affected_area: 800,
                    description: 'น้ำท่วมเล็กน้อยบริเวณตำบลคลองขุด',
                    date: '2025-12-11'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [100.0823, 6.6338]
                }
            },
            {
                type: 'Feature',
                properties: {
                    province: 'สตูล',
                    district: 'ควนโดน',
                    tambon: 'ควนโดน',
                    flood_level: 'severe',
                    water_depth: 80,
                    affected_area: 2000,
                    description: 'น้ำท่วมหนักบริเวณตำบลควนโดน',
                    date: '2025-12-11'
                },
                geometry: {
                    type: 'Point',
                    coordinates: [99.9173, 6.7638]
                }
            }
        ],
        summary: {
            totalAreas: 3,
            provinces: ['สตูล'],
            lastUpdate: new Date().toISOString()
        }
    };
}
