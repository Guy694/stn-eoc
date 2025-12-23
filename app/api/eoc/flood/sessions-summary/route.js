import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

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

// GET - ดึงสรุป flood sessions แยกตามปี พร้อมสถิติ
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year'); // ปีที่ต้องการ (ถ้าไม่ระบุจะให้ทั้งหมด)

        connection = await pool.getConnection();

        // ดึงรายการปีที่มี flood sessions
        const [years] = await connection.execute(`
            SELECT DISTINCT YEAR(opened_at) as year
            FROM eoc_sessions
            WHERE eoc_type = 'flood'
            ORDER BY year DESC
        `);

        // ถ้าระบุปีมา ให้ดึงข้อมูลเฉพาะปีนั้น
        if (year) {
            // ดึง sessions ในปีนั้น
            const [sessions] = await connection.execute(`
                SELECT 
                    s.id,
                    s.session_number,
                    s.opened_at,
                    s.closed_at,
                    s.open_reason,
                    s.close_reason,
                    s.duration_hours,
                    s.status,
                    s.total_activities,
                    s.total_data_entries,
                    s.affected_areas,
                    s.summary,
                    oo.full_name as opened_by_name,
                    co.full_name as closed_by_name
                FROM eoc_sessions s
                LEFT JOIN officer oo ON s.opened_by = oo.id
                LEFT JOIN officer co ON s.closed_by = co.id
                WHERE s.eoc_type = 'flood' 
                    AND YEAR(s.opened_at) = ?
                ORDER BY s.opened_at DESC
            `, [year]);

            // คำนวณสถิติสรุปของปี
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_sessions,
                    SUM(duration_hours) as total_hours,
                    SUM(total_activities) as total_activities,
                    SUM(total_data_entries) as total_data_entries,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_sessions
                FROM eoc_sessions
                WHERE eoc_type = 'flood' 
                    AND YEAR(opened_at) = ?
            `, [year]);

            // ดึงข้อมูลพื้นที่ที่ได้รับผลกระทบจาก flood_area_status JOIN satun_village_polygon
            const [affectedAreas] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT v.id) as total_villages,
                    COUNT(DISTINCT v.subdistnam) as total_tambons,
                    COUNT(DISTINCT v.distname) as total_districts
                FROM flood_area_status f
                INNER JOIN satun_village_polygon v ON f.vid = v.id
                INNER JOIN eoc_sessions s ON f.session_id = s.id
                WHERE s.eoc_type = 'flood' AND YEAR(s.opened_at) = ?
            `, [year]);

            return NextResponse.json({
                success: true,
                year: parseInt(year),
                summary: {
                    ...stats[0],
                    ...affectedAreas[0],
                    total_hours: parseFloat(stats[0].total_hours || 0),
                },
                sessions: sessions.map(s => ({
                    ...s,
                    affected_areas: s.affected_areas ? JSON.parse(s.affected_areas) : null,
                    duration_hours: parseFloat(s.duration_hours || 0)
                }))
            });
        }

        // ถ้าไม่ระบุปี ให้สรุปแต่ละปี
        const yearSummaries = await Promise.all(
            years.map(async ({ year }) => {
                const [stats] = await connection.execute(`
                    SELECT 
                        COUNT(*) as total_sessions,
                        SUM(duration_hours) as total_hours,
                        SUM(total_activities) as total_activities,
                        SUM(total_data_entries) as total_data_entries,
                        SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
                        SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_sessions,
                        MIN(opened_at) as first_opened,
                        MAX(opened_at) as last_opened
                    FROM eoc_sessions
                    WHERE eoc_type = 'flood' 
                        AND YEAR(opened_at) = ?
                `, [year]);

                return {
                    year,
                    ...stats[0],
                    total_hours: parseFloat(stats[0].total_hours || 0)
                };
            })
        );

        return NextResponse.json({
            success: true,
            availableYears: years.map(y => y.year),
            yearSummaries: yearSummaries
        });

    } catch (error) {
        console.error('Database error:', error);

        // ส่งข้อมูลจำลองกรณี error (สำหรับ development)
        const mockData = {
            success: true,
            useMockData: true,
            availableYears: [2025, 2024, 2023],
            yearSummaries: [
                {
                    year: 2025,
                    total_sessions: 3,
                    total_hours: 456.5,
                    total_activities: 145,
                    total_data_entries: 892,
                    active_sessions: 1,
                    closed_sessions: 2,
                    first_opened: '2025-01-15T08:00:00',
                    last_opened: '2025-11-20T14:30:00'
                },
                {
                    year: 2024,
                    total_sessions: 5,
                    total_hours: 1234.2,
                    total_activities: 456,
                    total_data_entries: 2341,
                    active_sessions: 0,
                    closed_sessions: 5,
                    first_opened: '2024-02-10T09:00:00',
                    last_opened: '2024-12-05T16:00:00'
                },
                {
                    year: 2023,
                    total_sessions: 4,
                    total_hours: 876.8,
                    total_activities: 298,
                    total_data_entries: 1567,
                    active_sessions: 0,
                    closed_sessions: 4,
                    first_opened: '2023-03-22T10:00:00',
                    last_opened: '2023-11-18T13:00:00'
                }
            ]
        };

        return NextResponse.json(mockData);
    } finally {
        if (connection) connection.release();
    }
}
