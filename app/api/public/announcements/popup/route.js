import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

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

// GET - ดึงแบนเนอร์สำหรับแสดง popup (1 รายการล่าสุด)
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const now = new Date();

        // ดึงแบนเนอร์ที่:
        // 1. is_active = true
        // 2. show_popup = true
        // 3. อยู่ในช่วงวันที่แสดง (ถ้ามีกำหนด)
        // 4. เรียงตาม priority สูงสุดและล่าสุด
        const [announcements] = await connection.execute(
            `SELECT 
                id,
                title,
                description,
                image_path,
                priority,
                start_date,
                end_date
            FROM announcements
            WHERE is_active = 1 
            AND show_popup = 1
            AND (start_date IS NULL OR start_date <= ?)
            AND (end_date IS NULL OR end_date >= ?)
            ORDER BY priority DESC, created_at DESC
            LIMIT 1`,
            [now, now]
        );

        if (announcements.length === 0) {
            return NextResponse.json({
                success: true,
                data: null
            });
        }

        return NextResponse.json({
            success: true,
            data: announcements[0]
        });

    } catch (error) {
        console.error('Error fetching popup announcement:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
