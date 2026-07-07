import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const eocType = searchParams.get('eoc_type');
        const includeAll = searchParams.get('include_all');

        let query;
        let params = [];

        if (sessionId && includeAll !== '1') {
            const pool = await getConnection();
            const [sessions] = await pool.query(
                'SELECT status FROM eoc_sessions WHERE id = ? LIMIT 1',
                [sessionId]
            );
            const isClosedSession = sessions[0]?.status === 'closed';
            const activationFilter = isClosedSession ? '' : 'AND ssa.is_active = 1';
            const shelterStatusFilter = isClosedSession ? 'WHERE 1=1' : 'WHERE sc.is_active = 1';

            query = `
                SELECT
                    sc.*,
                    COALESCE(ssa.current_occupancy, 0) as current_occupancy,
                    ssa.activated_at,
                    ssa.deactivated_at,
                    ssa.is_active as session_is_active,
                    CASE
                        WHEN COALESCE(ssa.current_occupancy, 0) >= sc.shelter_capacity THEN 'full'
                        WHEN COALESCE(ssa.current_occupancy, 0) >= sc.shelter_capacity * 0.8 THEN 'near_full'
                        ELSE 'available'
                    END as occupancy_status
                FROM shelter_centers sc
                INNER JOIN shelter_session_activations ssa
                    ON sc.id = ssa.shelter_id
                    AND ssa.session_id = ?
                    ${activationFilter}
                ${shelterStatusFilter}
            `;
            params = [sessionId];

            if (eocType) {
                query += ' AND sc.eoc_type = ?';
                params.push(eocType);
            }

            query += ' ORDER BY sc.eoc_type, sc.sheltername ASC';
        } else {
            query = `
                SELECT
                    sc.*,
                    0 as current_occupancy,
                    sc.created_at as last_updated,
                    'available' as occupancy_status
                FROM shelter_centers sc
                WHERE sc.is_active = 1
            `;

            if (eocType) {
                query += ' AND sc.eoc_type = ?';
                params.push(eocType);
            }

            query += ' ORDER BY sc.eoc_type, sc.sheltername ASC';
        }

        const pool = await getConnection();
        const [rows] = await pool.query(query, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get public shelter centers error:', error);

        if (error.code === 'ER_NO_SUCH_TABLE') {
            try {
                const { searchParams } = new URL(request.url);
                const sessionId = searchParams.get('session_id');
                const includeAll = searchParams.get('include_all');
                const eocType = searchParams.get('eoc_type');

                if (sessionId && includeAll !== '1') {
                    return NextResponse.json({
                        success: true,
                        data: [],
                        message: 'ยังไม่ได้สร้างตาราง shelter_session_activations'
                    });
                }

                let fallbackQuery = 'SELECT sc.*, 0 as current_occupancy FROM shelter_centers sc WHERE sc.is_active = 1';
                const fallbackParams = [];

                if (eocType) {
                    fallbackQuery += ' AND sc.eoc_type = ?';
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
                console.error('Public shelter fallback query error:', fallbackError);
            }
        }

        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลศูนย์พักพิง');
    }
}
