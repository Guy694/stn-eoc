import { NextResponse } from "next/server";
import { getAuthSession } from "@/lib/auth";
import { getCitizenSession } from "@/lib/citizenAuth";

/**
 * API สำหรับดึงข้อมูล session ของผู้ใช้จาก cookie
 */
export async function GET(request) {
    try {
        const auth = await getAuthSession(request);
        if (!auth.success) {
            const citizenSession = await getCitizenSession();

            if (!citizenSession) return auth.response;

            return NextResponse.json({
                success: true,
                user: {
                    username: citizenSession.pidHash.substring(0, 10),
                    givenName: citizenSession.firstName,
                    familyName: citizenSession.lastName,
                    role: 'citizen',
                    roleDisplay: 'ประชาชน',
                    permissions: { dashboard: true },
                    isApproved: true,
                    userType: 'citizen'
                },
                remainingMinutes: Math.max(0, Math.ceil((citizenSession.expiresAt - Date.now()) / 60000))
            });
        }

        return NextResponse.json({
            success: true,
            user: auth.user,
            remainingMinutes: auth.remainingMinutes
        });

    } catch (error) {
        console.error('Session Error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการอ่านข้อมูล session' },
            { status: 500 }
        );
    }
}
