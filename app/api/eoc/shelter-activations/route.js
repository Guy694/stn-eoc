import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - ดึงรายการ shelter activations สำหรับ session
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const eocType = searchParams.get('eoc_type');

        if (!sessionId) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ session_id' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // ดึงทุก shelter พร้อมสถานะ activation สำหรับ session นี้
        let query = `
            SELECT 
                sc.*,
                CASE WHEN ssa.id IS NOT NULL AND ssa.is_active = 1 THEN 1 ELSE 0 END as is_activated_for_session,
                COALESCE(ssa.current_occupancy, 0) as session_occupancy,
                ssa.activated_at,
                ssa.notes as activation_notes
            FROM shelter_centers sc
            LEFT JOIN shelter_session_activations ssa 
                ON sc.id = ssa.shelter_id AND ssa.session_id = ?
            WHERE 1=1
        `;
        const params = [sessionId];

        if (eocType) {
            query += ` AND sc.eoc_type = ?`;
            params.push(eocType);
        }

        query += ` ORDER BY is_activated_for_session DESC, sc.sheltername ASC`;

        const [rows] = await pool.query(query, params);

        // นับสถิติ
        const stats = {
            total: rows.length,
            activated: rows.filter(r => r.is_activated_for_session).length,
            not_activated: rows.filter(r => !r.is_activated_for_session).length,
            total_capacity: rows.filter(r => r.is_activated_for_session)
                .reduce((sum, r) => sum + (r.shelter_capacity || 0), 0),
            total_occupancy: rows.filter(r => r.is_activated_for_session)
                .reduce((sum, r) => sum + (r.session_occupancy || 0), 0)
        };

        return NextResponse.json({
            success: true,
            data: rows,
            stats
        });
    } catch (error) {
        console.error('Get shelter activations error:', error);

        // ถ้าตารางยังไม่มี ให้ return empty array
        if (error.code === 'ER_NO_SUCH_TABLE') {
            return NextResponse.json({
                success: true,
                data: [],
                stats: { total: 0, activated: 0, not_activated: 0, total_capacity: 0, total_occupancy: 0 },
                message: 'ยังไม่ได้สร้างตาราง shelter_session_activations'
            });
        }

        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลศูนย์พักพิง');
    }
}

// POST - Activate/Toggle shelter สำหรับ session
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { shelter_id, session_id, is_active, notes } = body;

        if (!shelter_id || !session_id) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ shelter_id และ session_id' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // ตรวจสอบว่ามี record อยู่แล้วหรือไม่
        const [existing] = await pool.query(
            'SELECT * FROM shelter_session_activations WHERE shelter_id = ? AND session_id = ?',
            [shelter_id, session_id]
        );

        if (existing.length > 0) {
            // Update existing
            const newStatus = is_active !== undefined ? is_active : !existing[0].is_active;
            await pool.query(
                `UPDATE shelter_session_activations 
                 SET is_active = ?, 
                     deactivated_at = CASE WHEN ? = 0 THEN NOW() ELSE NULL END,
                     notes = COALESCE(?, notes)
                 WHERE shelter_id = ? AND session_id = ?`,
                [newStatus, newStatus ? 0 : 1, notes, shelter_id, session_id]
            );

            return NextResponse.json({
                success: true,
                message: newStatus ? 'เปิดใช้งานศูนย์พักพิงแล้ว' : 'ปิดใช้งานศูนย์พักพิงแล้ว',
                is_active: newStatus
            });
        } else {
            // Insert new
            await pool.query(
                `INSERT INTO shelter_session_activations 
                 (shelter_id, session_id, is_active, notes) 
                 VALUES (?, ?, ?, ?)`,
                [shelter_id, session_id, is_active !== undefined ? is_active : true, notes || null]
            );

            return NextResponse.json({
                success: true,
                message: 'เปิดใช้งานศูนย์พักพิงแล้ว',
                is_active: true
            });
        }
    } catch (error) {
        console.error('Toggle shelter activation error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเปิด/ปิดศูนย์พักพิง');
    }
}

// PUT - Update occupancy สำหรับ shelter ที่ activate แล้ว
export async function PUT(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { shelter_id, session_id, current_occupancy, notes } = body;

        if (!shelter_id || !session_id) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ shelter_id และ session_id' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        await pool.query(
            `UPDATE shelter_session_activations 
             SET current_occupancy = COALESCE(?, current_occupancy),
                 notes = COALESCE(?, notes)
             WHERE shelter_id = ? AND session_id = ?`,
            [current_occupancy, notes, shelter_id, session_id]
        );

        return NextResponse.json({
            success: true,
            message: 'อัพเดทข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update shelter occupancy error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัพเดทข้อมูลศูนย์พักพิง');
    }
}

// DELETE - Deactivate shelter สำหรับ session
export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const shelterId = searchParams.get('shelter_id');
        const sessionId = searchParams.get('session_id');

        if (!shelterId || !sessionId) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ shelter_id และ session_id' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        await pool.query(
            `UPDATE shelter_session_activations 
             SET is_active = 0, deactivated_at = NOW() 
             WHERE shelter_id = ? AND session_id = ?`,
            [shelterId, sessionId]
        );

        return NextResponse.json({
            success: true,
            message: 'ปิดใช้งานศูนย์พักพิงแล้ว'
        });
    } catch (error) {
        console.error('Deactivate shelter error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการปิดใช้งานศูนย์พักพิง');
    }
}
