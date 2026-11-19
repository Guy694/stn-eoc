import { NextResponse } from "next/server";
import { REGISTRATION_SESSION_COOKIE, setRegistrationSessionCookie, unsealRegistrationSession } from "@/lib/registrationSession";
import { notifySecurityEvent } from "@/lib/telegram";
import { getPool } from "@/lib/db";
import { getClientIp } from "@/lib/clientIp";
import { TEAM_ROLE_CODES } from "@/lib/eocRoles";

// บทบาทที่ขอได้ (เหมือนหน้าลงทะเบียนปกติ — ขอเป็น admin ไม่ได้)
const REQUESTABLE_ROLES = ["staff", "commander", ...TEAM_ROLE_CODES];

const pool = getPool();

export async function POST(request) {
    try {
        // ดึงข้อมูล session
        const userSession = request.cookies.get(REGISTRATION_SESSION_COOKIE)?.value;

        if (!userSession) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบข้อมูลการเข้าสู่ระบบ' },
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
            return NextResponse.json({ success: false, message: 'การเข้าสู่ระบบไม่ถูกต้อง กรุณายืนยันตัวตนใหม่' }, { status: 401 });
        }
        // ใช้ได้เฉพาะเจ้าหน้าที่ที่ยังไม่ได้รับอนุมัติ (คุกกี้ของประชาชนมี id ของตาราง citizens — ห้ามนำไปแก้ตาราง officer)
        if (userData?.userType !== 'officer' || !Number.isInteger(Number(userData?.id))) {
            return NextResponse.json({ success: false, message: 'การเข้าสู่ระบบไม่ถูกต้อง กรุณายืนยันตัวตนใหม่' }, { status: 403 });
        }
        const body = await request.json().catch(() => ({}));
        const clip = (value, max) => String(value ?? '').trim().slice(0, max);
        const position = clip(body.position, 150);
        const department = clip(body.department, 191);
        const requested_role = clip(body.requested_role, 50);
        const phone = clip(body.phone, 20);
        const email = clip(body.email, 191);
        if (requested_role && !REQUESTABLE_ROLES.includes(requested_role)) {
            return NextResponse.json({ success: false, message: 'บทบาทที่ขอไม่ถูกต้อง' }, { status: 400 });
        }

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
                WHERE id = ? AND COALESCE(is_approved, 0) = 0`,
                [position, department, requested_role, phone, email, Number(userData.id)]
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
