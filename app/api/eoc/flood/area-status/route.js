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

// GET - ดึงข้อมูล flood status พร้อม polygon data
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const sessionId = searchParams.get('session_id');

        connection = await pool.getConnection();

        // ตรวจสอบ active session ก่อน
        const [activeSessions] = await connection.execute(`
            SELECT id, session_number, opened_at, open_reason
            FROM eoc_sessions 
            WHERE eoc_type = 'flood' AND status = 'active'
            ORDER BY opened_at DESC
            LIMIT 1
        `);

        if (activeSessions.length === 0) {
            return NextResponse.json({
                success: false,
                hasActiveSession: false,
                message: 'ไม่มี EOC Session ที่เปิดอยู่'
            });
        }

        const activeSession = activeSessions[0];
        const sessionYear = new Date(activeSession.opened_at).getFullYear();

        // สร้าง WHERE clause - ใช้ year แทน session_id
        let whereClause = 'f.year = ?';
        let params = [sessionYear];

        if (date) {
            whereClause += ' AND f.flood_start_date = ?';
            params.push(date);
        }

        // ดึงข้อมูล flood status จาก flood_records พร้อม village data
        const [floodData] = await connection.execute(`
            SELECT 
                f.id,
                f.polygon_id as vid,
                CASE 
                    WHEN f.flood_level IN ('สูง', 'สูงมาก') THEN 'severe'
                    WHEN f.flood_level = 'ปานกลาง' THEN 'moderate'
                    WHEN f.flood_level = 'ต่ำ' THEN 'mild'
                    ELSE 'safe'
                END as flood_level,
                f.status,
                ROUND(f.water_depth_cm / 100, 2) as water_level,
                f.affected_households,
                f.affected_people as affected_population,
                f.flood_start_date as recorded_day,
                f.description as notes,
                f.updated_at,
                v.villcode,
                v.villname,
                v.subdistnam as tambon,
                v.distname as district,
                v.num_hh as total_households,
                v.provname as province,
                ST_X(ST_Centroid(v.geom)) as lng,
                ST_Y(ST_Centroid(v.geom)) as lat,
                ST_AsGeoJSON(v.geom) as geometry
            FROM flood_records f
            INNER JOIN satun_village_polygon v ON f.polygon_id = v.id
            WHERE ${whereClause}
            ORDER BY f.flood_start_date DESC, f.updated_at DESC
        `, params);

        // แปลง GeoJSON geometry
        const processedData = floodData.map(item => ({
            ...item,
            geometry: item.geometry ? JSON.parse(item.geometry) : null
        }));

        // สถิติสรุป
        const [stats] = await connection.execute(`
            SELECT 
                COUNT(DISTINCT v.distname) as affected_districts,
                COUNT(DISTINCT v.subdistnam) as affected_tambons,
                COUNT(*) as affected_villages,
                SUM(f.affected_people) as total_population,
                SUM(CASE WHEN f.flood_level IN ('สูง', 'สูงมาก') THEN 1 ELSE 0 END) as severe_count,
                SUM(CASE WHEN f.flood_level = 'ปานกลาง' THEN 1 ELSE 0 END) as moderate_count,
                SUM(CASE WHEN f.flood_level = 'ต่ำ' THEN 1 ELSE 0 END) as mild_count,
                SUM(CASE WHEN f.flood_level = 'ไม่มี' THEN 1 ELSE 0 END) as safe_count
            FROM flood_records f
            INNER JOIN satun_village_polygon v ON f.polygon_id = v.id
            WHERE ${whereClause}
        `, params);

        return NextResponse.json({
            success: true,
            hasActiveSession: true,
            activeSession: activeSession,
            data: processedData,
            stats: stats[0] || {},
            count: processedData.length
        });

    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({
            success: false,
            error: error.message,
            hasActiveSession: false
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
