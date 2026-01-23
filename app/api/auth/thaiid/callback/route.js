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

// ฟังก์ชันเข้ารหัส PID ด้วย AES-256-GCM สำหรับความปลอดภัย (PDPA Compliance)
function encryptPID(pid) {
    const secretKey = process.env.SECRET_KEY;
    if (!secretKey) {
        throw new Error('SECRET_KEY is not defined in environment variables');
    }

    // สร้าง key ขนาด 32 bytes จาก SECRET_KEY
    const key = crypto.createHash('sha256').update(secretKey).digest();

    // สร้าง initialization vector (IV) แบบสุ่ม
    const iv = crypto.randomBytes(16);

    // สร้าง cipher ด้วย AES-256-GCM
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

    // เข้ารหัสข้อมูล
    let encrypted = cipher.update(pid, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    // ดึง auth tag
    const authTag = cipher.getAuthTag();

    // รวม IV + encrypted data + auth tag เข้าด้วยกัน (คั่นด้วย :)
    return iv.toString('hex') + ':' + encrypted + ':' + authTag.toString('hex');
}

// ฟังก์ชันถอดรหัส PID
function decryptPID(encryptedPID) {
    try {
        const secretKey = process.env.SECRET_KEY;
        if (!secretKey) {
            throw new Error('SECRET_KEY is not defined in environment variables');
        }

        // แยก IV, encrypted data, และ auth tag
        const parts = encryptedPID.split(':');
        if (parts.length !== 3) {
            throw new Error('Invalid encrypted PID format');
        }

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const authTag = Buffer.from(parts[2], 'hex');

        // สร้าง key ขนาด 32 bytes จาก SECRET_KEY
        const key = crypto.createHash('sha256').update(secretKey).digest();

        // สร้าง decipher
        const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);

        // ถอดรหัส
        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error('Error decrypting PID:', error);
        throw new Error('Failed to decrypt PID');
    }
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

        // เข้ารหัส PID เพื่อความปลอดภัย
        const encryptedPID = encryptPID(pid);
        console.log('ThaiID - PID Encrypted for security');

        // 2. ค้นหาผู้ใช้ในฐานข้อมูลด้วย Encrypted PID
        const connection = await pool.getConnection();

        try {
            // STEP 2.1: Check Officer Table First
            const [officers] = await connection.execute(
                'SELECT id, username, title, given_name, family_name, email, phone, role, pid_hash, is_approved, position, department FROM officer WHERE pid_hash = ?',
                [encryptedPID]
            );

            let userRecord;
            let isNewUser = false;
            let userType = 'officer'; // 'officer' or 'citizen'

            if (officers.length > 0) {
                // FOUND IN OFFICERS -> Login as Officer
                console.log('ThaiID - User found in OFFICERS table');
                userRecord = officers[0];
                userType = 'officer';

                // Update Officer Data
                const title = tokenData.title || userRecord.title;
                const givenName = tokenData.given_name || userRecord.given_name;
                const familyName = tokenData.family_name || userRecord.family_name;

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
                console.log('ThaiID - User NOT found in OFFICERS table. Checking CITIZENS table...');

                const [citizens] = await connection.execute(
                    'SELECT id, pid_hash, title, given_name, family_name, birthdate, gender, address, phone FROM citizens WHERE pid_hash = ?',
                    [encryptedPID]
                );

                if (citizens.length > 0) {
                    // FOUND IN CITIZENS -> Login as Citizen
                    console.log('ThaiID - User found in CITIZENS table');
                    userRecord = citizens[0];
                    userType = 'citizen';

                    // Update Citizen Data
                    await connection.execute(
                        `UPDATE citizens 
                        SET title = ?, given_name = ?, family_name = ?, address = ?, updated_at = NOW() 
                        WHERE id = ?`,
                        [
                            tokenData.title || userRecord.title,
                            tokenData.given_name || userRecord.given_name,
                            tokenData.family_name || userRecord.family_name,
                            tokenData.address || userRecord.address,
                            userRecord.id
                        ]
                    );

                    // Update object locally
                    userRecord.title = tokenData.title || userRecord.title;
                    userRecord.given_name = tokenData.given_name || userRecord.given_name;
                    userRecord.family_name = tokenData.family_name || userRecord.family_name;
                    userRecord.address = tokenData.address || userRecord.address;

                } else {
                    // NOT FOUND IN EITHER -> Create New Citizen
                    console.log('ThaiID - User NOT found anywhere. Creating new CITIZEN record...');
                    userType = 'citizen';
                    isNewUser = true;

                    const title = tokenData.title || null;
                    const givenName = tokenData.given_name || '';
                    const familyName = tokenData.family_name || '';
                    const birthdate = tokenData.birthdate || null;
                    const gender = tokenData.gender || null;
                    const address = tokenData.address || null;

                    const [result] = await connection.execute(
                        `INSERT INTO citizens 
                        (pid_hash, title, given_name, family_name, birthdate, gender, address, created_at) 
                        VALUES (?, ?, ?, ?, ?, ?, ?, NOW())`,
                        [encryptedPID, title, givenName, familyName, birthdate, gender, address]
                    );

                    userRecord = {
                        id: result.insertId,
                        pid_hash: encryptedPID,
                        title,
                        given_name: givenName,
                        family_name: familyName,
                        birthdate,
                        gender,
                        address
                    };

                    console.log('ThaiID - New CITIZEN created:', userRecord.id);
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
                    console.log('Skipping activity log for citizen login (to avoid FK constraints)');
                }

            } catch (logError) {
                console.error('Failed to log activity:', logError);
            }

            connection.release();

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

            // Add ThaiID specific data
            userData.thaiIdData = {
                title: tokenData.title,
                name: tokenData.name,
                given_name: tokenData.given_name,
                family_name: tokenData.family_name,
                birthdate: tokenData.birthdate,
                gender: tokenData.gender,
                address: tokenData.address
            };

            // 7. Redirect ไปหน้าที่เหมาะสม
            const baseUrl = 'https://addilyn-oversubtle-untensely.ngrok-free.dev';
            let redirectPath = '/dashboard';

            console.log('Redirecting to:', `${baseUrl}${redirectPath}`);
            console.log('Setting user session cookie for user:', userData.givenName);

            const response = NextResponse.redirect(`${baseUrl}${redirectPath}`);

            // เก็บข้อมูลใน cookie (encrypted ด้วย httpOnly)
            response.cookies.set('user_session', JSON.stringify(userData), {
                httpOnly: true,
                secure: true,
                sameSite: 'none',
                maxAge: 60 * 60 * 24, // 24 hours
                path: '/'
            });

            console.log('Cookie set successfully');
            return response;

        } catch (dbError) {
            connection.release();
            throw dbError;
        }

    } catch (error) {
        console.error('ThaiID Callback Error:', error);
        const baseUrl = 'https://addilyn-oversubtle-untensely.ngrok-free.dev';
        return NextResponse.redirect(
            `${baseUrl}/login?error=callback_failed&message=${encodeURIComponent(error.message)}`
        );
    }
}
