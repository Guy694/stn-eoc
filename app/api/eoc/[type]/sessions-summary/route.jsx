import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { DISASTER_TYPES } from "@/lib/disasterConfig";

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

// GET - ดึงสรุป EOC sessions แยกตามปี สำหรับภัยพิบัติทุกประเภท
export async function GET(request, { params }) {
    let connection;

    try {
        const disasterType = params.type; // flood, drought, disease, etc.
        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');

        // Validate disaster type
        if (!Object.values(DISASTER_TYPES).includes(disasterType)) {
            return NextResponse.json({
                success: false,
                error: 'Invalid disaster type'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        // ดึงรายการปีที่มี sessions
        const [years] = await connection.execute(`
            SELECT DISTINCT YEAR(opened_at) as year
            FROM eoc_sessions
            WHERE eoc_type = ?
            ORDER BY year DESC
        `, [disasterType]);

        // ถ้าระบุปีมา ให้ดึงข้อมูลเฉพาะปีนั้น
        if (year) {
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
                    oo.title as opened_by_title,
                    oo.given_name as opened_by_given_name,
                    oo.family_name as opened_by_family_name,
                    co.title as closed_by_title,
                    co.given_name as closed_by_given_name,
                    co.family_name as closed_by_family_name
                FROM eoc_sessions s
                LEFT JOIN officer oo ON s.opened_by = oo.id
                LEFT JOIN officer co ON s.closed_by = co.id
                WHERE s.eoc_type = ? AND YEAR(s.opened_at) = ?
                ORDER BY s.opened_at DESC
            `, [disasterType, year]);

            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_sessions,
                    SUM(duration_hours) as total_hours,
                    SUM(total_activities) as total_activities,
                    SUM(total_data_entries) as total_data_entries,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_sessions
                FROM eoc_sessions
                WHERE eoc_type = ? AND YEAR(opened_at) = ?
            `, [disasterType, year]);

            return NextResponse.json({
                success: true,
                disasterType: disasterType,
                year: parseInt(year),
                summary: {
                    ...stats[0],
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
                    WHERE eoc_type = ? AND YEAR(opened_at) = ?
                `, [disasterType, year]);

                return {
                    year,
                    ...stats[0],
                    total_hours: parseFloat(stats[0].total_hours || 0)
                };
            })
        );

        return NextResponse.json({
            success: true,
            disasterType: disasterType,
            availableYears: years.map(y => y.year),
            yearSummaries: yearSummaries
        });

    } catch (error) {
        console.error('Database error:', error);

        // Mock data for development
        const disasterType = params.type;
        return NextResponse.json({
            success: true,
            useMockData: true,
            disasterType: disasterType,
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
                }
            ]
        });
    } finally {
        if (connection) connection.release();
    }
}
