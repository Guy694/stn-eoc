import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { publicInternalError } from "@/lib/apiResponse";
import { notifySecurityEvent } from "@/lib/telegram";
import { createUserSession, getRoleDisplayName, getRolePermissions, setSessionCookie } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/clientIp";
import { consumeRateLimit, tooManyRequestsResponse } from "@/lib/rateLimit";
import { failedAttemptBlock, loginPolicy } from "@/lib/loginPolicy";
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
        const policy = loginPolicy();
        const ipLimit = await consumeRateLimit('login', ip_address, { limit: policy.ipRequestLimit, windowSeconds: policy.windowMinutes * 60 });
        if (!ipLimit.allowed) {
            void notifySecurityEvent('login_ip_rate_limit_triggered', { ip: ip_address, userAgent: user_agent });
            return tooManyRequestsResponse(ipLimit, 'พยายามเข้าสู่ระบบถี่เกินไป กรุณารอสักครู่');
        }

        const connection = await pool.getConnection();

        try {
            // กันสุ่มรหัสผ่าน: นับรหัสผิดแยก "ต่อบัญชี" และ "ต่อ IP" (เกณฑ์ใน lib/loginPolicy.js)
            const [recentAttempts] = await connection.execute(
                `SELECT
                    COALESCE(SUM(username = ?), 0) AS by_account,
                    COALESCE(SUM(ip_address = ?), 0) AS by_ip
                 FROM login_attempts
                 WHERE (username = ? OR ip_address = ?)
                   AND success = 0
                   AND attempt_time > DATE_SUB(NOW(), INTERVAL ${Number(policy.windowMinutes)} MINUTE)`,
                [username, ip_address, username, ip_address]
            );
            const block = failedAttemptBlock({ byAccount: Number(recentAttempts[0]?.by_account || 0), byIp: Number(recentAttempts[0]?.by_ip || 0) }, policy);

            if (block) {
                // บันทึก security log
                await connection.execute(
                    `INSERT INTO security_logs (event_type, username, ip_address, user_agent, details, severity) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    ['suspicious_activity', username, ip_address, user_agent, `Too many failed login attempts (${block.scope})`, 'high']
                );
                void notifySecurityEvent('login_rate_limit_triggered', {
                    username,
                    ip: ip_address,
                    userAgent: user_agent,
                    scope: block.scope
                });

                return NextResponse.json(
                    { success: false, message: block.message },
                    { status: 429, headers: { 'Retry-After': String(policy.windowMinutes * 60) } }
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
                    { success: false, code: 'invalid_credentials', message: 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง' },
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
            // บัญชีที่ไม่มีรหัสผ่าน (สมัครด้วย ThaiD/Provider ID) ถือว่ารหัสผิด แทนที่จะ error
            const isPasswordValid = officer.password_hash
                ? await bcrypt.compare(password, officer.password_hash).catch(() => false)
                : false;

            if (!isPasswordValid) {
                // เพิ่มจำนวนครั้งที่ login ผิด
                const failedAttempts = (officer.failed_login_attempts || 0) + 1;
                let lockUntil = null;

                // ล็อคบัญชีเมื่อผิดติดกันครบเกณฑ์ (ค่าเริ่มต้น 10 ครั้ง ล็อก 15 นาที)
                if (failedAttempts >= policy.lockAfterFailures) {
                    lockUntil = new Date(Date.now() + policy.lockMinutes * 60 * 1000);

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
                    ['login_failed', officer.id, username, ip_address, user_agent, `Wrong password (attempt ${failedAttempts}/${policy.lockAfterFailures})`, 'medium']
                );

                // ข้อความเดียวกับกรณีไม่มีชื่อผู้ใช้ (ไม่บอกจำนวนครั้ง เพื่อไม่ให้รู้ว่าชื่อผู้ใช้นี้มีอยู่จริง)
                const message = failedAttempts >= policy.lockAfterFailures
                    ? `บัญชีถูกล็อคชั่วคราว ${policy.lockMinutes} นาที เนื่องจากใส่รหัสผ่านผิด ${policy.lockAfterFailures} ครั้ง`
                    : 'ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง';

                return NextResponse.json(
                    { success: false, code: failedAttempts >= policy.lockAfterFailures ? 'locked' : 'invalid_credentials', message },
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
                    {
                        success: false,
                        code: 'pending_approval',
                        message: 'ลงทะเบียนเรียบร้อยแล้ว รอเจ้าหน้าที่อนุมัติการเข้าใช้ระบบ\nเมื่ออนุมัติแล้ว ระบบจะแจ้งไปที่อีเมลที่ลงทะเบียนไว้'
                    },
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
