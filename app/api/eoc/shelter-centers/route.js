import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// GET - Fetch shelter centers for a specific EOC session
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const eocType = searchParams.get('eoc_type');

        let query;
        let params = [];

        if (sessionId) {
            // Get shelter centers with occupancy data for a specific session
            query = `
                SELECT 
                    sc.*,
                    COALESCE(so.current_occupancy, 0) as current_occupancy,
                    COALESCE(so.max_occupancy_reached, 0) as max_occupancy_reached,
                    COALESCE(so.last_updated, sc.created_at) as last_updated,
                    CASE 
                        WHEN COALESCE(so.current_occupancy, 0) >= sc.shelter_capacity THEN 'full'
                        WHEN COALESCE(so.current_occupancy, 0) >= sc.shelter_capacity * 0.8 THEN 'near_full'
                        ELSE 'available'
                    END as occupancy_status
                FROM shelter_centers sc
                LEFT JOIN shelter_occupancy so ON sc.id = so.shelter_id AND so.eoc_session_id = ?
                WHERE sc.is_active = 1
            `;
            params = [sessionId];

            // Filter by EOC type if provided
            if (eocType) {
                query += ` AND sc.eoc_type = ?`;
                params.push(eocType);
            }

            query += ` ORDER BY sc.eoc_type, sc.id DESC`;
        } else {
            // Get all active shelter centers
            query = `
                SELECT 
                    sc.*,
                    0 as current_occupancy,
                    0 as max_occupancy_reached,
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

            query += ` ORDER BY sc.eoc_type, sc.id DESC`;
        }

        const pool = await getConnection();
        const [rows] = await pool.query(query, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Get EOC shelter centers error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูล', error: error.message },
            { status: 500 }
        );
    }
}

// POST - Update shelter occupancy for EOC session
export async function POST(request) {
    try {
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
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการอัพเดทข้อมูล', error: error.message },
            { status: 500 }
        );
    }
}
