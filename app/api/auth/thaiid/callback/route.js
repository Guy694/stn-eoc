import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "crypto";

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

// ฟังก์ชัน Hash PID ด้วย SHA-256 สำหรับความปลอดภัย (PDPA Compliance)
function hashPID(pid) {
    return crypto.createHash('sha256').update(pid).digest('hex');
}

// ThaiID Configuration ตามคู่มือ DOPA
const THAIID_CONFIG = {
    tokenUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/token/',
    userInfoUrl: 'https://imauth.bora.dopa.go.th/api/v2/oauth2/userinfo/',
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    apiKey: process.env.APIKEY,
    redirectUri: process.env.CALLBACK,
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
    },
    user: {
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
    user: 'ผู้ใช้งานทั่วไป'
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

    console.log('Token Exchange Request:', {
        url: THAIID_CONFIG.tokenUrl,
        redirectUri: THAIID_CONFIG.redirectUri,
        clientId: THAIID_CONFIG.clientId ? 'Present' : 'Missing',
        clientSecret: THAIID_CONFIG.clientSecret ? 'Present' : 'Missing',
        apiKey: THAIID_CONFIG.apiKey ? 'Present' : 'Missing',
        code: code ? 'Present' : 'Missing'
    });

    // สร้าง AbortController สำหรับ timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 วินาที

    try {
        const response = await fetch(THAIID_CONFIG.tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'API_KEY': THAIID_CONFIG.apiKey,
            },
            body: tokenParams.toString(),
            signal: controller.signal
        });

        clearTimeout(timeout);

        const responseText = await response.text();
        console.log('Token Exchange Response Status:', response.status);
        console.log('Token Exchange Response Body:', responseText);

        if (!response.ok) {
            throw new Error(`Token exchange failed: ${response.status} - ${responseText}`);
        }

        const tokenData = JSON.parse(responseText);
        console.log('Token Data Keys:', Object.keys(tokenData));
        console.log('Access Token Present:', tokenData.access_token ? 'Yes' : 'No');

        return tokenData;
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('การเชื่อมต่อ ThaiID หมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง');
        }
        throw error;
    }
}

/**
 * ดึงข้อมูลผู้ใช้จาก ThaiID
 */
async function getUserInfo(accessToken) {
    console.log('Requesting userinfo with:', {
        url: THAIID_CONFIG.userInfoUrl,
        apiKey: THAIID_CONFIG.apiKey ? 'Present' : 'Missing',
        accessToken: accessToken ? accessToken.substring(0, 20) + '...' : 'Missing'
    });

    // ส่ง access_token ใน body ตามเอกสาร ThaiID
    const userInfoParams = new URLSearchParams({
        access_token: accessToken
    });

    // สร้าง AbortController สำหรับ timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000); // 30 วินาที

    try {
        const response = await fetch(THAIID_CONFIG.userInfoUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'API_KEY': THAIID_CONFIG.apiKey,
            },
            body: userInfoParams.toString(),
            signal: controller.signal
        });

        clearTimeout(timeout);

        const responseText = await response.text();
        console.log('UserInfo Response Status:', response.status);
        console.log('UserInfo Response Body:', responseText);

        if (!response.ok) {
            throw new Error(`Get user info failed: ${response.status} - ${responseText}`);
        }

        return JSON.parse(responseText);
    } catch (error) {
        clearTimeout(timeout);
        if (error.name === 'AbortError') {
            throw new Error('การเชื่อมต่อ ThaiID หมดเวลา (timeout) กรุณาลองใหม่อีกครั้ง');
        }
        throw error;
    }
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
        const pid = tokenData.pid; // ThaiID ส่ง PID มาพร้อมกับ token response แล้ว

        console.log('ThaiID - Access Token received:', accessToken ? 'Yes' : 'No');
        console.log('ThaiID - Token Data:', JSON.stringify(tokenData));
        console.log('ThaiID - PID from token:', pid);
        console.log('ThaiID - Full Data:', {
            pid: tokenData.pid,
            name: tokenData.name,
            given_name: tokenData.given_name,
            family_name: tokenData.family_name,
            birthdate: tokenData.birthdate,
            gender: tokenData.gender,
            address: tokenData.address
        });

        if (!pid) {
            return NextResponse.redirect(
                `${process.env.CALLBACK}login?error=no_pid`
            );
        }

        // Hash PID เพื่อความปลอดภัย
        const hashedPID = hashPID(pid);
        console.log('ThaiID - PID Hashed for security');

        // 2. ค้นหาผู้ใช้ในฐานข้อมูลด้วย Hashed PID
        const connection = await pool.getConnection();

        try {
            const [officers] = await connection.execute(
                'SELECT id, username, title, given_name, family_name, email, phone, role, pid_hash, is_approved, position, department FROM officer WHERE pid_hash = ?',
                [hashedPID]
            );

            let officer;
            let isNewUser = false;

            if (officers.length === 0) {
                // ไม่พบผู้ใช้ -> สร้าง pending user ใหม่
                console.log('ThaiID - Creating new pending user');

                const username = `thaiid_${pid.substring(0, 8)}`; // username ชั่วคราวจาก PID
                const title = tokenData.title || null;
                const givenName = tokenData.given_name || '';
                const familyName = tokenData.family_name || '';

                const [result] = await connection.execute(
                    `INSERT INTO officer 
                    (username, password_hash, title, given_name, family_name, role, pid_hash, is_approved, request_time, created_at) 
                    VALUES (?, ?, ?, ?, ?, 'user', ?, FALSE, NOW(), NOW())`,
                    [username, await bcrypt.hash(Math.random().toString(36), 10), title, givenName, familyName, hashedPID]
                );

                // ดึงข้อมูล user ที่สร้างใหม่
                const [newOfficers] = await connection.execute(
                    'SELECT id, username, title, given_name, family_name, email, phone, role, pid_hash, is_approved, position, department FROM officer WHERE id = ?',
                    [result.insertId]
                );

                officer = newOfficers[0];
                isNewUser = true;

                console.log('ThaiID - New pending user created:', officer.id);
            } else {
                // พบผู้ใช้เดิม -> อัพเดทข้อมูลจาก ThaiID
                officer = officers[0];

                console.log('ThaiID - Updating existing user data from ThaiID');

                const title = tokenData.title || officer.title;
                const givenName = tokenData.given_name || officer.given_name;
                const familyName = tokenData.family_name || officer.family_name;

                // อัพเดทข้อมูลจาก ThaiID ลงฐานข้อมูล
                await connection.execute(
                    `UPDATE officer 
                    SET title = ?, given_name = ?, family_name = ?, last_login = NOW() 
                    WHERE id = ?`,
                    [title, givenName, familyName, officer.id]
                );

                // อัพเดทข้อมูลใน officer object
                officer.title = title;
                officer.given_name = givenName;
                officer.family_name = familyName;

                console.log('ThaiID - User data updated from ThaiID');
            }

            // ตรวจสอบสถานะการอนุมัติ
            if (!officer.is_approved) {
                console.log('ThaiID - User pending approval');
            }

            // 4. บันทึก Activity Log
            try {
                await connection.execute(
                    `INSERT INTO activity_logs 
                    (user_id, action_type, details, ip_address, user_agent, timestamp) 
                    VALUES (?, ?, ?, ?, ?, NOW())`,
                    [
                        officer.id,
                        'LOGIN_THAIID',
                        `เข้าสู่ระบบด้วย ThaiID สำเร็จ - User: ${officer.username}`,
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
                title: officer.title,
                givenName: officer.given_name,
                familyName: officer.family_name,
                email: officer.email,
                phone: officer.phone,
                role: officer.role,
                roleDisplayName: roleDisplayNames[officer.role] || officer.role,
                permissions: officer.is_approved ? (rolePermissions[officer.role] || rolePermissions.staff) : {}, // ไม่มี permission ถ้ายังไม่ approved
                loginMethod: 'thaiid',
                isApproved: officer.is_approved,
                isNewUser: isNewUser,
                position: officer.position,
                department: officer.department,
                // ข้อมูลเพิ่มเติมจาก ThaiID
                thaiIdData: {
                    title: tokenData.title,
                    name: tokenData.name,
                    given_name: tokenData.given_name,
                    family_name: tokenData.family_name,
                    birthdate: tokenData.birthdate,
                    gender: tokenData.gender,
                    address: tokenData.address
                }
            };

            // 7. Redirect ไปหน้าที่เหมาะสม
            const baseUrl = 'https://tartily-unrecluse-emily.ngrok-free.dev';
            let redirectPath = '/dashboard';

            // ทุกคนไปหน้า dashboard (ระบบจะจัดการเมนูตาม approval status)
            // ถ้ายังไม่ approved จะเห็นเฉพาะเมนูสมัครเจ้าหน้าที่

            console.log('Redirecting to:', `${baseUrl}${redirectPath}`);
            console.log('Setting user session cookie for user:', userData.username);
            const response = NextResponse.redirect(`${baseUrl}${redirectPath}`);

            // เก็บข้อมูลใน cookie (encrypted ด้วย httpOnly)
            // ใช้ secure: true เพราะ ngrok เป็น https
            response.cookies.set('user_session', JSON.stringify(userData), {
                httpOnly: true,
                secure: true, // ใช้ true เพราะ ngrok เป็น https
                sameSite: 'lax',
                maxAge: 60 * 60 * 24, // 24 hours
                path: '/' // ระบุ path ให้ชัดเจน
            });

            console.log('Cookie set successfully');
            return response;

        } catch (dbError) {
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('ThaiID Callback Error:', error);
        const baseUrl = 'https://tartily-unrecluse-emily.ngrok-free.dev';
        return NextResponse.redirect(
            `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent(error.message)}`
        );
    }
}
