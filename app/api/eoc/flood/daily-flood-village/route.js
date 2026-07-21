import { NextResponse } from 'next/server';
import { publicInternalError } from '@/lib/apiResponse';
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

function mapFloodLevelToSeverity(level) {
    const value = String(level || '').trim();
    if (value === 'สูงมาก' || value === 'สูง' || value.toLowerCase() === 'severe') return 'severe';
    if (value === 'ปานกลาง' || value.toLowerCase() === 'moderate') return 'moderate';
    if (value === 'ต่ำ' || value.toLowerCase() === 'mild') return 'mild';
    return 'safe';
}

// API สำหรับดึงข้อมูลพื้นที่อุทกภัยน้ำท่วมรายวัน (ระดับหมู่บ้าน)
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const dateParam = searchParams.get('date');

        if (!dateParam) {
            return NextResponse.json(
                { error: 'Date parameter is required' },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [sessionRows] = await connection.execute(
            `SELECT id
             FROM eoc_sessions
             WHERE eoc_type = 'flood' AND status = 'active'
             ORDER BY opened_at DESC
             LIMIT 1`
        );

        if (!sessionRows.length) {
            return NextResponse.json({
                success: false,
                message: 'ไม่มี EOC Session อุทกภัยน้ำท่วมที่เปิดอยู่'
            }, { status: 404 });
        }

        const sessionId = sessionRows[0].id;

        const [rows] = await connection.execute(
            `SELECT
                v.villcode,
                v.villname as name,
                v.distname as district,
                f.flood_level,
                f.affected_people
             FROM flood_records f
             INNER JOIN satun_village_polygon v ON v.id = f.polygon_id
             WHERE f.session_id = ?
               AND DATE(f.updated_at) = ?
             ORDER BY v.distname, v.subdistnam, v.villname`,
            [sessionId, dateParam]
        );

        const result = rows.map((row) => ({
            villcode: row.villcode,
            name: row.name,
            district: row.district,
            level: mapFloodLevelToSeverity(row.flood_level),
            population: Number(row.affected_people || 0)
        }));

        // คำนวณสถิติสรุป
        const summary = {
            totalAffected: 0,
            severeCount: 0,
            moderateCount: 0,
            mildCount: 0,
            totalPopulation: 0
        };

        result.forEach(v => {
            if (v.level !== 'safe') {
                summary.totalAffected++;
                summary.totalPopulation += v.population;

                if (v.level === 'severe') summary.severeCount++;
                else if (v.level === 'moderate') summary.moderateCount++;
                else if (v.level === 'mild') summary.mildCount++;
            }
        });

        return NextResponse.json({
            success: true,
            date: dateParam,
            session_id: sessionId,
            villages: result,
            summary: summary
        });

    } catch (error) {
        console.error('Error fetching daily flood village data:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลอุทกภัยน้ำท่วมรายหมู่บ้าน');
    } finally {
        if (connection) connection.release();
    }
}
