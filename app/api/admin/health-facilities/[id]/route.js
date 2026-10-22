import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { hasFacilityStatusColumns } from '@/lib/healthFacilityDb';
import { handleArchiveDelete, recordChange } from '@/lib/recordArchive';

// GET - ดึงข้อมูลสถานพยาบาลตาม ID
export async function GET(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT', 'staff']);
        if (!auth.success) return auth.response;

        const { id } = await params;

        const facilities = await query(
            'SELECT * FROM health_facilities WHERE id = ?',
            [id]
        );

        if (facilities.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Health facility not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: facilities[0]
        });

    } catch (error) {
        console.error('Error fetching health facility:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลสถานพยาบาล');
    }
}

// PUT - แก้ไขข้อมูลสถานพยาบาล
export async function PUT(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { id } = await params;
        const body = await request.json();
        const { name, typecode, address, district, tambon, lat, lon, phone } = body;

        // Validate required fields
        if (!name || !typecode) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (name, typecode)' },
                { status: 400 }
            );
        }

        // Update facility (ตารางใช้ district_name; phone มีหลัง migration 20261007_health_facility_status)
        const withPhone = await hasFacilityStatusColumns();
        await query(`
            UPDATE health_facilities
            SET name = ?,
                typecode = ?,
                address = ?,
                district_name = ?,
                tambon = ?,
                lat = ?,
                lon = ?
                ${withPhone ? ', phone = ?' : ''}
            WHERE id = ?
        `, [
            name, typecode, address || '', district || null, tambon || '', lat || null, lon || null,
            ...(withPhone ? [String(phone || '').trim().slice(0, 80) || null] : []),
            id
        ]);

        // ดึงข้อมูลที่อัปเดต
        const updatedFacility = await query(
            'SELECT * FROM health_facilities WHERE id = ?',
            [id]
        );

        if (updatedFacility.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Health facility not found after update' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Health facility updated successfully',
            data: updatedFacility[0]
        });

    } catch (error) {
        console.error('Error updating health facility:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขสถานพยาบาล');
    }
}

/** พิกัดต้องอยู่ในช่วงที่เป็นไปได้ (ว่าง = ลบพิกัด) */
function parseCoordinate(value, min, max) {
    if (value === null || value === undefined || String(value).trim() === '') return { value: null };
    const number = Number.parseFloat(value);
    if (!Number.isFinite(number) || number < min || number > max) return { error: true };
    return { value: Number(number.toFixed(7)) };
}

// PATCH - ปักหมุด/แก้เฉพาะพิกัด (จากแผนที่ในหน้าจัดการหน่วยบริการ)
export async function PATCH(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        const lat = parseCoordinate(body.lat, -90, 90);
        const lon = parseCoordinate(body.lon, -180, 180);
        if (lat.error || lon.error || (lat.value === null) !== (lon.value === null)) {
            return NextResponse.json({ success: false, error: 'พิกัดไม่ถูกต้อง ต้องมีทั้งละติจูดและลองจิจูด' }, { status: 400 });
        }

        const existing = await query('SELECT id, name, lat, lon FROM health_facilities WHERE id = ?', [id]);
        if (existing.length === 0) {
            return NextResponse.json({ success: false, error: 'ไม่พบหน่วยบริการนี้' }, { status: 404 });
        }

        await query('UPDATE health_facilities SET lat = ?, lon = ? WHERE id = ?', [lat.value, lon.value, id]);
        await recordChange({
            request, user: auth.user, action: 'UPDATE', table: 'health_facilities', id,
            description: `ปักพิกัด ${existing[0].name}`,
            oldValues: { lat: existing[0].lat, lon: existing[0].lon },
            newValues: { lat: lat.value, lon: lon.value }
        });

        return NextResponse.json({ success: true, data: { id: Number(id), lat: lat.value, lon: lon.value } });
    } catch (error) {
        console.error('Error updating facility location:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกพิกัด');
    }
}

// DELETE - ย้ายสถานพยาบาลไปถังขยะ (ต้องระบุเหตุผล กู้คืนได้)
export async function DELETE(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;
    return handleArchiveDelete(request, auth.user, { table: 'health_facilities' });
}
