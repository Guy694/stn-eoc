import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";

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
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;

        const { currentPassword, newPassword } = await request.json();
        const userId = auth.user.id;

        if (!currentPassword || !newPassword) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
                { status: 400 }
            );
        }

        if (newPassword.length < 6) {
            return NextResponse.json(
                { success: false, message: 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();

        try {
            // ดึงข้อมูล officer
            const [officers] = await connection.execute(
                'SELECT password_hash FROM officer WHERE id = ?',
                [userId]
            );

            if (officers.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'ไม่พบข้อมูลผู้ใช้' },
                    { status: 404 }
                );
            }

            const officer = officers[0];

            // ตรวจสอบรหัสผ่านเดิม
            const isPasswordValid = await bcrypt.compare(currentPassword, officer.password_hash);

            if (!isPasswordValid) {
                return NextResponse.json(
                    { success: false, message: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' },
                    { status: 400 }
                );
            }

            // Hash รหัสผ่านใหม่
            const salt = await bcrypt.genSalt(10);
            const newPasswordHash = await bcrypt.hash(newPassword, salt);

            // อัพเดทรหัสผ่าน
            await connection.execute(
                'UPDATE officer SET password_hash = ?, updated_at = NOW() WHERE id = ?',
                [newPasswordHash, userId]
            );

            return NextResponse.json({
                success: true,
                message: 'เปลี่ยนรหัสผ่านสำเร็จ'
            });
        } catch (error) {
            console.error('Change password error (inner):', error);
            return publicInternalError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Change password error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเปลี่ยนรหัสผ่าน');
    }
}
