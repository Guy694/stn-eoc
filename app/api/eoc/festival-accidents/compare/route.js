import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// GET - เปรียบเทียบข้อมูลระหว่างเทศกาล/ปี
export async function GET(request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        // รับ session_ids คั่นด้วย comma เช่น ?session_ids=1,2,3
        const sessionIdsParam = searchParams.get('session_ids');

        connection = await pool.getConnection();

        // ตรวจสอบว่ามีคอลัมน์ festival_type หรือยัง
        let hasFestivalType = false;
        try {
            const [cols] = await connection.execute(
                `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'eoc_sessions' AND COLUMN_NAME = 'festival_type'`
            );
            hasFestivalType = cols.length > 0;
        } catch { hasFestivalType = false; }

        const festivalCol = hasFestivalType ? 'festival_type,' : '';

        let sessionIds = [];

        if (sessionIdsParam) {
            sessionIds = sessionIdsParam.split(',').map(id => parseInt(id.trim())).filter(Boolean);
        } else {
            // ถ้าไม่ระบุ ให้ดึง sessions ทั้งหมดที่เป็น accident
            const [sessions] = await connection.execute(`
                SELECT id FROM eoc_sessions 
                WHERE eoc_type = 'festival-accidents' 
                ORDER BY opened_at DESC 
                LIMIT 10
            `);
            sessionIds = sessions.map(s => s.id);
        }

        if (sessionIds.length === 0) {
            return NextResponse.json({
                success: true,
                comparisons: [],
                message: 'ไม่พบ session สำหรับเปรียบเทียบ'
            });
        }

        const comparisons = [];

        for (const sid of sessionIds) {
            // ดึง session info
            const [sessionInfo] = await connection.execute(
                `SELECT id, session_number, ${festivalCol} status, opened_at, closed_at, open_reason
                 FROM eoc_sessions WHERE id = ?`,
                [sid]
            );
            if (sessionInfo.length === 0) continue;

            const session = sessionInfo[0];

            // ดึงสถิติ
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_accidents,
                    COALESCE(SUM(deaths), 0) as total_deaths,
                    COALESCE(SUM(injuries), 0) as total_injuries,
                    SUM(CASE WHEN drunk_driving = 1 THEN 1 ELSE 0 END) as drunk_cases,
                    SUM(CASE WHEN no_helmet = 1 THEN 1 ELSE 0 END) as no_helmet_cases,
                    SUM(CASE WHEN no_seatbelt = 1 THEN 1 ELSE 0 END) as no_seatbelt_cases,
                    SUM(CASE WHEN speeding = 1 THEN 1 ELSE 0 END) as speeding_cases
                FROM accident_reports 
                WHERE session_id = ?
            `, [sid]);

            // จุดตรวจ
            let checkpoints = 0;
            try {
                const [cp] = await connection.execute(
                    'SELECT COUNT(*) as count FROM temporary_service_points WHERE session_id = ?',
                    [sid]
                );
                checkpoints = cp[0]?.count || 0;
            } catch { checkpoints = 0; }

            // สถิติตามประเภท
            const [typeBreakdown] = await connection.execute(`
                SELECT accident_type, COUNT(*) as count
                FROM accident_reports WHERE session_id = ?
                GROUP BY accident_type
            `, [sid]);

            comparisons.push({
                session: {
                    id: session.id,
                    sessionNumber: session.session_number,
                    festivalType: session.festival_type,
                    festivalName: session.festival_type === 'newyear' ? 'ปีใหม่' :
                        session.festival_type === 'songkran' ? 'สงกรานต์' : 'ไม่ระบุ',
                    status: session.status,
                    openedAt: session.opened_at,
                    closedAt: session.closed_at,
                    openReason: session.open_reason
                },
                stats: {
                    totalAccidents: stats[0]?.total_accidents || 0,
                    totalDeaths: stats[0]?.total_deaths || 0,
                    totalInjuries: stats[0]?.total_injuries || 0,
                    drunkCases: stats[0]?.drunk_cases || 0,
                    noHelmetCases: stats[0]?.no_helmet_cases || 0,
                    noSeatbeltCases: stats[0]?.no_seatbelt_cases || 0,
                    speedingCases: stats[0]?.speeding_cases || 0,
                    checkpoints
                },
                typeBreakdown: typeBreakdown.map(t => ({ type: t.accident_type, count: t.count }))
            });
        }

        return NextResponse.json({
            success: true,
            comparisons
        });

    } catch (error) {
        console.error('Compare error:', error);
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
