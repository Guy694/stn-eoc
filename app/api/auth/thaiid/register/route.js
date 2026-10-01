import { NextResponse } from "next/server";
import { REGISTRATION_SESSION_COOKIE, setRegistrationSessionCookie, unsealRegistrationSession } from "@/lib/registrationSession";
import { notifySecurityEvent } from "@/lib/telegram";
import { getPool } from "@/lib/db";
import { getClientIp } from "@/lib/clientIp";

const pool = getPool();

export async function POST(request) {
    try {
        // ดึงข้อมูล session
        const userSession = request.cookies.get(REGISTRATION_SESSION_COOKIE)?.value;

        if (!userSession) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบข้อมูล session' },
                { status: 401 }
            );
        }

        let userData;
        try {
            userData = unsealRegistrationSession(userSession);
        } catch {
            void notifySecurityEvent('tampered_registration_session', {
                ip: getClientIp(request),
                path: '/api/auth/thaiid/register'
            });
            return NextResponse.json({ success: false, message: 'Session ไม่ถูกต้อง กรุณายืนยันตัวตนใหม่' }, { status: 401 });
        }
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

            setRegistrationSessionCookie(response, updatedUserData);

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
