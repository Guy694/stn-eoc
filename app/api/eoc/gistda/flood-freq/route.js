import { NextResponse } from 'next/server';
import { publicInternalError } from '@/lib/apiResponse';

const GISTDA_API_BASE = 'https://api-gateway.gistda.or.th/api/2.0';
const GISTDA_API_KEY = process.env.GISTDA_API_KEY || '';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const offset = searchParams.get('offset') || '0';
        const limit = searchParams.get('limit') || '100';

        if (!GISTDA_API_KEY) {
            return NextResponse.json({
                success: false,
                error: 'missing_api_key',
                message: 'ยังไม่ได้ตั้งค่า GISTDA_API_KEY'
            }, { status: 503 });
        }

        const apiUrl = `${GISTDA_API_BASE}/resources/features/flood-freq?offset=${offset}&limit=${limit}`;
        const response = await fetch(apiUrl, {
            headers: {
                'Authorization': `Bearer ${GISTDA_API_KEY}`,
                'Accept': 'application/json'
            },
            next: { revalidate: 3600 }
        });

        if (!response.ok) {
            const errorText = await response.text();
            return NextResponse.json({
                success: false,
                error: 'gistda_upstream_error',
                message: 'ไม่สามารถดึงข้อมูล flood frequency จาก GISTDA ได้',
                details: errorText
            }, { status: response.status });
        }

        const data = await response.json();
        return NextResponse.json({
            success: true,
            data,
            source: 'gistda'
        });

    } catch (error) {
        console.error('Error fetching flood frequency data:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลพื้นที่อุทกภัยน้ำท่วมซ้ำซาก');
    }
}
