import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";

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

// ThaiID Configuration ตามคู่มือ DOPA
const THAIID_CONFIG = {
    tokenUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    userInfoUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    apiKey: process.env.APIKEY,
    redirectUri: `${process.env.CALLBACK}api/auth/thaiid/callback`,
};

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

const roleDisplayNames = {
    admin: 'ผู้ดูแลระบบ',
    MCATT: 'ทีม MCATT',
    SAT: 'ทีม SAT',
    SeRHT: 'ทีม SeRHT',
    staff: 'เจ้าหน้าที่'
};

/**
 * แลกเปลี่ยน Authorization Code กับ Access Token
 */
async function exchangeCodeForToken(code) {
    const tokenParams = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: THAIID_CONFIG.redirectUri,
        client_id: THAIID_CONFIG.clientId,
        client_secret: THAIID_CONFIG.clientSecret,
    });

    const response = await fetch(THAIID_CONFIG.tokenUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'API_KEY': THAIID_CONFIG.apiKey,
        },
        body: tokenParams.toString(),
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Token exchange failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
}

/**
 * ดึงข้อมูลผู้ใช้จาก ThaiID
 */
async function getUserInfo(accessToken) {
    const response = await fetch(THAIID_CONFIG.userInfoUrl, {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${accessToken}`,
            'API_KEY': THAIID_CONFIG.apiKey,
        },
    });

    if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Get user info failed: ${response.status} - ${errorText}`);
    }

    return await response.json();
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

        // ตรวจสอบว่ามี error จาก ThaiID หรือไม่
        if (error) {
            return NextResponse.redirect(
                `${process.env.CALLBACK}login?error=thaiid_auth_failed&message=${error}`
            );
        }

        // ตรวจสอบว่ามี code หรือไม่
        if (!code) {
            return NextResponse.redirect(
                `${process.env.CALLBACK}login?error=no_code`
            );
        }

        console.log('ThaiID Callback - Code received:', code);

        // 1. แลกเปลี่ยน Authorization Code กับ Access Token
        const tokenData = await exchangeCodeForToken(code);
        const accessToken = tokenData.access_token;

        console.log('ThaiID - Access Token received');

        // 2. ดึงข้อมูลผู้ใช้จาก ThaiID
        const userInfo = await getUserInfo(accessToken);
        const pid = userInfo.pid; // เลขบัตรประชาชน

        console.log('ThaiID - User PID:', pid);

        if (!pid) {
            return NextResponse.redirect(
                `${process.env.CALLBACK}login?error=no_pid`
            );
        }

        // 3. ค้นหาผู้ใช้ในฐานข้อมูลด้วย PID
        const connection = await pool.getConnection();

        try {
            const [officers] = await connection.execute(
                'SELECT id, username, full_name, email, phone, role, pid FROM officer WHERE pid = ?',
                [pid]
            );

            if (officers.length === 0) {
                connection.release();
                return NextResponse.redirect(
                    `${process.env.CALLBACK}login?error=user_not_found&pid=${pid}`
                );
            }

            const officer = officers[0];

            // 4. อัพเดท ThaiID access token ในฐานข้อมูล (ถ้ามีคอลัมน์)
            try {
                await connection.execute(
                    'UPDATE officer SET thaiid_token = ?, last_login = NOW() WHERE id = ?',
                    [accessToken, officer.id]
                );
            } catch (updateError) {
                console.log('Note: thaiid_token column may not exist yet:', updateError.message);
            }

            // 5. บันทึก Activity Log
            try {
                await connection.execute(
                    `INSERT INTO activity_logs 
                    (user_id, user_name, action, details, ip_address, user_agent, timestamp) 
                    VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        officer.id,
                        officer.username,
                        'LOGIN_THAIID',
                        `เข้าสู่ระบบด้วย ThaiID สำเร็จ - PID: ${pid}`,
                        request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || 'unknown',
                        request.headers.get('user-agent') || 'unknown'
                    ]
                );
            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }

            connection.release();

            // 6. สร้าง Session Data
            const userData = {
                id: officer.id,
                username: officer.username,
                fullName: officer.full_name,
                email: officer.email,
                phone: officer.phone,
                role: officer.role,
                roleDisplayName: roleDisplayNames[officer.role] || officer.role,
                permissions: rolePermissions[officer.role] || rolePermissions.staff,
                pid: officer.pid,
                loginMethod: 'thaiid'
            };

            // 7. Redirect ไปหน้า callback page พร้อมข้อมูล
            const response = NextResponse.redirect(`${process.env.CALLBACK}auth/thaiid/callback`);

            // เก็บข้อมูลใน cookie (encrypted ด้วย httpOnly)
            response.cookies.set('user_session', JSON.stringify(userData), {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: 'lax',
                maxAge: 60 * 60 * 24 // 24 hours
            });

            return response;

        } catch (dbError) {
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('ThaiID Callback Error:', error);
        return NextResponse.redirect(
            `${process.env.CALLBACK}login?error=callback_failed&message=${encodeURIComponent(error.message)}`
        );
    }
}
