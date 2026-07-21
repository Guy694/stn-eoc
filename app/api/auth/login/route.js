import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import { publicInternalError } from "@/lib/apiResponse";
import { notifySecurityEvent } from "@/lib/telegram";
import { TEAM_ROLE_CODES, TEAM_ROLE_OPTIONS } from "@/lib/eocRoles";

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
    commander: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: false },
        admin: { view: true, create: false, edit: false, delete: false },
        reports: { view: true, create: true, export: true },
        users: { view: true, create: false, edit: false, delete: false }
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
    commander: 'ผู้บัญชาการเหตุการณ์',
    MCATT: 'ทีม MCATT',
    SAT: 'ทีม SAT',
    SeRHT: 'ทีม SeRHT',
    staff: 'เจ้าหน้าที่'
};

for (const roleCode of TEAM_ROLE_CODES) {
    if (!rolePermissions[roleCode]) {
        rolePermissions[roleCode] = roleCode === 'EOC_COMMANDER'
            ? rolePermissions.commander
            : rolePermissions.staff;
    }
}

for (const role of TEAM_ROLE_OPTIONS) {
    roleDisplayNames[role.value] = role.roleDisplayName || `ทีม ${role.value}`;
}

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอก username และ password' },
                { status: 400 }
            );
        }

        // ดึง IP address และ User Agent
        const ip_address = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
            || request.headers.get('x-real-ip')
            || 'unknown';
        const user_agent = request.headers.get('user-agent') || 'unknown';

        const connection = await pool.getConnection();

        try {
            // ตรวจสอบ brute force attack (มากกว่า 5 ครั้งใน 15 นาที)
            const [recentAttempts] = await connection.execute(
                `SELECT COUNT(*) as count FROM login_attempts 
                WHERE (username = ? OR ip_address = ?) 
                AND success = 0 
                AND attempt_time > DATE_SUB(NOW(), INTERVAL 15 MINUTE)`,
                [username, ip_address]
            );

            if (recentAttempts[0].count >= 5) {
                // บันทึก security log
                await connection.execute(
                    `INSERT INTO security_logs (event_type, username, ip_address, user_agent, details, severity) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    ['suspicious_activity', username, ip_address, user_agent, 'Too many failed login attempts', 'high']
                );
                void notifySecurityEvent('login_rate_limit_triggered', {
                    username,
                    ip: ip_address,
                    userAgent: user_agent
                });

                return NextResponse.json(
                    { success: false, message: 'บัญชีถูกล็อคชั่วคราว กรุณาลองใหม่ในอีก 15 นาที' },
                    { status: 429 }
                );
            }

            // ดึงข้อมูลจาก officer table
            const [officers] = await connection.execute(
                `SELECT id, username, password_hash, title, given_name, family_name, email, phone, role,
                is_approved, failed_login_attempts, account_locked_until, must_change_password
                FROM officer WHERE username = ?`,
                [username]
            );

            if (officers.length === 0) {
                // บันทึก login attempt ที่ล้มเหลว
                await connection.execute(
                    'INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, 0)',
                    [username, ip_address]
                );

                await connection.execute(
                    `INSERT INTO security_logs (event_type, username, ip_address, user_agent, details, severity) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    ['login_failed', username, ip_address, user_agent, 'User not found', 'medium']
                );

                return NextResponse.json(
                    { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
                    { status: 401 }
                );
            }

            const officer = officers[0];

            // ตรวจสอบว่าบัญชีถูกล็อคหรือไม่
            if (officer.account_locked_until && new Date(officer.account_locked_until) > new Date()) {
                await connection.execute(
                    `INSERT INTO security_logs (event_type, user_id, username, ip_address, user_agent, details, severity) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ['account_locked', officer.id, username, ip_address, user_agent, 'Attempt to login locked account', 'high']
                );

                return NextResponse.json(
                    { success: false, message: `บัญชีถูกล็อค กรุณาติดต่อผู้ดูแลระบบ` },
                    { status: 403 }
                );
            }

            // ตรวจสอบรหัสผ่านด้วย bcrypt
            const isPasswordValid = await bcrypt.compare(password, officer.password_hash);

            if (!isPasswordValid) {
                // เพิ่มจำนวนครั้งที่ login ผิด
                const failedAttempts = (officer.failed_login_attempts || 0) + 1;
                let lockUntil = null;

                // ล็อคบัญชีถ้าล้มเหลว 5 ครั้ง
                if (failedAttempts >= 5) {
                    lockUntil = new Date(Date.now() + 30 * 60 * 1000); // ล็อค 30 นาที

                    await connection.execute(
                        `INSERT INTO security_logs (event_type, user_id, username, ip_address, user_agent, details, severity) 
                        VALUES (?, ?, ?, ?, ?, ?, ?)`,
                        ['account_locked', officer.id, username, ip_address, user_agent, `Account locked after ${failedAttempts} failed attempts`, 'critical']
                    );
                    void notifySecurityEvent('account_locked_after_failed_logins', {
                        userId: officer.id,
                        username,
                        ip: ip_address,
                        failedAttempts
                    });
                }

                await connection.execute(
                    'UPDATE officer SET failed_login_attempts = ?, account_locked_until = ? WHERE id = ?',
                    [failedAttempts, lockUntil, officer.id]
                );

                await connection.execute(
                    'INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, 0)',
                    [username, ip_address]
                );

                await connection.execute(
                    `INSERT INTO security_logs (event_type, user_id, username, ip_address, user_agent, details, severity) 
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ['login_failed', officer.id, username, ip_address, user_agent, `Wrong password (attempt ${failedAttempts}/5)`, 'medium']
                );

                const message = failedAttempts >= 5
                    ? 'บัญชีถูกล็อคชั่วคราว 30 นาที เนื่องจาก login ผิด 5 ครั้ง'
                    : `ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง (${failedAttempts}/5)`;

                return NextResponse.json(
                    { success: false, message },
                    { status: 401 }
                );
            }

            if (Number(officer.is_approved) !== 1) {
                await connection.execute(
                    'INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, 0)',
                    [username, ip_address]
                );

                await connection.execute(
                    `INSERT INTO security_logs (event_type, user_id, username, ip_address, user_agent, details, severity)
                    VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    ['login_failed', officer.id, username, ip_address, user_agent, 'Account pending approval', 'medium']
                );

                return NextResponse.json(
                    { success: false, message: 'บัญชีนี้ยังรอผู้ดูแลระบบอนุมัติ กรุณายืนยันตัวตนด้วย ThaiD และรอการอนุมัติ' },
                    { status: 403 }
                );
            }

            // Login สำเร็จ - รีเซ็ตจำนวนครั้งที่ล้มเหลว
            await connection.execute(
                'UPDATE officer SET failed_login_attempts = 0, account_locked_until = NULL, last_login = NOW() WHERE id = ?',
                [officer.id]
            );

            // สร้าง session token
            const crypto = require('crypto');
            const sessionToken = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 ชั่วโมง

            // บันทึก session ลงฐานข้อมูล
            await connection.execute(
                `INSERT INTO user_sessions 
                (session_token, user_id, username, title, given_name, family_name, email, phone, role, ip_address, user_agent, expires_at, login_method) 
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'username_password')`,
                [sessionToken, officer.id, officer.username, officer.title, officer.given_name, officer.family_name,
                    officer.email, officer.phone, officer.role, ip_address, user_agent, expiresAt]
            );

            // บันทึก login attempt ที่สำเร็จ
            await connection.execute(
                'INSERT INTO login_attempts (username, ip_address, success) VALUES (?, ?, 1)',
                [username, ip_address]
            );

            // บันทึก security log
            await connection.execute(
                `INSERT INTO security_logs (event_type, user_id, username, ip_address, user_agent, details, severity) 
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['login_success', officer.id, username, ip_address, user_agent, 'Successful login', 'low']
            );

            // บันทึก activity log
            await connection.execute(
                'INSERT INTO activity_logs (user_id, username, action_type, description) VALUES (?, ?, ?, ?)',
                [officer.id, officer.username, 'login', `เข้าสู่ระบบ: ${officer.username}`]
            );

            // ดึง permissions ตาม role
            const permissions = rolePermissions[officer.role] || rolePermissions.staff;

            // ส่งข้อมูลกลับ
            const response = NextResponse.json({
                success: true,
                message: 'เข้าสู่ระบบสำเร็จ',
                user: {
                    id: officer.id,
                    username: officer.username,
                    email: officer.email,
                    title: officer.title,
                    givenName: officer.given_name,
                    familyName: officer.family_name,
                    phone: officer.phone,
                    role: officer.role,
                    roleDisplay: roleDisplayNames[officer.role] || officer.role,
                    permissions: permissions,
                    mustChangePassword: officer.must_change_password
                }
            });

            // ตั้งค่า cookie สำหรับ session (httpOnly เพื่อความปลอดภัย)
            response.cookies.set('session_token', sessionToken, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'strict', // เปลี่ยนเป็น strict สำหรับความปลอดภัย
                maxAge: 60 * 60 * 24 // 24 ชั่วโมง
            });

            return response;

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Login error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    }
}
