import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { getAuthSession } from "@/lib/auth";

// Endpoint เดิมสำหรับตรวจ session (คงไว้เพื่อความเข้ากันได้)
// ใช้ตรรกะเดียวกับ getAuthSession ใน lib/auth.js ทั้งหมด — รับ token จาก cookie หรือ Authorization: Bearer เท่านั้น
export async function POST(request) {
    try {
        const auth = await getAuthSession(request, { allowPasswordChangeRequired: true });
        if (!auth.success) return auth.response;

        return NextResponse.json({
            success: true,
            user: auth.user,
            remainingMinutes: auth.remainingMinutes
        });
    } catch (error) {
        console.error('Validate session error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการตรวจสอบการเข้าสู่ระบบ');
    }
}
