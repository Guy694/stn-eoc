import { NextResponse } from "next/server";
import { cookies } from "next/headers";

/**
 * API สำหรับดึงข้อมูล session ของผู้ใช้จาก cookie
 */
export async function GET(request) {
    try {
        const cookieStore = await cookies();
        const userSession = cookieStore.get('user_session');

        if (!userSession) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบข้อมูล session' },
                { status: 401 }
            );
        }

        const userData = JSON.parse(userSession.value);

        return NextResponse.json({
            success: true,
            user: userData
        });

    } catch (error) {
        console.error('Session Error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการอ่านข้อมูล session' },
            { status: 500 }
        );
    }
}
