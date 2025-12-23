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

// GET - ดึงข้อมูลสรุปความเสี่ยงน้ำท่วมรายวัน
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
                SUM(f.affected_population) as total_population,
                AVG(f.water_level) as avg_water_level,
                MAX(f.water_level) as max_water_level
            FROM flood_area_status f
            WHERE f.session_id = ? AND f.recorded_day = ?
            GROUP BY f.flood_level, f.status
            ORDER BY FIELD(f.flood_level, 'severe', 'moderate', 'mild', 'safe')
        `, [sessionId, date]);

        // สรุปตามอำเภอ
        const [districtSummary] = await connection.execute(`
            SELECT 
                v.distname as district,
                COUNT(DISTINCT v.subdistnam) as tambon_count,
                COUNT(*) as village_count,
                SUM(f.affected_households) as total_households,
                SUM(f.affected_population) as total_population,
                MAX(CASE WHEN f.flood_level = 'severe' THEN 1 ELSE 0 END) as has_severe,
                MAX(CASE WHEN f.flood_level = 'moderate' THEN 1 ELSE 0 END) as has_moderate,
                AVG(f.water_level) as avg_water_level
            FROM flood_area_status f
            INNER JOIN satun_village_polygon v ON f.vid = v.id
            WHERE f.session_id = ? AND f.recorded_day = ?
            GROUP BY v.distname
            ORDER BY has_severe DESC, has_moderate DESC, total_population DESC
        `, [sessionId, date]);

        // รายละเอียดทั้งหมด
        const [details] = await connection.execute(`
            SELECT 
                f.id,
                v.distname as district,
                v.subdistnam as tambon,
                v.villname as village,
                v.villcode as village_code,
                f.flood_level,
                f.status,
                f.water_level,
                f.affected_households,
                f.affected_population,
                f.notes,
                f.updated_at,
                ST_X(ST_Centroid(v.geom)) as lng,
                ST_Y(ST_Centroid(v.geom)) as lat
            FROM flood_area_status f
            INNER JOIN satun_village_polygon v ON f.vid = v.id
            WHERE f.session_id = ? AND f.recorded_day = ?
            ORDER BY 
                FIELD(f.flood_level, 'severe', 'moderate', 'mild', 'safe'),
                v.distname, v.subdistnam, v.villname
        `, [sessionId, date]);

        // สถิติรวม
        const [totalStats] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT v.distname) as affected_districts,
                COUNT(DISTINCT CONCAT(v.distname, '-', v.subdistnam)) as affected_tambons,
                COUNT(*) as affected_villages,
                SUM(f.affected_households) as total_households,
                SUM(f.affected_population) as total_population,
                SUM(CASE WHEN f.flood_level = 'severe' THEN 1 ELSE 0 END) as severe_count,
                SUM(CASE WHEN f.flood_level = 'moderate' THEN 1 ELSE 0 END) as moderate_count,
                SUM(CASE WHEN f.flood_level = 'mild' THEN 1 ELSE 0 END) as mild_count,
                SUM(CASE WHEN f.flood_level = 'safe' THEN 1 ELSE 0 END) as safe_count
            FROM flood_area_status f
            INNER JOIN satun_village_polygon v ON f.vid = v.id
            WHERE f.session_id = ? AND f.recorded_day = ?
        `, [sessionId, date]);

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

        // Mock data สำหรับ development
        return NextResponse.json({
            success: true,
            useMockData: true,
            date: new Date().toISOString().split('T')[0],
            totalStats: {
                affected_districts: 5,
                affected_tambons: 7,
                affected_villages: 7,
                total_households: 303,
                total_population: 1212,
                severe_count: 0,
                moderate_count: 1,
                mild_count: 4,
                safe_count: 2
            },
            riskSummary: [
                { flood_level: 'moderate', village_count: 1, total_households: 85, total_population: 340, avg_water_level: 52 },
                { flood_level: 'mild', village_count: 4, total_households: 193, total_population: 772, avg_water_level: 28.5 },
                { flood_level: 'safe', village_count: 2, total_households: 25, total_population: 100, avg_water_level: 6.5 }
            ],
            districtSummary: [
                { district: 'ควนโดน', village_count: 1, total_households: 85, total_population: 340, has_severe: 0, has_moderate: 1 },
                { district: 'ท่าแพ', village_count: 1, total_households: 58, total_population: 232, has_severe: 0, has_moderate: 0 },
                { district: 'เมืองสตูล', village_count: 3, total_households: 100, total_population: 400, has_severe: 0, has_moderate: 0 },
                { district: 'ละงู', village_count: 1, total_households: 45, total_population: 180, has_severe: 0, has_moderate: 0 },
                { district: 'มะนัง', village_count: 1, total_households: 15, total_population: 60, has_severe: 0, has_moderate: 0 }
            ],
            activeSession: {
                id: 3,
                session_number: 3,
                opened_at: '2025-12-18T09:00:00.000Z',
                open_reason: 'ฝนตกหนักต่อเนื่องตามฤดูมรสุมตะวันออกเฉียงเหนือ',
                total_activities: 23,
                total_data_entries: 187,
                hours_open: 96,
                days_open: 4
            }
        });
    } finally {
        if (connection) connection.release();
    }
}
