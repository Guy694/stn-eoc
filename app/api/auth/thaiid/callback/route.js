import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import crypto from "crypto";
import { clearCitizenSessionCookie, setCitizenSessionCookie } from "@/lib/citizenAuth";
import { applyNoStoreHeaders, getThaiIdConfigError, getThaiIdOAuthConfig } from "@/lib/thaiIdConfig";

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
    const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: thaiIdConfig.redirectUri,
        client_id: thaiIdConfig.clientId,
        client_secret: thaiIdConfig.clientSecret,
    });

    // สร้าง AbortController สำหรับ timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 วินาที

    try {
        const response = await fetch(thaiIdConfig.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'API_KEY': thaiIdConfig.apiKey,
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
            throw new Error('การเชื่อมต่อ ThaiID หมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง');
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
                'API_KEY': thaiIdConfig.apiKey,
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
            throw new Error('การเชื่อมต่อ ThaiID UserInfo หมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง');
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

/**
 * Callback Handler สำหรับ ThaiID OAuth
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

        // ตรวจสอบว่ามี error จาก ThaiID หรือไม่
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
            const baseUrl = getAppBaseUrl(request);
            return applyNoStoreHeaders(NextResponse.redirect(
                `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent('ThaiID state ไม่ถูกต้อง กรุณาเริ่มเข้าสู่ระบบใหม่')}`
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
            // STEP 2.1: Check Officer Table First
            const [officers] = await connection.execute(
                'SELECT id, username, title, given_name, family_name, email, phone, role, pid_hash, is_approved, position, department FROM officer WHERE pid_hash = ?',
                [pidHash]
            );

            let userRecord;
            let isNewUser = false;
            let userType = 'officer'; // 'officer' or 'citizen'

            if (officers.length > 0) {
                // FOUND IN OFFICERS -> Login as Officer
                userRecord = officers[0];
                userType = 'officer';

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
                    // NOT FOUND IN EITHER -> Create New Citizen
                    userType = 'citizen';
                    isNewUser = true;

                    const title = thaiIdProfile.title || null;
                    const givenName = thaiIdProfile.given_name || '';
                    const familyName = thaiIdProfile.family_name || '';
                    const birthdate = thaiIdProfile.birthdate || null;
                    const gender = thaiIdProfile.gender || null;
                    const address = thaiIdProfile.address || null;

                    const [result] = await connection.execute(
                        `INSERT INTO citizens 
                        (pid_hash, title, given_name, family_name, birthdate, gender, address, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                        [pidHash, title, givenName, familyName, birthdate, gender, address]
                    );

                    userRecord = {
                        id: result.insertId,
                        pid_hash: pidHash,
                        title,
                        given_name: givenName,
                        family_name: familyName,
                        birthdate,
                        gender,
                        address
                    };

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
                            `เข้าสู่ระบบด้วย ThaiID สำเร็จ (Officer) - User: ${userRecord.username}`,
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
                    isApproved: userRecord.is_approved,
                    isNewUser: isNewUser,
                    position: userRecord.position,
                    department: userRecord.department,
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
            let redirectPath = '/dashboard';

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

                response.cookies.set('user_session', '', {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 0,
                    path: '/'
                });
                clearCitizenSessionCookie(response);
            } else {
                response.cookies.set('user_session', JSON.stringify(userData), {
                    httpOnly: true,
                    secure: process.env.NODE_ENV === 'production',
                    sameSite: 'lax',
                    maxAge: 60 * 60 * 24,
                    path: '/'
                });
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
        console.error('ThaiID Callback Error:', error);
        const baseUrl = getAppBaseUrl(request);
        return applyNoStoreHeaders(NextResponse.redirect(
            `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent(error.message)}`
        ));
    }
}
