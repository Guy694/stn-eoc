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

const VALID_USER_TYPES = new Set(['citizen', 'officer']);
const VALID_ROLES = new Set(['staff', 'MCATT', 'SAT', 'SeRHT', 'commander']);

function normalizeName(value) {
    return String(value || '')
        .normalize('NFC')
        .replace(/\s+/g, '')
        .toLowerCase()
        .trim();
}

function normalizeText(value) {
    return String(value || '').replace(/\s+/g, ' ').trim();
}

function getClientIp(request) {
    return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
        || request.headers.get('x-real-ip')
        || 'unknown';
}

function isValidPersonName(value) {
    const text = normalizeText(value);
    return text.length >= 2
        && text.length <= 100
        && /^[ก-๙A-Za-z.' -]+$/.test(text);
}

function isValidUsername(value) {
    return /^[a-zA-Z0-9._-]{4,50}$/.test(String(value || ''));
}

function isStrongEnoughPassword(value) {
    const password = String(value || '');
    return password.length >= 8
        && /[A-Za-z]/.test(password)
        && /[0-9]/.test(password);
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

async function getAgencyOptions(connection) {
    const [rows] = await connection.execute(`
        SELECT DISTINCT name AS agency
        FROM health_facilities
        WHERE COALESCE(is_active, 1) = 1
          AND name IS NOT NULL
          AND name <> ''
        ORDER BY agency ASC
    `);

    return rows.map((row) => row.agency);
}

async function assertRateLimit(connection, ipAddress) {
    const [recentRows] = await connection.execute(
        `SELECT
            SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR) THEN 1 ELSE 0 END) AS hourly_count,
            SUM(CASE WHEN created_at > DATE_SUB(NOW(), INTERVAL 1 DAY) THEN 1 ELSE 0 END) AS daily_count
         FROM registration_requests
         WHERE request_ip = ?`,
        [ipAddress]
    );

    const hourlyCount = Number(recentRows[0]?.hourly_count || 0);
    const dailyCount = Number(recentRows[0]?.daily_count || 0);

    if (hourlyCount >= 5 || dailyCount >= 20) {
        return {
            allowed: false,
            message: 'มีการลงทะเบียนจาก IP นี้บ่อยเกินไป กรุณาลองใหม่ภายหลัง'
        };
    }

    return { allowed: true };
}

function buildValidationError(message) {
    return NextResponse.json({ success: false, message }, { status: 400 });
}

export async function GET() {
    let connection;

    try {
        connection = await pool.getConnection();
        await ensureRegistrationSchema(connection);
        const agencies = await getAgencyOptions(connection);

        return NextResponse.json({
            success: true,
            agencies
        });
    } catch (error) {
        console.error('Registration options error:', error);
        return NextResponse.json(
            { success: false, message: 'ไม่สามารถดึงข้อมูลหน่วยงานได้' },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}

export async function POST(request) {
    let connection;

    try {
        const body = await request.json();
        const userType = normalizeText(body.user_type);
        const title = normalizeText(body.title);
        const givenName = normalizeText(body.given_name);
        const familyName = normalizeText(body.family_name);
        const agency = normalizeText(body.agency);
        const username = normalizeText(body.username);
        const password = String(body.password || '');
        const requestedRole = VALID_ROLES.has(body.requested_role) ? body.requested_role : 'staff';
        const email = normalizeText(body.email);
        const phone = normalizeText(body.phone);
        const ipAddress = getClientIp(request);
        const userAgent = request.headers.get('user-agent') || 'unknown';

        if (!VALID_USER_TYPES.has(userType)) {
            return buildValidationError('กรุณาเลือกประเภทผู้ลงทะเบียน');
        }

        if (!isValidPersonName(givenName) || !isValidPersonName(familyName)) {
            return buildValidationError('กรุณากรอกชื่อและนามสกุลเป็นตัวอักษรเท่านั้น');
        }

        if (!agency || agency.length < 2 || agency.length > 255) {
            return buildValidationError('กรุณาเลือกหน่วยงาน');
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return buildValidationError('รูปแบบอีเมลไม่ถูกต้อง');
        }

        if (phone && !/^[0-9+\-\s()]{8,20}$/.test(phone)) {
            return buildValidationError('รูปแบบเบอร์โทรศัพท์ไม่ถูกต้อง');
        }

        if (userType === 'officer') {
            if (!isValidUsername(username)) {
                return buildValidationError('username ต้องยาว 4-50 ตัว และใช้ได้เฉพาะ a-z, 0-9, จุด, ขีดกลาง, ขีดล่าง');
            }

            if (!isStrongEnoughPassword(password)) {
                return buildValidationError('password ต้องยาวอย่างน้อย 8 ตัว และมีทั้งตัวอักษรกับตัวเลข');
            }
        }

        connection = await pool.getConnection();
        await ensureRegistrationSchema(connection);

        const rateLimit = await assertRateLimit(connection, ipAddress);
        if (!rateLimit.allowed) {
            return NextResponse.json(
                { success: false, message: rateLimit.message },
                { status: 429 }
            );
        }

        const agencies = await getAgencyOptions(connection);
        if (!agencies.includes(agency)) {
            return buildValidationError('หน่วยงานไม่อยู่ในรายการที่ระบบรองรับ');
        }

        const normalizedGivenName = normalizeName(givenName);
        const normalizedFamilyName = normalizeName(familyName);

        const [duplicateProfiles] = await connection.execute(
            `SELECT id, status
             FROM registration_requests
             WHERE user_type = ?
               AND normalized_given_name = ?
               AND normalized_family_name = ?
               AND status IN ('pending', 'verified', 'approved')
             LIMIT 1`,
            [userType, normalizedGivenName, normalizedFamilyName]
        );

        if (duplicateProfiles.length > 0) {
            return NextResponse.json(
                { success: false, message: 'มีข้อมูลลงทะเบียนชื่อนี้ในระบบแล้ว กรุณาใช้ ThaiID เพื่อยืนยันตัวตนหรือติดต่อผู้ดูแลระบบ' },
                { status: 409 }
            );
        }

        if (userType === 'officer') {
            const [duplicateOfficers] = await connection.execute(
                'SELECT id FROM officer WHERE username = ? LIMIT 1',
                [username]
            );
            const [duplicateRegistrations] = await connection.execute(
                'SELECT id FROM registration_requests WHERE username = ? LIMIT 1',
                [username]
            );

            if (duplicateOfficers.length > 0 || duplicateRegistrations.length > 0) {
                return NextResponse.json(
                    { success: false, message: 'username นี้ถูกใช้แล้ว' },
                    { status: 409 }
                );
            }

            const passwordHash = await bcrypt.hash(password, 12);
            await connection.beginTransaction();

            const [officerResult] = await connection.execute(
                `INSERT INTO officer
                    (username, password_hash, title, given_name, family_name, email, phone, role, department, requested_role, is_approved, request_time)
                 VALUES (?, ?, ?, ?, ?, ?, ?, 'staff', ?, ?, 0, NOW())`,
                [username, passwordHash, title || null, givenName, familyName, email || null, phone || null, agency, requestedRole]
            );

            await connection.execute(
                `INSERT INTO registration_requests
                    (user_type, officer_id, title, given_name, family_name, normalized_given_name, normalized_family_name, agency, username, email, phone, status, request_ip, user_agent)
                 VALUES ('officer', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
                [
                    officerResult.insertId,
                    title || null,
                    givenName,
                    familyName,
                    normalizedGivenName,
                    normalizedFamilyName,
                    agency,
                    username,
                    email || null,
                    phone || null,
                    ipAddress,
                    userAgent
                ]
            );

            await connection.commit();

            return NextResponse.json({
                success: true,
                message: 'ลงทะเบียนเจ้าหน้าที่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วย ThaiID เพื่อยืนยันชื่อ-นามสกุล และรอผู้ดูแลอนุมัติสิทธิ์',
                next: 'thaiid',
                thaiid_url: '/stn-eoc/api/auth/thaiid/authorize/?from=registration'
            }, { status: 201 });
        }

        await connection.execute(
            `INSERT INTO registration_requests
                (user_type, title, given_name, family_name, normalized_given_name, normalized_family_name, agency, email, phone, status, request_ip, user_agent)
             VALUES ('citizen', ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)`,
            [
                title || null,
                givenName,
                familyName,
                normalizedGivenName,
                normalizedFamilyName,
                agency,
                email || null,
                phone || null,
                ipAddress,
                userAgent
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึกข้อมูลประชาชนเรียบร้อยแล้ว กรุณายืนยันตัวตนด้วย ThaiID เพื่อเข้าใช้งาน',
            next: 'thaiid',
            thaiid_url: '/stn-eoc/api/auth/thaiid/authorize/?from=registration'
        }, { status: 201 });
    } catch (error) {
        if (connection) {
            try {
                await connection.rollback();
            } catch {
                // Ignore rollback errors after non-transactional failures.
            }
        }

        console.error('Public registration error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการลงทะเบียน' },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
