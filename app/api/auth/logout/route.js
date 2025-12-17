import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

export async function POST(request) {
    try {
        const { sessionToken } = await request.json();

        if (!sessionToken) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ session token' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();

        try {
            // ลบ session
            await connection.execute(
                'DELETE FROM user_sessions WHERE session_token = ?',
                [sessionToken]
            );

            return NextResponse.json({
                success: true,
                message: 'ออกจากระบบสำเร็จ'
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Logout error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการออกจากระบบ',
                error: error.message
            },
            { status: 500 }
        );
    }
}
