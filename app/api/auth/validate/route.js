import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
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

// กำหนด permissions สำหรับแต่ละ role
const rolePermissions = {
    admin: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: true },
        admin: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, create: true, export: true },
        users: { view: true, create: true, edit: true, delete: true }
    },
    MCATT: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: false },
        admin: { view: true, create: false, edit: false, delete: false },
        reports: { view: true, create: true, export: true },
        users: { view: true, create: false, edit: false, delete: false }
    },
    SAT: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: true, create: false, export: false },
        users: { view: false, create: false, edit: false, delete: false }
    },
    SeRHT: {
        dashboard: true,
        eoc: { view: true, create: true, edit: false, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: true, create: false, export: false },
        users: { view: false, create: false, edit: false, delete: false }
    },
    staff: {
        dashboard: true,
        eoc: { view: true, create: true, edit: false, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: true, create: false, export: false },
        users: { view: false, create: false, edit: false, delete: false }
    }
};

// กำหนดชื่อแสดงสำหรับแต่ละ role
const roleDisplayNames = {
    admin: 'ผู้ดูแลระบบ',
    MCATT: 'ทีม MCATT',
    SAT: 'ทีม SAT',
    SeRHT: 'ทีม SeRHT',
    staff: 'เจ้าหน้าที่'
};

export async function POST(request) {
    try {
        const { sessionToken } = await request.json();

        if (!sessionToken) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ session token' },
                { status: 401 }
            );
        }

        const connection = await pool.getConnection();

        try {
            // ตรวจสอบ session และดึงข้อมูล officer
            // เพิ่มเงื่อนไข: last_activity ต้องไม่เกิน 10 นาที
            const [sessions] = await connection.execute(
                `SELECT s.*, o.username, o.title, o.given_name, o.family_name, o.email, o.phone, o.role,
                 TIMESTAMPDIFF(MINUTE, s.last_activity, NOW()) as idle_minutes
                 FROM user_sessions s
                 JOIN officer o ON s.user_id = o.id
                 WHERE s.session_token = ? 
                 AND s.expires_at > NOW() 
                 AND s.is_active = 1`,
                [sessionToken]
            );

            if (sessions.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'Session หมดอายุหรือไม่ถูกต้อง', sessionExpired: true },
                    { status: 401 }
                );
            }

            const sessionData = sessions[0];

            // ตรวจสอบ idle timeout (10 นาที)
            if (sessionData.idle_minutes >= 10) {
                // ปิด session
                await connection.execute(
                    'UPDATE user_sessions SET is_active = 0 WHERE session_token = ?',
                    [sessionToken]
                );

                // บันทึก security log
                await connection.execute(
                    `INSERT INTO security_logs (event_type, user_id, username, details, severity) 
                    VALUES (?, ?, ?, ?, ?)`,
                    ['session_expired', sessionData.user_id, sessionData.username,
                        `Session expired due to inactivity (${sessionData.idle_minutes} minutes)`, 'low']
                );

                return NextResponse.json(
                    { success: false, message: 'Session หมดอายุเนื่องจากไม่มีการใช้งาน', sessionExpired: true, idleTimeout: true },
                    { status: 401 }
                );
            }

            // อัพเดท last_activity (เพื่อรีเซ็ต idle timer)
            await connection.execute(
                'UPDATE user_sessions SET last_activity = NOW() WHERE session_token = ?',
                [sessionToken]
            );

            // ดึง permissions ตาม role
            const permissions = rolePermissions[sessionData.role] || rolePermissions.staff;

            return NextResponse.json({
                success: true,
                user: {
                    id: sessionData.user_id,
                    username: sessionData.username,
                    title: sessionData.title,
                    givenName: sessionData.given_name,
                    familyName: sessionData.family_name,
                    email: sessionData.email,
                    phone: sessionData.phone,
                    role: sessionData.role,
                    roleDisplay: roleDisplayNames[sessionData.role] || sessionData.role,
                    permissions: permissions
                },
                idleMinutes: sessionData.idle_minutes,
                remainingMinutes: 10 - sessionData.idle_minutes
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Validate session error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการตรวจสอบ session');
    }
}
