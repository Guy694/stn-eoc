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

// GET - ดึงข้อมูลสรุปความเสี่ยงอุทกภัยน้ำท่วมรายวัน
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

        connection = await pool.getConnection();

        // ดึง session ที่ active
        const [sessionResult] = await connection.execute(`
            SELECT id FROM eoc_sessions 
            WHERE eoc_type = 'flood' AND status = 'active' 
            LIMIT 1
        `);

        if (!sessionResult.length) {
            return NextResponse.json({
                success: false,
                message: 'ไม่มี EOC Session ที่เปิดอยู่'
            }, { status: 404 });
        }

        const sessionId = sessionResult[0].id;

        // สรุปตามระดับความเสี่ยง
        const [riskSummary] = await connection.execute(`
            SELECT 
                f.flood_level,
                f.status,
                COUNT(*) as village_count,
                SUM(f.affected_households) as total_households,
                SUM(f.affected_people) as total_population,
                AVG(f.water_depth_cm) as avg_water_level,
                MAX(f.water_depth_cm) as max_water_level
            FROM flood_records f
            WHERE f.year = YEAR(?) AND f.updated_at >= DATE(?)
            GROUP BY f.flood_level, f.status
            ORDER BY FIELD(f.flood_level, 'สูงมาก', 'สูง', 'ปานกลาง', 'ต่ำ', 'ไม่มี')
        `, [date, date]);

        // สรุปตามอำเภอ
        const [districtSummary] = await connection.execute(`
            SELECT 
                f.district,
                COUNT(DISTINCT f.tambon) as tambon_count,
                COUNT(*) as village_count,
                SUM(f.affected_households) as total_households,
                SUM(f.affected_people) as total_population,
                MAX(CASE WHEN f.flood_level IN ('สูงมาก', 'สูง') THEN 1 ELSE 0 END) as has_severe,
                MAX(CASE WHEN f.flood_level = 'ปานกลาง' THEN 1 ELSE 0 END) as has_moderate,
                AVG(f.water_depth_cm) as avg_water_level
            FROM flood_records f
            WHERE f.year = YEAR(?) AND f.updated_at >= DATE(?)
            GROUP BY f.district
            ORDER BY has_severe DESC, has_moderate DESC, total_population DESC
        `, [date, date]);

        // รายละเอียดทั้งหมด
        const [details] = await connection.execute(`
            SELECT 
                f.id,
                f.district,
                f.tambon,
                f.village,
                f.flood_level,
                f.status,
                f.water_depth_cm,
                f.affected_households,
                f.affected_people,
                f.description as notes,
                f.updated_at
            FROM flood_records f
            WHERE f.year = YEAR(?) AND f.updated_at >= DATE(?)
            ORDER BY 
                FIELD(f.flood_level, 'สูงมาก', 'สูง', 'ปานกลาง', 'ต่ำ', 'ไม่มี'),
                f.district, f.tambon, f.village
        `, [date, date]);

        // สถิติรวม
        const [totalStats] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT f.district) as affected_districts,
                COUNT(DISTINCT CONCAT(f.district, '-', f.tambon)) as affected_tambons,
                COUNT(*) as affected_villages,
                SUM(f.affected_households) as total_households,
                SUM(f.affected_people) as total_population,
                SUM(CASE WHEN f.flood_level IN ('สูงมาก', 'สูง') THEN 1 ELSE 0 END) as severe_count,
                SUM(CASE WHEN f.flood_level = 'ปานกลาง' THEN 1 ELSE 0 END) as moderate_count,
                SUM(CASE WHEN f.flood_level = 'ต่ำ' THEN 1 ELSE 0 END) as mild_count,
                SUM(CASE WHEN f.flood_level = 'ไม่มี' THEN 1 ELSE 0 END) as safe_count
            FROM flood_records f
            WHERE f.year = YEAR(?) AND f.updated_at >= DATE(?)
        `, [date, date]);

        // EOC Session ที่เปิดอยู่
        const [activeSession] = await connection.execute(`
            SELECT 
                id,
                session_number,
                opened_at,
                open_reason,
                total_activities,
                total_data_entries,
                TIMESTAMPDIFF(HOUR, opened_at, NOW()) as hours_open,
                TIMESTAMPDIFF(DAY, opened_at, NOW()) as days_open
            FROM eoc_sessions
            WHERE id = ?
        `, [sessionId]);

        return NextResponse.json({
            success: true,
            date: date,
            session_id: sessionId,
            totalStats: totalStats[0] || {},
            riskSummary: riskSummary,
            districtSummary: districtSummary,
            details: details,
            activeSession: activeSession[0] || null
        });

    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสรุปความเสี่ยงอุทกภัยน้ำท่วมรายวัน'
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
