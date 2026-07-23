import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { requireAuth } from "@/lib/auth";

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
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;
        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year'); // ปีที่ต้องการ (ถ้าไม่ระบุจะให้ทั้งหมด)

        connection = await pool.getConnection();
        const privileged = ['admin', 'commander'].includes(auth.user.role);
        const membershipClause = privileged ? '' : `
            AND EXISTS (
                SELECT 1
                FROM eoc_session_teams access_team
                JOIN eoc_teams access_team_definition
                  ON access_team_definition.id = access_team.team_id
                 AND UPPER(access_team_definition.team_code) = 'SAT'
                JOIN eoc_team_members access_member
                  ON access_member.session_team_id = access_team.id
                 AND access_member.officer_id = ?
                 AND access_member.is_active = TRUE
                WHERE access_team.eoc_session_id = s.id
                  AND access_team.is_active = TRUE
            )`;
        const membershipParams = privileged ? [] : [auth.user.id];

        // ดึงรายการปีที่มี flood sessions
        const [years] = await connection.execute(`
            SELECT DISTINCT YEAR(s.opened_at) as year
            FROM eoc_sessions s
            WHERE s.eoc_type = 'flood'
            ${membershipClause}
            ORDER BY year DESC
        `, membershipParams);

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
                    DATE_FORMAT(
                        COALESCE(
                            MAX(CASE WHEN fr.flood_level <> 'ไม่มี' THEN fr.flood_start_date END),
                            MAX(fr.flood_start_date)
                        ),
                        '%Y-%m-%d'
                    ) as latest_flood_record_date,
                    COUNT(fr.id) as flood_record_count,
                    oo.title as opened_by_title,
                    oo.given_name as opened_by_given_name,
                    oo.family_name as opened_by_family_name,
                    co.title as closed_by_title,
                    co.given_name as closed_by_given_name,
                    co.family_name as closed_by_family_name
                FROM eoc_sessions s
                LEFT JOIN officer oo ON s.opened_by = oo.id
                LEFT JOIN officer co ON s.closed_by = co.id
                LEFT JOIN flood_records fr ON fr.session_id = s.id
                WHERE s.eoc_type = 'flood'
                    AND YEAR(s.opened_at) = ?
                    ${membershipClause}
                GROUP BY
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
                    oo.title,
                    oo.given_name,
                    oo.family_name,
                    co.title,
                    co.given_name,
                    co.family_name
                ORDER BY s.opened_at DESC
            `, [year, ...membershipParams]);

            // คำนวณสถิติสรุปของปี
            const [stats] = await connection.execute(`
                SELECT 
                    COUNT(*) as total_sessions,
                    SUM(duration_hours) as total_hours,
                    SUM(total_activities) as total_activities,
                    SUM(total_data_entries) as total_data_entries,
                    SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) as active_sessions,
                    SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) as closed_sessions
                FROM eoc_sessions s
                WHERE s.eoc_type = 'flood'
                    AND YEAR(s.opened_at) = ?
                    ${membershipClause}
            `, [year, ...membershipParams]);

            // ดึงข้อมูลพื้นที่ที่ได้รับผลกระทบจาก flood_records JOIN satun_village_polygon
            const [affectedAreas] = await connection.execute(`
                SELECT 
                    COUNT(DISTINCT v.id) as total_villages,
                    COUNT(DISTINCT v.subdistnam) as total_tambons,
                    COUNT(DISTINCT v.distname) as total_districts
                FROM flood_records f
                INNER JOIN satun_village_polygon v ON f.polygon_id = v.id
                INNER JOIN eoc_sessions s ON f.session_id = s.id
                WHERE s.eoc_type = 'flood' AND YEAR(s.opened_at) = ?
                ${membershipClause}
            `, [year, ...membershipParams]);

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
                    opened_by_name: s.opened_by_title && s.opened_by_given_name && s.opened_by_family_name
                        ? `${s.opened_by_title}${s.opened_by_given_name} ${s.opened_by_family_name}`
                        : `User ID: ${s.opened_by}`,
                    closed_by_name: s.closed_by_title && s.closed_by_given_name && s.closed_by_family_name
                        ? `${s.closed_by_title}${s.closed_by_given_name} ${s.closed_by_family_name}`
                        : s.closed_by ? `User ID: ${s.closed_by}` : null,
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
                    FROM eoc_sessions s
                    WHERE s.eoc_type = 'flood'
                        AND YEAR(s.opened_at) = ?
                        ${membershipClause}
                `, [year, ...membershipParams]);

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
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุป sessions ของอุทกภัยน้ำท่วม'
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
