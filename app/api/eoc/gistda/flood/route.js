import { NextResponse } from 'next/server';

// API Proxy สำหรับดึงข้อมูลอุทกภัยน้ำท่วมจาก GISTDA
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const days = searchParams.get('days') || '30';
        const limit = searchParams.get('limit') || '1000';
        const offset = searchParams.get('offset') || '0';

        if (!process.env.GISTDA_API_KEY) {
            return NextResponse.json({
                success: false,
                error: 'missing_api_key',
                message: 'ยังไม่ได้ตั้งค่า GISTDA_API_KEY'
            }, { status: 503 });
        }

        // สร้าง URL สำหรับเรียก GISTDA API
        const gistdaUrl = `https://api-gateway.gistda.or.th/api/2.0/resources/features/flood/${days}days?limit=${limit}&offset=${offset}&pv_idn=91`;

        // ถ้ามี API Key ให้เพิ่ม header
        const headers = {
            'accept': 'application/json',
            'Content-Type': 'application/json'
        };

        // ลองหลายวิธีส่ง API key ให้รองรับรูปแบบ upstream ที่ต่างกัน
        headers['apikey'] = process.env.GISTDA_API_KEY;
        headers['X-API-Key'] = process.env.GISTDA_API_KEY;
        headers['api-key'] = process.env.GISTDA_API_KEY;

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
                    error: 'authentication_required',
                    message: 'GISTDA API ปฏิเสธการยืนยันตัวตน'
                }, { status: 503 });
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
        return NextResponse.json({
            success: false,
            error: 'Internal server error',
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก GISTDA',
        }, { status: 500 });
    }
}
