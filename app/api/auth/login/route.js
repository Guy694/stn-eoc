import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { publicInternalError } from "@/lib/apiResponse";
import { notifySecurityEvent } from "@/lib/telegram";
import { createUserSession, getRoleDisplayName, getRolePermissions, setSessionCookie } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/clientIp";
import { consumeRateLimit, tooManyRequestsResponse } from "@/lib/rateLimit";
import { getPool } from "@/lib/db";

// hash ของรหัสผ่านสุ่มที่ไม่มีใครรู้ (cost 12 เท่าของจริง) ใช้เทียบเมื่อไม่พบชื่อผู้ใช้
const DUMMY_HASH = "$2b$12$C6UzMDM.H6dfI/f/IKcEeO5r8b0QJ3Gk0r6x1o3m8rjD4v3f8nM1e";

const pool = getPool();

export async function POST(request) {
    try {
        const { username, password } = await request.json();

        if (!username || !password) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอก username และ password' },
                { status: 400 }
            );
        }

        if (typeof username !== 'string' || typeof password !== 'string' || username.length > 100 || password.length > 256) {
            return NextResponse.json(
                { success: false, message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        // ดึง IP address และ User Agent (ดูกติกาการเชื่อ proxy ใน lib/clientIp.js)
        const ip_address = getClientIp(request);
        const user_agent = getUserAgent(request);

        // จำกัดจำนวนครั้งต่อ IP (กันการสุ่มรหัสผ่านไล่หลายบัญชี)
        const ipLimit = await consumeRateLimit('login', ip_address);
        if (!ipLimit.allowed) {
            void notifySecurityEvent('login_ip_rate_limit_triggered', { ip: ip_address, userAgent: user_agent });
            return tooManyRequestsResponse(ipLimit, 'พยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่');
        }

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
                // เทียบรหัสผ่านกับค่าหลอก ให้เวลาตอบใกล้เคียงกรณีมีผู้ใช้จริง (กันการเดาว่าชื่อผู้ใช้ไหนมีอยู่จากเวลาตอบ)
                await bcrypt.compare(String(password), DUMMY_HASH).catch(() => false);
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

                // ข้อความเดียวกับกรณีไม่มีชื่อผู้ใช้ (ไม่บอกจำนวนครั้ง เพื่อไม่ให้รู้ว่าชื่อผู้ใช้นี้มีอยู่จริง)
                const message = failedAttempts >= 5
                    ? 'บัญชีถูกล็อคชั่วคราว 30 นาที เนื่องจาก login ผิด 5 ครั้ง'
                    : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

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

            // สร้าง session (ฐานข้อมูลเก็บเฉพาะ hash ของ token)
            const { token: sessionToken } = await createUserSession(
                (sql, params) => connection.execute(sql, params),
                { officer, ipAddress: ip_address, userAgent: user_agent, loginMethod: 'username_password' }
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
            const permissions = getRolePermissions(officer.role);

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
                    roleDisplay: getRoleDisplayName(officer.role),
                    permissions: permissions,
                    mustChangePassword: Number(officer.must_change_password) === 1
                }
            });

            // ตั้งค่า cookie สำหรับ session (httpOnly + SameSite=Strict)
            setSessionCookie(response, sessionToken);

            return response;

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('Login error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ');
    }
}
