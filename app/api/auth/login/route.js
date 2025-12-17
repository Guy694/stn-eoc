import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

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
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอก username และ password' },
                { status: 400 }
            );
        }

        const connection = await pool.getConnection();

        try {
            // ดึงข้อมูลจาก officer table
            const [officers] = await connection.execute(
                'SELECT id, username, password_hash, full_name, email, phone, role FROM officer WHERE username = ?',
                [username]
            );

            if (officers.length === 0) {
                return NextResponse.json(
                    { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
                    { status: 401 }
                );
            }

            const officer = officers[0];

            // ตรวจสอบรหัสผ่านด้วย bcrypt
            const isPasswordValid = await bcrypt.compare(password, officer.password_hash);

            if (!isPasswordValid) {
                return NextResponse.json(
                    { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
                    { status: 401 }
                );
            }

            // สร้าง session token
            const crypto = require('crypto');
            const sessionToken = crypto.randomBytes(32).toString('hex');

            // Get client info
            const ip = request.headers.get('x-forwarded-for') ||
                request.headers.get('x-real-ip') ||
                'unknown';
            const userAgent = request.headers.get('user-agent') || 'unknown';

            // บันทึก session ลง user_sessions table
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 24);

            await connection.execute(
                'INSERT INTO user_sessions (user_id, session_token, ip_address, user_agent, expires_at) VALUES (?, ?, ?, ?, ?)',
                [officer.id, sessionToken, ip, userAgent, expiresAt]
            );

            // ดึง permissions ตาม role
            const permissions = rolePermissions[officer.role] || rolePermissions.staff;

            // ส่งข้อมูลกลับ
            const response = {
                success: true,
                message: 'เข้าสู่ระบบสำเร็จ',
                user: {
                    id: officer.id,
                    username: officer.username,
                    email: officer.email,
                    fullName: officer.full_name,
                    phone: officer.phone,
                    role: officer.role,
                    roleDisplay: roleDisplayNames[officer.role] || officer.role,
                    permissions: permissions
                },
                sessionToken: sessionToken
            };

            return NextResponse.json(response);

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Login error:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ',
                error: error.message
            },
            { status: 500 }
        );
    }
}
