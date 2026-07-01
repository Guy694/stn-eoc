import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { publicInternalError } from "@/lib/apiResponse";
import { clearCitizenSessionCookie } from "@/lib/citizenAuth";

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
        let body = {};
        try {
            body = await request.json();
        } catch {
            body = {};
        }

        const sessionToken = body.sessionToken || request.cookies.get('session_token')?.value;
        const ip_address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
        const user_agent = request.headers.get('user-agent') || 'unknown';

        if (!sessionToken) {
            const response = NextResponse.json({
                success: true,
                message: 'ออกจากระบบสำเร็จ'
            });
            clearCitizenSessionCookie(response);
            response.cookies.set('user_session', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 0,
                path: '/'
            });
            return response;
        }

        const connection = await pool.getConnection();

        try {
            // ดึงข้อมูล session ก่อนลบ
            const [sessions] = await connection.execute(
                'SELECT user_id, username FROM user_sessions WHERE session_token = ?',
                [sessionToken]
            );

            // ลบ session
            await connection.execute(
                'DELETE FROM user_sessions WHERE session_token = ?',
                [sessionToken]
            );

            // บันทึก security log
            if (sessions.length > 0) {
                await connection.execute(
                    `INSERT INTO security_logs (event_type, user_id, username, ip_address, user_agent, details, severity) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ['logout', sessions[0].user_id, sessions[0].username, ip_address, user_agent, 'User logged out', 'low']
                );
            }

            const response = NextResponse.json({
                success: true,
                message: 'ออกจากระบบสำเร็จ'
            });

            // ลบ cookie สำหรับ ThaiID session และ session_token
            response.cookies.set('user_session', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 0,
                path: '/'
            });

            response.cookies.set('session_token', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict',
                maxAge: 0,
                path: '/'
            });
            clearCitizenSessionCookie(response);

            return response;

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Logout error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
}
