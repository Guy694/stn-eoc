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

async function ensureSiteStatistics(connection) {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS site_statistics (
            metric_key VARCHAR(64) PRIMARY KEY,
            metric_value BIGINT UNSIGNED NOT NULL DEFAULT 0,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
    `);
}

async function readTotalVisits(connection) {
    const [rows] = await connection.execute(
        `SELECT metric_value
         FROM site_statistics
         WHERE metric_key = 'total_visits'
         LIMIT 1`
    );
    return Number(rows[0]?.metric_value || 0);
}

export async function GET() {
    const connection = await pool.getConnection();

    try {
        await ensureSiteStatistics(connection);
        return NextResponse.json({
            success: true,
            data: { total_visits: await readTotalVisits(connection) }
        });
    } catch (error) {
        console.error('Get site views error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงยอดเข้าชมเว็บไซต์');
    } finally {
        connection.release();
    }
}

export async function POST() {
    const connection = await pool.getConnection();

    try {
        await ensureSiteStatistics(connection);
        await connection.execute(`
            INSERT INTO site_statistics (metric_key, metric_value)
            VALUES ('total_visits', 1)
            ON DUPLICATE KEY UPDATE metric_value = metric_value + 1
        `);

        return NextResponse.json({
            success: true,
            data: { total_visits: await readTotalVisits(connection) }
        });
    } catch (error) {
        console.error('Record site view error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกยอดเข้าชมเว็บไซต์');
    } finally {
        connection.release();
    }
}

