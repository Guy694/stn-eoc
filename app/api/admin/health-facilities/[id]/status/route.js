import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { hasFacilityStatusColumns } from '@/lib/healthFacilityDb';
import { normalizeFloodStatus, normalizeServiceStatus } from '@/lib/healthFacilityStatus';

// PATCH - เจ้าหน้าที่อัปเดตสถานะการให้บริการ/น้ำท่วมของสถานพยาบาล (แสดงบนแผนที่สถานการณ์)
export async function PATCH(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT', 'staff']);
        if (!auth.success) return auth.response;

        if (!await hasFacilityStatusColumns()) {
            return NextResponse.json(
                { success: false, error: 'ยังไม่ได้อัปเดตฐานข้อมูล กรุณารัน npm run db:migrate' },
                { status: 503 }
            );
        }

        const { id } = await params;
        const facilityId = Number.parseInt(id, 10);
        if (!Number.isFinite(facilityId)) {
            return NextResponse.json({ success: false, error: 'รหัสสถานพยาบาลไม่ถูกต้อง' }, { status: 400 });
        }

        const body = await request.json().catch(() => ({}));
        const serviceStatus = body.service_status ? normalizeServiceStatus(body.service_status) : null;
        const floodStatus = body.flood_status ? normalizeFloodStatus(body.flood_status) : null;
        if (body.service_status && !serviceStatus) {
            return NextResponse.json({ success: false, error: 'สถานะการให้บริการไม่ถูกต้อง' }, { status: 400 });
        }
        if (body.flood_status && !floodStatus) {
            return NextResponse.json({ success: false, error: 'สถานะน้ำท่วมไม่ถูกต้อง' }, { status: 400 });
        }
        const note = String(body.service_note || '').trim().slice(0, 255) || null;
        const phone = String(body.phone || '').trim().slice(0, 80) || null;

        const result = await query(
            `UPDATE health_facilities
             SET service_status = ?, flood_status = ?, service_note = ?, phone = ?,
                 status_updated_at = NOW(), status_updated_by = ?
             WHERE id = ?`,
            [serviceStatus, floodStatus, note, phone, auth.user?.id || null, facilityId]
        );
        if (!result.affectedRows) {
            return NextResponse.json({ success: false, error: 'ไม่พบสถานพยาบาล' }, { status: 404 });
        }

        const rows = await query(
            `SELECT id, name, phone, service_status, flood_status, service_note, status_updated_at
             FROM health_facilities WHERE id = ?`,
            [facilityId]
        );
        return NextResponse.json({ success: true, data: rows[0] });
    } catch (error) {
        console.error('Error updating health facility status:', error);
        return publicInternalError('ไม่สามารถบันทึกสถานะสถานพยาบาลได้');
    }
}
