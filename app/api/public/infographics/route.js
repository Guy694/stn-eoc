import { NextResponse } from 'next/server';
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

export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('eocType');

        if (!eocType || !['flood', 'disease', 'accident'].includes(eocType)) {
            return NextResponse.json({
                success: false,
                message: 'ประเภท EOC ไม่ถูกต้อง'
            }, { status: 400 });
        }

        // ตรวจสอบว่ามีคอลัมน์ eoc_type หรือไม่
        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM announcements LIKE 'eoc_type'`
        );
        const hasEocType = columns.length > 0;

        let announcements;
        if (hasEocType) {
            // ดึงประกาศที่เปิดใช้งานและตรงกับ eoc_type
            [announcements] = await connection.execute(
                `SELECT 
                    id,
                    title,
                    description,
                    image_path,
                    priority,
                    created_at
                FROM announcements
                WHERE eoc_type = ? AND is_active = 1
                ORDER BY priority DESC, created_at DESC`,
                [eocType]
            );
        } else {
            // ถ้ายังไม่มี column eoc_type ให้ดึงทั้งหมด
            [announcements] = await connection.execute(
                `SELECT 
                    id,
                    title,
                    description,
                    image_path,
                    priority,
                    created_at
                FROM announcements
                WHERE is_active = 1
                ORDER BY priority DESC, created_at DESC`
            );
        }

        // แปลงเป็นรูปแบบที่ frontend ต้องการ
        const infographics = announcements.map((announcement) => ({
            id: announcement.id,
            image: announcement.image_path,
            alt: announcement.title || `Infographic ${announcement.id}`,
            title: announcement.title,
            description: announcement.description
        }));

        return NextResponse.json({
            success: true,
            data: infographics
        });

    } catch (error) {
        console.error('Get infographics error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด: ' + error.message,
            data: [] // Return empty array on error
        }, { status: 500 });
    } finally {
        connection.release();
    }
}
