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

// GET - ดึงสถิติรายวันสำหรับ Chart.js
export async function GET(request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');

        if (!sessionId) {
            return NextResponse.json({
                success: false,
                message: 'session_id is required'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        // ดึงสถิติรายวัน
        const [dailyData] = await connection.execute(`
            SELECT 
                report_date,
                COUNT(*) as accidents,
                COALESCE(SUM(deaths), 0) as deaths,
                COALESCE(SUM(injuries), 0) as injuries,
                SUM(CASE WHEN drunk_driving = 1 THEN 1 ELSE 0 END) as drunk_cases,
                SUM(CASE WHEN no_helmet = 1 THEN 1 ELSE 0 END) as no_helmet_cases,
                SUM(CASE WHEN speeding = 1 THEN 1 ELSE 0 END) as speeding_cases
            FROM accident_reports 
            WHERE session_id = ?
            GROUP BY report_date
            ORDER BY report_date ASC
        `, [sessionId]);

        // ดึงสถิติตามช่วงเวลา (เช้า/บ่าย/เย็น/กลางคืน)
        const [timeData] = await connection.execute(`
            SELECT 
                CASE 
                    WHEN HOUR(report_time) BETWEEN 6 AND 11 THEN 'เช้า (06-12)'
                    WHEN HOUR(report_time) BETWEEN 12 AND 17 THEN 'บ่าย (12-18)'
                    WHEN HOUR(report_time) BETWEEN 18 AND 23 THEN 'เย็น/ค่ำ (18-24)'
                    ELSE 'กลางคืน (00-06)'
                END as time_period,
                COUNT(*) as count
            FROM accident_reports 
            WHERE session_id = ? AND report_time IS NOT NULL
            GROUP BY time_period
            ORDER BY MIN(HOUR(report_time))
        `, [sessionId]);

        return NextResponse.json({
            success: true,
            dailyData: dailyData.map(d => ({
                ...d,
                report_date: d.report_date ? new Date(d.report_date).toISOString().split('T')[0] : null
            })),
            timeDistribution: timeData
        });

    } catch (error) {
        console.error('Daily summary error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงสรุปรายวันของเทศกาล');
    } finally {
        if (connection) connection.release();
    }
}
