import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { requireAuth, revokeUserSessions } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query } from "@/lib/db";
import { validatePassword } from "@/lib/passwordPolicy";
import { getClientIp, getUserAgent } from "@/lib/clientIp";

export async function POST(request) {
    try {
        // ผู้ใช้ที่ถูกบังคับให้เปลี่ยนรหัสผ่านต้องเรียก endpoint นี้ได้
        const auth = await requireAuth(request, [], { allowPasswordChangeRequired: true });
        if (!auth.success) return auth.response;

        const { currentPassword, newPassword } = await request.json();
        const userId = auth.user.id;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
                { status: 400 }
            );
        }

        const policyError = validatePassword(newPassword, { username: auth.user.username, currentPassword });
        if (policyError) {
            return NextResponse.json({ success: false, message: policyError }, { status: 400 });
        }

        const officers = await query('SELECT password_hash FROM officer WHERE id = ?', [userId]);
        if (officers.length === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบข้อมูลผู้ใช้' },
                { status: 404 }
            );
        }

        const isPasswordValid = await bcrypt.compare(currentPassword, officers[0].password_hash || '');
        if (!isPasswordValid) {
            return NextResponse.json(
                { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        const newPasswordHash = await bcrypt.hash(newPassword, 12);
        await query(
            `UPDATE officer
             SET password_hash = ?, must_change_password = 0, password_changed_at = NOW(), updated_at = NOW()
             WHERE id = ?`,
            [newPasswordHash, userId]
        );

        // ปิด session อื่นทั้งหมดของผู้ใช้ (เผื่อมีผู้อื่นใช้รหัสผ่านเดิมเข้ามาแล้ว)
        await revokeUserSessions(userId, { exceptToken: auth.token });

        await query(
            `INSERT INTO activity_logs (user_id, username, action_type, target_type, target_id, description, ip_address, user_agent)
             VALUES (?, ?, 'password_change', 'officer', ?, ?, ?, ?)`,
            [userId, auth.user.username, String(userId), 'เปลี่ยนรหัสผ่าน', getClientIp(request), getUserAgent(request)]
        ).catch((logError) => console.error('Change password audit log error:', logError));

        return NextResponse.json({
            success: true,
            message: 'เปลี่ยนรหัสผ่านสำเร็จ'
        });
    } catch (error) {
        console.error('Change password error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    }
}
