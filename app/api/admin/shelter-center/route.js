import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { ArchiveError, handleArchiveDelete, recordChange } from '@/lib/recordArchive';
import { normalizeShelterType, parseCapabilities } from '@/lib/shelterSuitability';

// ประเภทศูนย์และความพร้อม (คอลัมน์ใหม่ — ถ้ายังไม่ migrate ให้ข้ามโดยไม่ทำให้การบันทึกหลักล้ม)
async function saveShelterKind(pool, id, body) {
    if (body.shelter_type === undefined && body.capabilities === undefined) return;
    try {
        await pool.query('UPDATE shelter_centers SET shelter_type = ?, capabilities = ? WHERE id = ?', [
            normalizeShelterType(body.shelter_type),
            parseCapabilities(body.capabilities).join(',') || null,
            id
        ]);
    } catch (error) {
        if (error.code !== 'ER_BAD_FIELD_ERROR') throw error;
    }
}

// GET - Fetch all shelter centers
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('eoc_type');

        let query = `SELECT * FROM shelter_centers`;
        let params = [];

        if (eocType) {
            query += ` WHERE eoc_type = ?`;
            params.push(eocType);
        }

        query += ` ORDER BY eoc_type, id DESC`;

        const pool = await getConnection();
        const [rows] = await pool.query(query, params);

        return NextResponse.json({
            success: true,
            data: Array.isArray(rows) ? rows : []
        });
    } catch (error) {
        console.error('Get shelter centers error:', error);

        // Return empty array instead of error to prevent frontend crashes
        return NextResponse.json({
            success: false,
            message: error.code === 'ER_NO_SUCH_TABLE'
                ? 'ยังไม่ได้สร้างตารางในฐานข้อมูล กรุณารัน SQL ก่อน'
                : 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            data: []
        });
    }
}

// POST - Create new shelter center
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const {
            sheltername,
            eoc_type,
            lat,
            lon,
            address,
            tambon,
            district_name,
            village,
            is_active,
            shelter_capacity,
            contact_phone
        } = body;

        // Validation
        if (!sheltername || !eoc_type || !tambon || !shelter_capacity) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึงประเภท EOC)' },
                { status: 400 }
            );
        }

        // Validate EOC type
        const validEocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
        if (!validEocTypes.includes(eoc_type)) {
            return NextResponse.json(
                { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        const [result] = await pool.query(
            `INSERT INTO shelter_centers 
            (sheltername, eoc_type, lat, lon, address, tambon, district_name, village, is_active, shelter_capacity, contact_phone) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sheltername,
                eoc_type,
                lat || null,
                lon || null,
                address || null,
                tambon,
                district_name || null,
                village || null,
                is_active !== undefined ? is_active : 1,
                shelter_capacity,
                contact_phone || null
            ]
        );

        await saveShelterKind(pool, result.insertId, body);

        await recordChange({
            request, user: auth.user, action: 'data_create', table: 'shelter_centers', id: result.insertId,
            description: `เพิ่มศูนย์พักพิง: ${sheltername}`, newValues: body
        });

        return NextResponse.json({
            success: true,
            message: 'เพิ่มข้อมูลสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create shelter center error:', error);

        let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
        if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'ยังไม่ได้สร้างตาราง shelter_centers ในฐานข้อมูล กรุณารัน SQL ก่อน';
        } else if (error.code === 'ER_BAD_NULL_ERROR') {
            errorMessage = 'ข้อมูลที่จำเป็นไม่ครบถ้วน';
        }

        return NextResponse.json(
            { success: false, message: errorMessage },
            { status: 500 }
        );
    }
}

// PUT - Update shelter center
export async function PUT(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const {
            sheltername,
            eoc_type,
            lat,
            lon,
            address,
            tambon,
            district_name,
            village,
            is_active,
            shelter_capacity,
            contact_phone
        } = body;

        // Validation
        if (!sheltername || !eoc_type || !tambon || !shelter_capacity) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึงประเภท EOC)' },
                { status: 400 }
            );
        }

        // Validate EOC type
        const validEocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
        if (!validEocTypes.includes(eoc_type)) {
            return NextResponse.json(
                { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        const [beforeRows] = await pool.query('SELECT * FROM shelter_centers WHERE id = ?', [id]);
        await pool.query(
            `UPDATE shelter_centers 
            SET sheltername = ?, eoc_type = ?, lat = ?, lon = ?, address = ?, 
                tambon = ?, district_name = ?, village = ?, is_active = ?, shelter_capacity = ?, contact_phone = ?
            WHERE id = ?`,
            [
                sheltername,
                eoc_type,
                lat || null,
                lon || null,
                address || null,
                tambon,
                district_name || null,
                village || null,
                is_active !== undefined ? is_active : 1,
                shelter_capacity,
                contact_phone || null,
                id
            ]
        );

        await saveShelterKind(pool, id, body);

        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'shelter_centers', id,
            description: `แก้ไขศูนย์พักพิง: ${sheltername}${Number(is_active) === 0 ? ' (ปิดใช้งาน)' : ''}`,
            oldValues: beforeRows[0] || null, newValues: body
        });

        return NextResponse.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update shelter center error:', error);

        let errorMessage = 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล';
        if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = 'ยังไม่ได้สร้างตาราง shelter_centers ในฐานข้อมูล กรุณารัน SQL ก่อน';
        }

        return NextResponse.json(
            { success: false, message: errorMessage },
            { status: 500 }
        );
    }
}

// DELETE - ย้ายศูนย์พักพิงไปถังขยะ (กู้คืนได้)
// ศูนย์ที่เคยเปิดใช้ในเหตุการณ์หรือมีรายงานโรคแล้ว ห้ามลบ เพื่อไม่ให้ประวัติที่ใช้ตัดสินใจหายไป — ให้ "ปิดใช้งาน" แทน
export async function DELETE(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;

    return handleArchiveDelete(request, auth.user, {
        table: 'shelter_centers',
        beforeDelete: async (row, execute) => {
            const usage = [];
            for (const [table, label] of [
                ['shelter_session_activations', 'การเปิดใช้ในเหตุการณ์'],
                ['shelter_occupancy', 'ยอดผู้พักพิง'],
                ['shelter_disease_reports', 'รายงานโรคในศูนย์']
            ]) {
                try {
                    const [counted] = await execute(`SELECT COUNT(*) AS count FROM ${table} WHERE shelter_id = ?`, [row.id]);
                    if (Number(counted.count) > 0) usage.push(`${label} ${counted.count} รายการ`);
                } catch (error) {
                    if (error.code !== 'ER_NO_SUCH_TABLE') throw error;
                }
            }
            if (usage.length > 0) {
                throw new ArchiveError(`ลบไม่ได้ เพราะศูนย์นี้มีประวัติ (${usage.join(', ')}) ให้ใช้ "ปิดใช้งาน" แทน เพื่อเก็บประวัติไว้`, 409);
            }
        }
    });
}
