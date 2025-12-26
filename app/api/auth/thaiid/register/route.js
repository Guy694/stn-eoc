import { NextResponse } from "next/server";
import { cookies } from "next/headers";
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
        // ดึงข้อมูล session
        const cookieStore = await cookies();
        const userSession = cookieStore.get('user_session');

        if (!userSession) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบข้อมูล session' },
                { status: 401 }
            );
        }

        const userData = JSON.parse(userSession.value);
        const { position, department, requested_role, phone, email } = await request.json();

        // Validate
        if (!position || !department || !requested_role || !phone || !email) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
                { status: 400 }
            );
        }

        // อัปเดตข้อมูลในฐานข้อมูล
        const connection = await pool.getConnection();

        try {
            await connection.execute(
                `UPDATE officer 
                SET position = ?, department = ?, requested_role = ?, 
                    phone = ?, email = ?, request_time = NOW() 
                WHERE id = ?`,
                [position, department, requested_role, phone, email, userData.id]
            );

            connection.release();

            // อัปเดต session
            const updatedUserData = {
                ...userData,
                position,
                department,
                requested_role,
                phone,
                email
            };

            const response = NextResponse.json({
                success: true,
                message: 'ส่งคำขอเข้าใช้งานเรียบร้อยแล้ว'
            });

            response.cookies.set('user_session', JSON.stringify(updatedUserData), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24
            });

            return response;

        } catch (dbError) {
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('Registration error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล' },
            { status: 500 }
        );
    }
}
