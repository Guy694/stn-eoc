import { NextResponse } from 'next/server';
import { publicInternalError } from '@/lib/apiResponse';
import { loadOpenShelters } from '@/lib/publicShelterData';

// ศูนย์พักพิงสำหรับประชาชน: มีข้อมูลเฉพาะเมื่อเปิด EOC และเฉพาะศูนย์ที่เปิดใช้ในเหตุการณ์ที่ยังเปิดอยู่
// (เจ้าหน้าที่ดูรายชื่อทั้งหมด/ย้อนหลังได้ที่ /api/eoc/shelter-centers ซึ่งต้องเข้าสู่ระบบ)
const CLOSED_MESSAGE = 'ขณะนี้ยังไม่ได้เปิดศูนย์ปฏิบัติการ (EOC) จึงยังไม่มีศูนย์พักพิงที่เปิดรับผู้อพยพ';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const result = await loadOpenShelters({
            sessionId: searchParams.get('session_id'),
            eocType: searchParams.get('eoc_type')
        });
        return NextResponse.json(
            { success: true, ...result, ...(result.data.length === 0 ? { message: CLOSED_MESSAGE } : {}) },
            { headers: { 'Cache-Control': 'public, max-age=30' } }
        );
    } catch (error) {
        console.error('Get public shelter centers error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลศูนย์พักพิง');
    }
}
