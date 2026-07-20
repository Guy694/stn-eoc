import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import crypto from "crypto";
import { clearCitizenSessionCookie, setCitizenSessionCookie } from "@/lib/citizenAuth";
import { applyNoStoreHeaders, getThaiIdConfigError, getThaiIdOAuthConfig } from "@/lib/thaiIdConfig";
import { clearRegistrationSessionCookie, setRegistrationSessionCookie } from "@/lib/registrationSession";
import { notifySecurityEvent } from "@/lib/telegram";

export const dynamic = 'force-dynamic';
export const revalidate = 0;

// Database Pool
const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// สร้างค่า PID hash แบบ deterministic สำหรับค้นผู้ใช้เดิมโดยไม่เก็บ PID ตรง ๆ
function hashPID(pid) {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
        throw new Error('SECRET_KEY is not defined in environment variables');
    }

    return crypto.createHmac('sha256', secretKey).update(pid).digest('hex');
}

const OFFICER_CALLBACK_PATH = '/api/auth/thaiid/callback';

function normalizeAppBaseUrl(value) {
    const url = new URL(value);
    const stnEocIndex = url.pathname.indexOf('/stn-eoc');
    const basePath = stnEocIndex >= 0 ? url.pathname.slice(0, stnEocIndex + '/stn-eoc'.length) : '/stn-eoc';
    return `${url.origin}${basePath}`;
}

function getAppBaseUrl(request) {
    const configuredUrl = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_API_URL || process.env.CALLBACK;
    if (configuredUrl) {
        return normalizeAppBaseUrl(configuredUrl);
    }

    return normalizeAppBaseUrl(request.url);
}

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
    },
    citizen: {
        dashboard: true, // ให้ citizen ดู dashboard ได้ (อาจจำกัดการมองเห็นใน component)
        eoc: { view: false, create: false, edit: false, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: true, create: true, export: false }, // ประชาชนดูและส่งรายงานได้
        users: { view: false, create: false, edit: false, delete: false }
    },
    user: { // Legacy role
        dashboard: true,
        eoc: { view: false, create: false, edit: false, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: false, create: false, export: false },
        users: { view: false, create: false, edit: false, delete: false }
    }
};

const roleDisplayNames = {
    admin: 'ผู้ดูแลระบบ',
    MCATT: 'ทีม MCATT',
    SAT: 'ทีม SAT',
    SeRHT: 'ทีม SeRHT',
    staff: 'เจ้าหน้าที่',
    user: 'ผู้ใช้งานทั่วไป',
    citizen: 'ประชาชน' // เพิ่ม Role Citizens
};

/**
 * แลกเปลี่ยน Authorization Code กับ Access Token
 */
async function exchangeCodeForToken(code, thaiIdConfig) {
    const basicAuthorization = Buffer
        .from(`${thaiIdConfig.clientId}:${thaiIdConfig.clientSecret}`)
        .toString('base64');
    const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: thaiIdConfig.redirectUri
    });

    // สร้าง AbortController สำหรับ timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 วินาที

    try {
        const response = await fetch(thaiIdConfig.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': `Basic ${basicAuthorization}`,
            },
            body: tokenParams.toString(),
            signal: controller.signal
        });

        clearTimeout(timeout);

        const responseText = await response.text();

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.status} - ${responseText}`);
        }

        const tokenData = JSON.parse(responseText);

        return tokenData;
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('การเชื่อมต่อ ThaiD หมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง');
        }
        throw error;
    }
}

async function fetchThaiIdUserInfo(accessToken, thaiIdConfig) {
    if (!accessToken) return null;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
        const response = await fetch(thaiIdConfig.userInfoUrl, {
            headers: {
                'Authorization': `Bearer ${accessToken}`,
            },
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const responseText = await response.text();
            throw new Error(`UserInfo request failed: ${response.status} - ${responseText}`);
        }

        return response.json();
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('การเชื่อมต่อ ThaiD UserInfo หมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง');
        }
        throw error;
    }
}

function mergeThaiIdProfile(tokenData, userInfo) {
    const data = { ...(userInfo || {}), ...(tokenData || {}) };
    return {
        ...data,
        pid: data.pid || data.sub || data.citizen_id || data.citizenId || data.personal_id,
        given_name: data.given_name || data.givenName || data.first_name || data.firstName,
        family_name: data.family_name || data.familyName || data.last_name || data.lastName
    };
}

function normalizeName(value) {
    return String(value || '')
        .normalize('NFC')
        .replace(/\s+/g, '')
        .toLowerCase()
        .trim();
}

function isSameThaiIdName(profile, record) {
    return normalizeName(profile.given_name) === normalizeName(record.given_name)
        && normalizeName(profile.family_name) === normalizeName(record.family_name);
}

async function ensureRegistrationSchema(connection) {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS registration_requests (
            id INT AUTO_INCREMENT PRIMARY KEY,
            user_type ENUM('citizen', 'officer') NOT NULL,
            officer_id INT NULL,
            pid_hash VARCHAR(64) NULL,
            title VARCHAR(50) NULL,
            given_name VARCHAR(100) NOT NULL,
            family_name VARCHAR(100) NOT NULL,
            normalized_given_name VARCHAR(120) NOT NULL,
            normalized_family_name VARCHAR(120) NOT NULL,
            agency VARCHAR(255) NOT NULL,
            username VARCHAR(50) NULL,
            email VARCHAR(100) NULL,
            phone VARCHAR(20) NULL,
            status ENUM('pending', 'verified', 'approved', 'rejected') NOT NULL DEFAULT 'pending',
            request_ip VARCHAR(45) NULL,
            user_agent TEXT NULL,
            verified_at TIMESTAMP NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            INDEX idx_registration_requests_lookup (user_type, normalized_given_name, normalized_family_name, status),
            INDEX idx_registration_requests_ip (request_ip, created_at),
            INDEX idx_registration_requests_pid_hash (pid_hash),
            UNIQUE KEY unique_registration_username (username),
            CONSTRAINT fk_registration_requests_officer
                FOREIGN KEY (officer_id) REFERENCES officer(id)
                ON DELETE SET NULL
        )
    `);
}

async function findRegistrationByThaiIdName(connection, thaiIdProfile) {
    const [rows] = await connection.execute(
        `SELECT *
         FROM registration_requests
         WHERE normalized_given_name = ?
           AND normalized_family_name = ?
           AND status IN ('pending', 'verified', 'approved')
         ORDER BY FIELD(user_type, 'officer', 'citizen'), created_at DESC
         LIMIT 1`,
        [normalizeName(thaiIdProfile.given_name), normalizeName(thaiIdProfile.family_name)]
    );

    return rows[0] || null;
}

/**
 * Callback Handler สำหรับ ThaiD OAuth
 */
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const code = searchParams.get('code');
        const state = searchParams.get('state');
        const error = searchParams.get('error');
        const thaiIdConfig = getThaiIdOAuthConfig(request, OFFICER_CALLBACK_PATH);
        const configError = getThaiIdConfigError(thaiIdConfig, { requireClientSecret: true });

        if (configError) {
            throw new Error(configError);
        }

        // ตรวจสอบว่ามี error จาก ThaiD หรือไม่
        if (error) {
            const baseUrl = getAppBaseUrl(request);
            return applyNoStoreHeaders(NextResponse.redirect(
                `${baseUrl}/login?error=thaiid_auth_failed&message=${error}`
            ));
        }

        // ตรวจสอบว่ามี code หรือไม่
        if (!code) {
            const baseUrl = getAppBaseUrl(request);
            return applyNoStoreHeaders(NextResponse.redirect(
                `${baseUrl}/login?error=no_code`
            ));
        }

        const storedState = request.cookies.get('thaiid_state')?.value;
        if (!state || !storedState || state !== storedState) {
            void notifySecurityEvent('thaiid_oauth_state_mismatch', {
                ip: request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown',
                hasState: Boolean(state),
                hasStoredState: Boolean(storedState)
            });
            const baseUrl = getAppBaseUrl(request);
            return applyNoStoreHeaders(NextResponse.redirect(
                `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent('ThaiD state ไม่ถูกต้อง กรุณาเริ่มเข้าสู่ระบบใหม่')}`
            ));
        }

        // 1. แลกเปลี่ยน Authorization Code กับ Access Token
        const tokenData = await exchangeCodeForToken(code, thaiIdConfig);
        const accessToken = tokenData.access_token;
        const userInfo = tokenData.pid ? null : await fetchThaiIdUserInfo(accessToken, thaiIdConfig);
        const thaiIdProfile = mergeThaiIdProfile(tokenData, userInfo);
        const pid = thaiIdProfile.pid;

        if (!pid) {
            const baseUrl = getAppBaseUrl(request);
            return applyNoStoreHeaders(NextResponse.redirect(
                `${baseUrl}/login?error=no_pid`
            ));
        }

        const pidHash = hashPID(pid);

        // 2. ค้นหาผู้ใช้ในฐานข้อมูลด้วย Encrypted PID
        const connection = await pool.getConnection();

        try {
            await ensureRegistrationSchema(connection);

            // STEP 2.1: Check Officer Table First
            const [officers] = await connection.execute(
                'SELECT id, username, title, given_name, family_name, email, phone, role, pid_hash, is_approved, position, department, requested_role FROM officer WHERE pid_hash = ?',
                [pidHash]
            );

            let userRecord;
            let isNewUser = false;
            let userType = 'officer'; // 'officer' or 'citizen'

            if (officers.length > 0) {
                // FOUND IN OFFICERS -> Login as Officer
                userRecord = officers[0];
                userType = 'officer';

                if (!isSameThaiIdName(thaiIdProfile, userRecord)) {
                    const baseUrl = getAppBaseUrl(request);
                    connection.release();
                    return applyNoStoreHeaders(NextResponse.redirect(
                        `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent('ชื่อ-นามสกุลจาก ThaiD ไม่ตรงกับข้อมูลเจ้าหน้าที่ที่ลงทะเบียนไว้')}`
                    ));
                }

                // Update Officer Data
                const title = thaiIdProfile.title || userRecord.title;
                const givenName = thaiIdProfile.given_name || userRecord.given_name;
                const familyName = thaiIdProfile.family_name || userRecord.family_name;

                await connection.execute(
                    `UPDATE officer 
                    SET title = ?, given_name = ?, family_name = ?, last_login = NOW() 
                    WHERE id = ?`,
                    [title, givenName, familyName, userRecord.id]
                );

                // Update object
                userRecord.title = title;
                userRecord.given_name = givenName;
                userRecord.family_name = familyName;

            } else {
                // NOT FOUND IN OFFICERS -> Check Citizens Table
                const [citizens] = await connection.execute(
                    'SELECT id, pid_hash, title, given_name, family_name, birthdate, gender, address, phone FROM citizens WHERE pid_hash = ?',
                    [pidHash]
                );

                if (citizens.length > 0) {
                    // FOUND IN CITIZENS -> Login as Citizen
                    userRecord = citizens[0];
                    userType = 'citizen';

                    if (!isSameThaiIdName(thaiIdProfile, userRecord)) {
                        const baseUrl = getAppBaseUrl(request);
                        connection.release();
                        return applyNoStoreHeaders(NextResponse.redirect(
                            `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent('ชื่อ-นามสกุลจาก ThaiD ไม่ตรงกับข้อมูลประชาชนที่ลงทะเบียนไว้')}`
                        ));
                    }

                    // Update Citizen Data
                    await connection.execute(
                        `UPDATE citizens 
                        SET title = ?, given_name = ?, family_name = ?, address = ?, updated_at = NOW() 
                        WHERE id = ?`,
                        [
                            thaiIdProfile.title || userRecord.title,
                            thaiIdProfile.given_name || userRecord.given_name,
                            thaiIdProfile.family_name || userRecord.family_name,
                            thaiIdProfile.address || userRecord.address,
                            userRecord.id
                        ]
                    );

                    // Update object locally
                    userRecord.title = thaiIdProfile.title || userRecord.title;
                    userRecord.given_name = thaiIdProfile.given_name || userRecord.given_name;
                    userRecord.family_name = thaiIdProfile.family_name || userRecord.family_name;
                    userRecord.address = thaiIdProfile.address || userRecord.address;

                } else {
                    const registration = await findRegistrationByThaiIdName(connection, thaiIdProfile);

                    if (!registration) {
                        const baseUrl = getAppBaseUrl(request);
                        connection.release();
                        return applyNoStoreHeaders(NextResponse.redirect(
                            `${baseUrl}/login?error=user_not_found&message=${encodeURIComponent('ไม่มีข้อมูลผู้ใช้งานที่ลงทะเบียนไว้ตรงกับชื่อ-นามสกุลจาก ThaiD')}`
                        ));
                    }

                    if (registration.user_type === 'officer') {
                        userType = 'officer';
                        isNewUser = false;

                        if (!registration.officer_id) {
                            const baseUrl = getAppBaseUrl(request);
                            connection.release();
                            return applyNoStoreHeaders(NextResponse.redirect(
                                `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent('ข้อมูลลงทะเบียนเจ้าหน้าที่ไม่สมบูรณ์ กรุณาลงทะเบียนใหม่หรือติดต่อผู้ดูแลระบบ')}`
                            ));
                        }

                        await connection.execute(
                            `UPDATE officer
                             SET pid_hash = ?, title = COALESCE(?, title), given_name = ?, family_name = ?, last_login = NOW()
                             WHERE id = ?`,
                            [pidHash, thaiIdProfile.title || registration.title || null, thaiIdProfile.given_name, thaiIdProfile.family_name, registration.officer_id]
                        );

                        await connection.execute(
                            `UPDATE registration_requests
                             SET pid_hash = ?, status = 'verified', verified_at = NOW()
                             WHERE id = ?`,
                            [pidHash, registration.id]
                        );

                        const [registeredOfficers] = await connection.execute(
                            'SELECT id, username, title, given_name, family_name, email, phone, role, pid_hash, is_approved, position, department, requested_role FROM officer WHERE id = ?',
                            [registration.officer_id]
                        );
                        userRecord = registeredOfficers[0];
                    } else {
                        userType = 'citizen';
                        isNewUser = true;

                        const title = thaiIdProfile.title || registration.title || null;
                        const givenName = thaiIdProfile.given_name || registration.given_name;
                        const familyName = thaiIdProfile.family_name || registration.family_name;
                        const birthdate = thaiIdProfile.birthdate || null;
                        const gender = thaiIdProfile.gender || null;
                        const address = thaiIdProfile.address || null;

                        const [result] = await connection.execute(
                            `INSERT INTO citizens
                                (pid_hash, title, given_name, family_name, birthdate, gender, address, phone, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())
                             ON DUPLICATE KEY UPDATE
                                title = VALUES(title),
                                given_name = VALUES(given_name),
                                family_name = VALUES(family_name),
                                birthdate = VALUES(birthdate),
                                gender = VALUES(gender),
                                address = VALUES(address),
                                phone = VALUES(phone),
                                updated_at = NOW()`,
                            [pidHash, title, givenName, familyName, birthdate, gender, address, registration.phone || null]
                        );

                        await connection.execute(
                            `UPDATE registration_requests
                             SET pid_hash = ?, status = 'verified', verified_at = NOW()
                             WHERE id = ?`,
                            [pidHash, registration.id]
                        );

                        const citizenId = result.insertId;
                        const [registeredCitizens] = await connection.execute(
                            'SELECT id, pid_hash, title, given_name, family_name, birthdate, gender, address, phone FROM citizens WHERE id = ? OR pid_hash = ? LIMIT 1',
                            [citizenId, pidHash]
                        );
                        userRecord = registeredCitizens[0];
                    }

                }
            }

            // 4. บันทึก Activity Log
            try {
                // Use the correct ID based on user type (though activity_logs usually links to officer table, 
                // we might need to adjust activity_logs to support citizens or just log with null user_id and details)
                // For now, we'll log if it's an officer. If citizen, we might skip or log differently if schema enforces FK.
                // Assuming activity_logs.user_id FK references officer.id. If so, we can't log citizen activity with user_id.

                // Check if we can log:
                if (userType === 'officer') {
                    await connection.execute(
                        `INSERT INTO activity_logs 
                        (user_id, action_type, details, ip_address, user_agent, timestamp) 
                        VALUES (?, ?, ?, ?, ?, NOW())`,
                        [
                            userRecord.id,
                            'LOGIN',
                            `เข้าสู่ระบบด้วย ThaiD สำเร็จ (Officer) - User: ${userRecord.username}`,
                            request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
                            request.headers.get('user-agent') || 'unknown'
                        ]
                    );
                } else {
                    // For citizens, maybe just log to console or a different table if needed.
                    // Or query if activity_logs allows null user_id? 
                    // Let's safe-guard by not inserting if citizen for now to avoid FK error.
                }

            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }

            // 6. สร้าง Session Data
            let userData = {};

            if (userType === 'officer') {
                userData = {
                    id: userRecord.id,
                    username: userRecord.username,
                    title: userRecord.title,
                    givenName: userRecord.given_name,
                    familyName: userRecord.family_name,
                    email: userRecord.email,
                    phone: userRecord.phone,
                    role: userRecord.role,
                    roleDisplayName: roleDisplayNames[userRecord.role] || userRecord.role,
                    permissions: userRecord.is_approved ? (rolePermissions[userRecord.role] || rolePermissions.staff) : {},
                    loginMethod: 'thaiid',
                    isApproved: Number(userRecord.is_approved) === 1,
                    isNewUser: isNewUser,
                    position: userRecord.position,
                    department: userRecord.department,
                    requested_role: userRecord.requested_role,
                    userType: 'officer'
                };
            } else {
                // Citizen Session Data
                userData = {
                    id: userRecord.id, // Citizen ID
                    username: userRecord.pid_hash.substring(0, 10), // Mock username
                    title: userRecord.title,
                    givenName: userRecord.given_name,
                    familyName: userRecord.family_name,
                    role: 'citizen',
                    roleDisplayName: 'ประชาชน',
                    permissions: rolePermissions.citizen,
                    loginMethod: 'thaiid',
                    isApproved: true, // Citizens implicitly approved
                    isNewUser: isNewUser,
                    userType: 'citizen',
                    address: userRecord.address
                };
            }

            // 7. Redirect ไปหน้าที่เหมาะสม
            const baseUrl = getAppBaseUrl(request);
            let redirectPath = userType === 'officer' && Number(userRecord.is_approved) !== 1
                ? '/auth/thaiid/pending'
                : '/dashboard';

            const response = NextResponse.redirect(`${baseUrl}${redirectPath}`);

            if (userType === 'officer') {
                const sessionToken = crypto.randomBytes(32).toString('hex');
                const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
                const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
                    || request.headers.get('x-real-ip')
                    || 'unknown';
                const userAgent = request.headers.get('user-agent') || 'unknown';

                await connection.execute(
                    `INSERT INTO user_sessions
                    (session_token, user_id, username, title, given_name, family_name, email, phone, role, ip_address, user_agent, expires_at, login_method)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'thaiid')`,
                    [
                        sessionToken,
                        userRecord.id,
                        userRecord.username,
                        userRecord.title,
                        userRecord.given_name,
                        userRecord.family_name,
                        userRecord.email,
                        userRecord.phone,
                        userRecord.role,
                        ipAddress,
                        userAgent,
                        expiresAt
                    ]
                );

                response.cookies.set('session_token', sessionToken, {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'strict',
                    maxAge: 60 * 60 * 24,
                    path: '/'
                });

                clearRegistrationSessionCookie(response);
                clearCitizenSessionCookie(response);
            } else {
                setRegistrationSessionCookie(response, userData);
                setCitizenSessionCookie(response, {
                    pid,
                    given_name: userRecord.given_name,
                    family_name: userRecord.family_name
                });
            }

            response.cookies.set('thaiid_state', '', {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 0,
                path: '/'
            });

            connection.release();
            return applyNoStoreHeaders(response);

        } catch (dbError) {
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('ThaiD Callback Error:', error);
        const baseUrl = getAppBaseUrl(request);
        return applyNoStoreHeaders(NextResponse.redirect(
            `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent(error.message)}`
        ));
    }
}
