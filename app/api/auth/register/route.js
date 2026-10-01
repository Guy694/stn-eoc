import { NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { getPool } from "@/lib/db";
import { validatePassword } from "@/lib/passwordPolicy";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";

const pool = getPool();

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

function isValidPersonName(value) {
    const text = normalizeText(value);
    return text.length >= 2
        && text.length <= 100
        && /^[ก-๙A-Za-z.' -]+$/.test(text);
}

function isValidUsername(value) {
    return /^[a-zA-Z0-9._-]{4,50}$/.test(String(value || ''));
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
    // กันการส่งข้อมูลขยะ/สแปมจาก IP เดียวกัน
    const rateLimited = await enforceIpRateLimit(request, 'register');
    if (rateLimited) return rateLimited;

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

            const passwordError = validatePassword(password, { username });
            if (passwordError) {
                return buildValidationError(passwordError);
            }
        }

        connection = await pool.getConnection();

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
                { success: false, message: 'มีข้อมูลลงทะเบียนชื่อนี้ในระบบแล้ว กรุณาใช้ ThaiD เพื่อยืนยันตัวตนหรือติดต่อผู้ดูแลระบบ' },
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
                message: 'ลงทะเบียนเจ้าหน้าที่เรียบร้อยแล้ว กรุณาเข้าสู่ระบบด้วย ThaiD เพื่อยืนยันชื่อ-นามสกุล และรอผู้ดูแลอนุมัติสิทธิ์',
                next: 'thaiid',
                thaiid_url: '/stn-eoc/api/auth/thaiid/authorize/?from=registration&type=officer'
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
            message: 'บันทึกข้อมูลประชาชนเรียบร้อยแล้ว กรุณายืนยันตัวตนด้วย ThaiD เพื่อเข้าใช้งาน',
            next: 'thaiid',
            thaiid_url: '/stn-eoc/api/auth/thaiid/authorize/?from=registration&type=citizen'
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
