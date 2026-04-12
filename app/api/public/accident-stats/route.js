import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
};

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        const connection = await mysql.createConnection(dbConfig);

        // หา session_id ถ้าไม่ได้ระบุ ให้ใช้ active session
        let activeSessionId = sessionId;
        if (!activeSessionId) {
            const [sessionResult] = await connection.execute(`
                SELECT id, session_number, opened_at, closed_at, open_reason
                FROM eoc_sessions 
                WHERE eoc_type = 'festival-accidents' AND status = 'active'
                LIMIT 1
            `);
            if (sessionResult.length > 0) {
                activeSessionId = sessionResult[0].id;
            }
        }

        if (!activeSessionId) {
            await connection.end();
            return NextResponse.json({
                success: true,
                data: {
                    accidents: 0,
                    injuries: 0,
                    deaths: 0,
                    checkpoints: 0
                }
            });
        }

        // นับจำนวนอุบัติเหตุ
        const [accidentCount] = await connection.execute(
            'SELECT COUNT(*) as count FROM accident_reports WHERE session_id = ?',
            [activeSessionId]
        );

        // นับจำนวนผู้บาดเจ็บ
        const [injuryCount] = await connection.execute(
            'SELECT COALESCE(SUM(injuries), 0) as total FROM accident_reports WHERE session_id = ?',
            [activeSessionId]
        );

        // นับจำนวนผู้เสียชีวิต
        const [deathCount] = await connection.execute(
            'SELECT COALESCE(SUM(deaths), 0) as total FROM accident_reports WHERE session_id = ?',
            [activeSessionId]
        );

        // นับจุดตรวจ/จุดบริการ
        let checkpointsCount = 0;
        try {
            const [checkpoints] = await connection.execute(
                'SELECT COUNT(*) as count FROM temporary_service_points WHERE session_id = ? AND is_active = 1',
                [activeSessionId]
            );
            checkpointsCount = checkpoints[0]?.count || 0;
        } catch (e) {
            checkpointsCount = 0;
        }

        await connection.end();

        return NextResponse.json({
            success: true,
            data: {
                accidents: accidentCount[0]?.count || 0,
                injuries: injuryCount[0]?.total || 0,
                deaths: deathCount[0]?.total || 0,
                checkpoints: checkpointsCount
            }
        });

    } catch (error) {
        console.error('Error fetching accident stats:', error);
        return NextResponse.json({
            success: true,
            data: {
                accidents: 0,
                injuries: 0,
                deaths: 0,
                checkpoints: 0
            }
        });
    }
}
