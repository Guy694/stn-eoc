import { NextResponse } from "next/server";
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
            const [sessions] = await connection.execute(
                `SELECT s.user_id, s.expires_at, o.username, o.full_name, o.email, o.phone, o.role
                 FROM user_sessions s
                 JOIN officer o ON s.user_id = o.id
                 WHERE s.session_token = ? AND s.expires_at > NOW()`,
                [sessionToken]
            );

            if (sessions.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'Session หมดอายุหรือไม่ถูกต้อง' },
                    { status: 401 }
                );
            }

            const sessionData = sessions[0];

            // ดึง permissions ตาม role
            const permissions = rolePermissions[sessionData.role] || rolePermissions.staff;

            return NextResponse.json({
                success: true,
                user: {
                    id: sessionData.user_id,
                    username: sessionData.username,
                    fullName: sessionData.full_name,
                    email: sessionData.email,
                    phone: sessionData.phone,
                    role: sessionData.role,
                    roleDisplay: roleDisplayNames[sessionData.role] || sessionData.role,
                    permissions: permissions
                }
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Validate session error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการตรวจสอบ session',
                error: error.message
            },
            { status: 500 }
        );
    }
}
