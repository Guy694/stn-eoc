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

function parseGeoJsonValue(value) {
    if (!value) return null;

    if (Buffer.isBuffer(value)) {
        const text = value.toString('utf8');
        return text ? JSON.parse(text) : null;
    }

    if (typeof value === 'string') {
        return JSON.parse(value);
    }

    return value;
}

function toDateKey(value) {
    if (!value) return null;
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return null;
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// GET - ดึงข้อมูล flood status พร้อม polygon data
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const sessionId = searchParams.get('session_id');

        connection = await pool.getConnection();

        let sessionQuery = `
            SELECT id, session_number, opened_at, closed_at, open_reason, status
            FROM eoc_sessions 
            WHERE LOWER(eoc_type) = 'flood'
        `;
        const sessionParams = [];

        if (sessionId) {
            sessionQuery += ' AND id = ?';
            sessionParams.push(sessionId);
        } else {
            sessionQuery += " AND status = 'active'";
        }

        sessionQuery += ' ORDER BY opened_at DESC LIMIT 1';
        const [activeSessions] = await connection.execute(sessionQuery, sessionParams);

        if (activeSessions.length === 0) {
            // ลองตรวจสอบว่ามี session อะไรบ้างในระบบ (สำหรับ debug)
            const [allFloodSessions] = await connection.execute(`
                SELECT id, eoc_type, status, session_number, opened_at 
                FROM eoc_sessions 
                WHERE LOWER(eoc_type) LIKE '%flood%'
                ORDER BY opened_at DESC
                LIMIT 5
            `);
            return NextResponse.json({
                success: false,
                hasActiveSession: false,
                message: sessionId ? 'ไม่พบ EOC Session น้ำท่วมที่เลือก' : 'ไม่มี EOC Session ที่เปิดอยู่',
                debug: { allFloodSessions }
            });
        }

        const activeSession = activeSessions[0];
        const sessionYear = new Date(activeSession.opened_at).getFullYear();

        const targetSessionId = activeSession.id;

        // สร้าง WHERE clause - ใช้ session_id เป็นหลัก
        let whereClause = 'f.session_id = ?';
        let params = [targetSessionId];

        // ถ้าไม่ระบุวันที่ ให้หาวันที่ล่าสุดที่มีข้อมูล
        let targetDate = date;
        const [latestDate] = await connection.execute(`
            SELECT
                COALESCE(
                    MAX(CASE WHEN flood_level <> 'ไม่มี' THEN flood_start_date END),
                    MAX(flood_start_date)
                ) as latest_date
            FROM flood_records 
            WHERE session_id = ?
        `, [targetSessionId]);
        const latestRecordDate = toDateKey(latestDate[0]?.latest_date);
        if (!targetDate) {
            targetDate = latestDate[0]?.latest_date;
        }

        if (targetDate) {
            whereClause += ' AND DATE(f.flood_start_date) = ?';
            params.push(toDateKey(targetDate));
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
                COALESCE(ROUND(f.water_depth_cm / 100, 2), 0) as water_level,
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

        const processedData = floodData.map(item => ({
            ...item,
            water_level: parseFloat(item.water_level) || 0,
            geometry: parseGeoJsonValue(item.geometry)
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
            targetDate: toDateKey(targetDate),
            latestRecordDate,
            data: processedData,
            stats: stats[0] || {},
            count: processedData.length
        });

    } catch (error) {
        console.error('Database error:', error);
        return NextResponse.json({
            success: false,
            error: 'เกิดข้อผิดพลาดในการดึงสถานะพื้นที่น้ำท่วม',
            hasActiveSession: false
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
