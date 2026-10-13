import { NextResponse } from 'next/server';
import { OFFICER_ROLES, requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

const GISTDA_API_BASE = 'https://api-gateway.gistda.or.th/api/2.0';
const GISTDA_API_KEY = process.env.GISTDA_API_KEY || '';

export async function GET(request) {
    // ข้อมูลปฏิบัติการภายใน — เฉพาะเจ้าหน้าที่ที่เข้าสู่ระบบ
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;

    try {
        const { searchParams } = new URL(request.url);
        // ไปต่อใน URL ที่แนบคีย์ GISTDA — รับเฉพาะตัวเลข
        const int = (value, fallback, min, max) => {
            const n = Number.parseInt(value ?? '', 10);
            return Number.isInteger(n) ? Math.min(Math.max(n, min), max) : fallback;
        };
        const offset = int(searchParams.get('offset'), 0, 0, 1000000);
        const limit = int(searchParams.get('limit'), 100, 1, 1000);

        if (!GISTDA_API_KEY) {
            return NextResponse.json({
                success: false,
                error: 'missing_api_key',
                message: 'ยังไม่ได้ตั้งค่า GISTDA_API_KEY'
            }, { status: 503 });
        }

        const apiUrl = `${GISTDA_API_BASE}/resources/features/flood-freq?offset=${offset}&limit=${limit}`;
        const response = await fetch(apiUrl, {
            // GISTDA API Gateway รับคีย์ทาง header "API-Key" (แบบ Bearer ตอบ INVALID_TOKEN)
            headers: {
                'API-Key': GISTDA_API_KEY,
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
