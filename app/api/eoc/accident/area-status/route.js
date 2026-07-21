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

// GET - ดึงข้อมูลสถานะพื้นที่อุบัติเหตุ
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const date = searchParams.get('date');

        connection = await pool.getConnection();

        // ดึง active session ถ้าไม่ได้ระบุ session_id
        let activeSessionId = sessionId;
        let activeSession = null;

        if (!activeSessionId) {
            const [activeSessions] = await connection.execute(`
                SELECT id, session_number, status, opened_at, eoc_type
                FROM eoc_sessions 
                WHERE eoc_type = 'festival-accidents' AND status = 'active' 
                ORDER BY opened_at DESC LIMIT 1
            `);

            if (activeSessions.length > 0) {
                activeSession = activeSessions[0];
                activeSessionId = activeSession.id;
            }
        } else {
            const [sessionResult] = await connection.execute(
                'SELECT id, session_number, opened_at, closed_at, open_reason FROM eoc_sessions WHERE id = ?',
                [activeSessionId]
            );
            if (sessionResult.length > 0) {
                activeSession = sessionResult[0];
            }
        }

        if (!activeSessionId) {
            return NextResponse.json({
                success: true,
                hasActiveSession: false,
                message: 'ไม่มี EOC Session ที่เปิดอยู่',
                accidents: [],
                servicePoints: [],
                stats: {}
            });
        }

        // ดึงข้อมูลอุบัติเหตุ
        let accidentQuery = `
            SELECT * FROM accident_reports
            WHERE session_id = ?
        `;
        const accidentParams = [activeSessionId];

        if (date) {
            accidentQuery += ' AND report_date = ?';
            accidentParams.push(date);
        }
        accidentQuery += ' ORDER BY report_date DESC, report_time DESC';

        const [accidents] = await connection.execute(accidentQuery, accidentParams);

        // ดึงข้อมูลจุดบริการชั่วคราว
        const [servicePoints] = await connection.execute(`
            SELECT * FROM temporary_service_points
            WHERE session_id = ? AND is_active = 1
            ORDER BY name
        `, [activeSessionId]);

        // ดึง health facilities
        const [healthFacilities] = await connection.execute(`
            SELECT id, name, typecode as facility_type, lat, lon as lng, district_name, tambon as tambon_name, address
            FROM health_facilities
            WHERE lat IS NOT NULL AND lon IS NOT NULL
        `);

        // สถิติรวม
        const stats = {
            total_accidents: accidents.length,
            total_deaths: accidents.reduce((sum, a) => sum + (a.deaths || 0), 0),
            total_injuries: accidents.reduce((sum, a) => sum + (a.injuries || 0), 0),
            drunk_driving_cases: accidents.filter(a => a.drunk_driving).length,
            total_service_points: servicePoints.length,
            total_health_facilities: healthFacilities.length
        };

        return NextResponse.json({
            success: true,
            hasActiveSession: true,
            activeSession: activeSession,
            accidents: accidents,
            servicePoints: servicePoints,
            healthFacilities: healthFacilities,
            stats: stats
        });

    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะพื้นที่อุบัติเหตุ'
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
