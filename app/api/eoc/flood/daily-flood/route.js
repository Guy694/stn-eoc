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

const ALL_DISTRICTS = [
    'เมืองสตูล',
    'ควนโดน',
    'ควนกาหลง',
    'ท่าแพ',
    'ละงู',
    'ทุ่งหว้า',
    'มะนัง'
];

function mapFloodLevel(levelText) {
    const value = String(levelText || '').trim();
    if (value === 'สูงมาก' || value === 'สูง') return 'severe';
    if (value === 'ปานกลาง') return 'moderate';
    if (value === 'ต่ำ') return 'mild';
    return 'safe';
}

function levelRank(level) {
    if (level === 'severe') return 3;
    if (level === 'moderate') return 2;
    if (level === 'mild') return 1;
    return 0;
}

function summarizeDistrictRows(rows) {
    const byDistrict = new Map();

    for (const row of rows) {
        const district = row.district || 'ไม่ระบุ';
        const level = mapFloodLevel(row.flood_level);
        const record = byDistrict.get(district) || {
            name: district,
            level: 'safe',
            affectedArea: 0,
            population: 0
        };

        if (levelRank(level) > levelRank(record.level)) {
            record.level = level;
        }

        record.population += Number(row.affected_people || 0);
        byDistrict.set(district, record);
    }

    return ALL_DISTRICTS.map((name) => byDistrict.get(name) || {
        name,
        level: 'nodata',
        affectedArea: 0,
        population: 0
    });
}

function buildSummary(districts) {
    const summary = {
        totalAffected: 0,
        severeCount: 0,
        moderateCount: 0,
        mildCount: 0,
        totalPopulation: 0
    };

    for (const district of districts) {
        if (district.level === 'severe') {
            summary.severeCount += 1;
            summary.totalAffected += 1;
        } else if (district.level === 'moderate') {
            summary.moderateCount += 1;
            summary.totalAffected += 1;
        } else if (district.level === 'mild') {
            summary.mildCount += 1;
            summary.totalAffected += 1;
        }

        summary.totalPopulation += Number(district.population || 0);
    }

    return summary;
}

export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date') || new Date().toISOString().split('T')[0];

        connection = await pool.getConnection();

        const [sessionRows] = await connection.execute(
            `SELECT id
             FROM eoc_sessions
             WHERE eoc_type = 'flood'
               AND DATE(opened_at) <= ?
               AND (closed_at IS NULL OR DATE(closed_at) >= ?)
             ORDER BY opened_at DESC
             LIMIT 1`,
            [date, date]
        );

        if (!sessionRows.length) {
            return NextResponse.json({
                success: true,
                date,
                districts: ALL_DISTRICTS.map((name) => ({
                    name,
                    level: 'nodata',
                    affectedArea: 0,
                    population: 0
                })),
                summary: {
                    totalAffected: 0,
                    severeCount: 0,
                    moderateCount: 0,
                    mildCount: 0,
                    totalPopulation: 0
                }
            });
        }

        const sessionId = sessionRows[0].id;

        const [rows] = await connection.execute(
            `SELECT
                district,
                flood_level,
                affected_people
             FROM flood_records
             WHERE session_id = ?
               AND DATE(COALESCE(flood_start_date, updated_at)) = ?`,
            [sessionId, date]
        );

        const districts = summarizeDistrictRows(rows);

        return NextResponse.json({
            success: true,
            date,
            session_id: sessionId,
            districts,
            summary: buildSummary(districts)
        });
    } catch (error) {
        console.error('Error fetching daily flood data:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลรายวันอุทกภัยน้ำท่วม'
            },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
