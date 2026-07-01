import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - Fetch shelter centers for a specific EOC session
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const eocType = searchParams.get('eoc_type');
        const includeAll = searchParams.get('include_all'); // ถ้า true แสดงทั้งหมด

        let query;
        let params = [];

        if (sessionId && !includeAll) {
            // ดึงเฉพาะ shelter ที่ activate สำหรับ session นี้
            query = `
                SELECT 
                    sc.*,
                    COALESCE(ssa.current_occupancy, 0) as current_occupancy,
                    ssa.activated_at,
                    CASE 
                        WHEN COALESCE(ssa.current_occupancy, 0) >= sc.shelter_capacity THEN 'full'
                        WHEN COALESCE(ssa.current_occupancy, 0) >= sc.shelter_capacity * 0.8 THEN 'near_full'
                        ELSE 'available'
                    END as occupancy_status
                FROM shelter_centers sc
                INNER JOIN shelter_session_activations ssa 
                    ON sc.id = ssa.shelter_id 
                    AND ssa.session_id = ? 
                    AND ssa.is_active = 1
                WHERE sc.is_active = 1
            `;
            params = [sessionId];

            // Filter by EOC type if provided
            if (eocType) {
                query += ` AND sc.eoc_type = ?`;
                params.push(eocType);
            }

            query += ` ORDER BY sc.eoc_type, sc.sheltername ASC`;
        } else {
            // ดึง all active shelter centers (สำหรับ admin หรือไม่ระบุ session)
            query = `
                SELECT 
                    sc.*,
                    0 as current_occupancy,
                    sc.created_at as last_updated,
                    'available' as occupancy_status
                FROM shelter_centers sc
                WHERE sc.is_active = 1
            `;

            // Filter by EOC type if provided
            if (eocType) {
                query += ` AND sc.eoc_type = ?`;
                params.push(eocType);
            }

            query += ` ORDER BY sc.eoc_type, sc.sheltername ASC`;
        }

        const pool = await getConnection();
        const [rows] = await pool.query(query, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get EOC shelter centers error:', error);

        // ถ้าตาราง activation ยังไม่มี fallback ไป query เดิม
        if (error.code === 'ER_NO_SUCH_TABLE') {
            try {
                const { searchParams } = new URL(request.url);
                const eocType = searchParams.get('eoc_type');

                let fallbackQuery = `SELECT sc.*, 0 as current_occupancy FROM shelter_centers sc WHERE sc.is_active = 1`;
                let fallbackParams = [];

                if (eocType) {
                    fallbackQuery += ` AND sc.eoc_type = ?`;
                    fallbackParams.push(eocType);
                }

                const pool = await getConnection();
                const [rows] = await pool.query(fallbackQuery, fallbackParams);

                return NextResponse.json({
                    success: true,
                    data: rows,
                    message: 'ใช้ข้อมูลแบบเดิม (ยังไม่ได้สร้างตาราง shelter_session_activations)'
                });
            } catch (fallbackError) {
                console.error('Fallback query error:', fallbackError);
            }
        }

        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลศูนย์พักพิง');
    }
}

// POST - Update shelter occupancy for EOC session
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { shelter_id, eoc_session_id, current_occupancy } = body;

        if (!shelter_id || !eoc_session_id || current_occupancy === undefined) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        // Check if record exists
        const pool = await getConnection();
        const [existing] = await pool.query(
            'SELECT * FROM shelter_occupancy WHERE shelter_id = ? AND eoc_session_id = ?',
            [shelter_id, eoc_session_id]
        );

        if (existing.length > 0) {
            // Update existing record
            const newMaxOccupancy = Math.max(existing[0].max_occupancy_reached, current_occupancy);

            await pool.query(
                `UPDATE shelter_occupancy 
                SET current_occupancy = ?, 
                    max_occupancy_reached = ?,
                    last_updated = NOW()
                WHERE shelter_id = ? AND eoc_session_id = ?`,
                [current_occupancy, newMaxOccupancy, shelter_id, eoc_session_id]
            );
        } else {
            // Insert new record
            await pool.query(
                `INSERT INTO shelter_occupancy 
                (shelter_id, eoc_session_id, current_occupancy, max_occupancy_reached) 
                VALUES (?, ?, ?, ?)`,
                [shelter_id, eoc_session_id, current_occupancy, current_occupancy]
            );
        }

        return NextResponse.json({
            success: true,
            message: 'อัพเดทข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update shelter occupancy error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัพเดทข้อมูลศูนย์พักพิง');
    }
}
