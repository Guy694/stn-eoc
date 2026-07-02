import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { publicInternalError } from '@/lib/apiResponse';

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

async function hasSessionColumn(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'public_incident_reports'
           AND COLUMN_NAME = 'session_id'`
    );
    return columns.length > 0;
}

// GET - ดึงข้อมูลรายงานที่ verified แล้วตาม disaster_type
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const disasterType = searchParams.get('disaster_type') || 'flood';
        const sessionId = searchParams.get('session_id');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');

        connection = await pool.getConnection();
        const canFilterBySession = sessionId && await hasSessionColumn(connection);

        let whereClause = 'status = ? AND disaster_type = ?';
        let params = ['verified', disasterType];

        if (canFilterBySession) {
            whereClause += ' AND session_id = ?';
            params.push(sessionId);
        }

        if (startDate) {
            whereClause += ' AND DATE(occurred_at) >= ?';
            params.push(startDate);
        }

        if (endDate) {
            whereClause += ' AND DATE(occurred_at) <= ?';
            params.push(endDate);
        }

        const [incidents] = await connection.execute(`
            SELECT 
                id,
                first_name,
                last_name,
                phone,
                village,
                sub_district,
                district,
                latitude,
                longitude,
                description,
                water_level,
                affected_people,
                urgency,
                travel_status,
                report_type,
                occurred_at,
                disaster_type,
                photo_path,
                status,
                reported_at,
                reviewed_at
            FROM public_incident_reports
            WHERE ${whereClause}
            ORDER BY occurred_at DESC
        `, params);

        return NextResponse.json({
            success: true,
            data: incidents,
            count: incidents.length
        });

    } catch (error) {
        console.error('Error fetching verified incidents:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงรายงานที่ตรวจสอบแล้ว');
    } finally {
        if (connection) connection.release();
    }
}
