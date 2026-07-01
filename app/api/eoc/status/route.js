import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getSessionToken, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createRandomFilename, resolveInside } from "@/lib/fileUpload";

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

const MAX_ORDER_FILE_SIZE_BYTES = 20 * 1024 * 1024;
const ORDER_FILE_TYPES = new Map([
    ['application/pdf', 'pdf'],
    ['application/msword', 'doc'],
    ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'docx'],
    ['image/jpeg', 'jpg'],
    ['image/jpg', 'jpg'],
    ['image/png', 'png']
]);

function normalizeDateTimeLocal(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    const match = trimmed.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/);
    if (!match) return null;

    const date = new Date(trimmed);
    if (Number.isNaN(date.getTime())) return null;

    return `${match[1]} ${match[2]}:${match[3] || '00'}`;
}

function formatDateForMysql(date) {
    const pad = (value) => String(value).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function hasOrderFileColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'eoc_sessions'
           AND COLUMN_NAME IN ('open_order_file_path', 'open_order_file_name')`
    );
    return columns.length === 2;
}

function getOrderFileExtension(file) {
    const mimeExtension = ORDER_FILE_TYPES.get(file.type);
    if (mimeExtension) return mimeExtension;

    const originalExtension = path.extname(file.name || '').replace('.', '').toLowerCase();
    if (['pdf', 'doc', 'docx', 'jpg', 'jpeg', 'png'].includes(originalExtension)) {
        return originalExtension === 'jpeg' ? 'jpg' : originalExtension;
    }

    return null;
}

async function saveOrderFile(file, eocType) {
    if (!file || typeof file.arrayBuffer !== 'function' || !file.size) {
        return { ok: false, error: 'กรุณาแนบไฟล์คำสั่งการเปิด EOC' };
    }

    if (file.size > MAX_ORDER_FILE_SIZE_BYTES) {
        return { ok: false, error: 'ไฟล์คำสั่งต้องมีขนาดไม่เกิน 20MB' };
    }

    const extension = getOrderFileExtension(file);
    if (!extension) {
        return { ok: false, error: 'รองรับไฟล์คำสั่งเฉพาะ PDF, DOC, DOCX, JPG หรือ PNG' };
    }

    const uploadBaseDir = path.join(process.cwd(), 'public', 'uploads');
    const uploadDir = resolveInside(uploadBaseDir, 'eoc-orders', eocType);
    await mkdir(uploadDir, { recursive: true });

    const filename = createRandomFilename(extension, `${eocType}-order`);
    const filepath = resolveInside(uploadDir, filename);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(filepath, buffer);

    return {
        ok: true,
        filePath: `/uploads/eoc-orders/${eocType}/${filename}`,
        originalName: path.basename(file.name || filename)
    };
}

// GET - ดึงสถานะ EOC ทั้งหมด หรือเฉพาะ type
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const sessionToken = getSessionToken(request);
        const isAuthenticatedRequest = Boolean(sessionToken);

        if (isAuthenticatedRequest) {
            const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
            if (!auth.success) return auth.response;
        }

        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('type'); // flood, drought, tsunami, earthquake, disease
        const hasOrderColumns = await hasOrderFileColumns(connection);
        const orderFileSelect = hasOrderColumns
            ? `sess.open_order_file_path,
                sess.open_order_file_name,`
            : `NULL as open_order_file_path,
                NULL as open_order_file_name,`;

        let query = isAuthenticatedRequest ? `
            SELECT 
                es.id,
                es.eoc_type,
                es.name_th,
                es.name_en,
                es.icon,
                es.color_primary,
                es.color_gradient,
                es.is_active,
                es.activated_at,
                es.deactivated_at,
                es.description,
                es.created_at,
                es.updated_at,
                sess.id as session_id,
                sess.session_number,
                sess.festival_type,
                ${orderFileSelect}
                sess.status as session_status,
                ao.username as activated_by_username,
                ao.title as activated_by_title,
                ao.given_name as activated_by_given_name,
                ao.family_name as activated_by_family_name,
                do.username as deactivated_by_username,
                do.title as deactivated_by_title,
                do.given_name as deactivated_by_given_name,
                do.family_name as deactivated_by_family_name
            FROM eoc_status es
            LEFT JOIN officer ao ON es.activated_by = ao.id
            LEFT JOIN officer do ON es.deactivated_by = do.id
            LEFT JOIN eoc_sessions sess ON es.eoc_type = sess.eoc_type AND sess.status = 'active'
        ` : `
            SELECT 
                es.id,
                es.eoc_type,
                es.name_th,
                es.name_en,
                es.icon,
                es.color_primary,
                es.color_gradient,
                es.is_active,
                es.activated_at,
                es.deactivated_at,
                es.description,
                es.created_at,
                es.updated_at,
                sess.id as session_id,
                sess.session_number,
                sess.festival_type,
                ${orderFileSelect}
                sess.status as session_status
            FROM eoc_status es
            LEFT JOIN eoc_sessions sess ON es.eoc_type = sess.eoc_type AND sess.status = 'active'
        `;

        let params = [];

        if (eocType) {
            query += ' WHERE es.eoc_type = ?';
            params.push(eocType);
        }

        query += ' ORDER BY es.eoc_type';

        const [rows] = await connection.execute(query, params);

        const formattedRows = isAuthenticatedRequest
            ? rows.map(row => ({
                ...row,
                activated_by_name: row.activated_by_title && row.activated_by_given_name && row.activated_by_family_name
                    ? `${row.activated_by_title}${row.activated_by_given_name} ${row.activated_by_family_name}`
                    : null,
                deactivated_by_name: row.deactivated_by_title && row.deactivated_by_given_name && row.deactivated_by_family_name
                    ? `${row.deactivated_by_title}${row.deactivated_by_given_name} ${row.deactivated_by_family_name}`
                    : null
            }))
            : rows;

        return NextResponse.json({
            success: true,
            data: formattedRows
        });

    } catch (error) {
        console.error('Error fetching EOC status:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลสถานะ EOC');
    } finally {
        connection.release();
    }
}

// POST - เปิด/ปิด EOC (admin only)
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const auth = await requireAuth(request, ['admin', 'commander']);
        if (!auth.success) return auth.response;

        const contentType = request.headers.get('content-type') || '';
        let eocType;
        let isActive;
        let description;
        let festivalType;
        let openedAt;
        let closedAt;
        let orderFile = null;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            eocType = formData.get('eocType');
            isActive = formData.get('isActive') === 'true';
            description = formData.get('description') || '';
            festivalType = formData.get('festivalType') || null;
            openedAt = formData.get('openedAt') || null;
            closedAt = formData.get('closedAt') || null;
            orderFile = formData.get('orderFile');
        } else {
            const body = await request.json();
            eocType = body.eocType;
            isActive = body.isActive;
            description = body.description;
            festivalType = body.festivalType;
            openedAt = body.openedAt;
            closedAt = body.closedAt;
        }

        const userId = auth.user.id;

        // Validate input
        if (!eocType || isActive === undefined) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        const openedAtSql = isActive ? normalizeDateTimeLocal(openedAt) : null;
        if (isActive && openedAt && !openedAtSql) {
            return NextResponse.json(
                { success: false, message: 'รูปแบบวันและเวลาเปิด EOC ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        const closedAtSql = !isActive ? normalizeDateTimeLocal(closedAt) : null;
        if (!isActive && closedAt && !closedAtSql) {
            return NextResponse.json(
                { success: false, message: 'รูปแบบวันและเวลาปิด EOC ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        // ตรวจสอบว่า eocType มีอยู่ใน eoc_status หรือไม่
        const [existingType] = await connection.execute(
            'SELECT eoc_type FROM eoc_status WHERE eoc_type = ?',
            [eocType]
        );

        if (existingType.length === 0) {
            return NextResponse.json(
                { success: false, message: 'ประเภท EOC ไม่ถูกต้องหรือไม่มีในระบบ' },
                { status: 400 }
            );
        }

        let orderFileData = null;
        if (isActive && orderFile && orderFile.size > 0) {
            const hasOrderColumns = await hasOrderFileColumns(connection);
            if (!hasOrderColumns) {
                return NextResponse.json(
                    { success: false, message: 'ฐานข้อมูลยังไม่มีคอลัมน์ไฟล์คำสั่ง กรุณารัน migration add_eoc_open_order_file.sql' },
                    { status: 500 }
                );
            }

            const uploadResult = await saveOrderFile(orderFile, eocType);
            if (!uploadResult.ok) {
                return NextResponse.json(
                    { success: false, message: uploadResult.error },
                    { status: 400 }
                );
            }
            orderFileData = uploadResult;
        }

        await connection.beginTransaction();

        if (isActive) {
            // เปิด EOC - สร้าง session ใหม่

            // หา session_number ล่าสุด
            const [lastSession] = await connection.execute(
                `SELECT COALESCE(MAX(session_number), 0) as last_number 
                 FROM eoc_sessions 
                 WHERE eoc_type = ?`,
                [eocType]
            );
            const newSessionNumber = lastSession[0].last_number + 1;
            const hasOrderColumns = await hasOrderFileColumns(connection);
            const sessionOpenedAt = openedAtSql || formatDateForMysql(new Date());

            // สร้าง session ใหม่
            const [sessionResult] = hasOrderColumns
                ? await connection.execute(
                    `INSERT INTO eoc_sessions 
                    (eoc_type, session_number, opened_at, opened_by, open_reason, open_order_file_path, open_order_file_name, status, festival_type) 
                    VALUES (?, ?, ?, ?, ?, ?, ?, 'active', ?)`,
                    [
                        eocType,
                        newSessionNumber,
                        sessionOpenedAt,
                        userId,
                        description || '',
                        orderFileData?.filePath || null,
                        orderFileData?.originalName || null,
                        festivalType || null
                    ]
                )
                : await connection.execute(
                    `INSERT INTO eoc_sessions 
                    (eoc_type, session_number, opened_at, opened_by, open_reason, status, festival_type) 
                    VALUES (?, ?, ?, ?, ?, 'active', ?)`,
                    [eocType, newSessionNumber, sessionOpenedAt, userId, description || '', festivalType || null]
                );
            const sessionId = sessionResult.insertId;

            // อัพเดทสถานะ EOC
            await connection.execute(
                `UPDATE eoc_status 
                 SET is_active = ?, 
                     activated_at = ?, 
                     activated_by = ?,
                     description = ?
                 WHERE eoc_type = ?`,
                [true, sessionOpenedAt, userId, description || null, eocType]
            );

            // บันทึก log พร้อม session_id
            await connection.execute(
                `INSERT INTO activity_logs 
                (user_id, action_type, target_type, target_id, eoc_session_id, description) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    'eoc_activate',
                    'eoc_status',
                    eocType,
                    sessionId,
                    `เปิด EOC ${eocType} ครั้งที่ ${newSessionNumber}: ${description || ''}`
                ]
            );

        } else {
            // ปิด EOC - อัพเดท session ที่เปิดอยู่

            // หา active session
            const [activeSessions] = await connection.execute(
                `SELECT id, opened_at FROM eoc_sessions 
                 WHERE eoc_type = ? AND status = 'active'
                 LIMIT 1`,
                [eocType]
            );

            if (activeSessions.length > 0) {
                const sessionId = activeSessions[0].id;
                const openedAt = activeSessions[0].opened_at;
                const sessionClosedAt = closedAtSql || formatDateForMysql(new Date());
                const openedAtDate = new Date(openedAt);
                const closedAtDate = new Date(sessionClosedAt.replace(' ', 'T'));

                if (!Number.isNaN(openedAtDate.getTime())
                    && !Number.isNaN(closedAtDate.getTime())
                    && closedAtDate < openedAtDate) {
                    await connection.rollback();
                    return NextResponse.json(
                        { success: false, message: 'วันและเวลาปิด EOC ต้องไม่น้อยกว่าวันและเวลาเปิด EOC' },
                        { status: 400 }
                    );
                }

                // คำนวณระยะเวลา (ชั่วโมง)
                const durationQuery = `
                    UPDATE eoc_sessions 
                    SET closed_at = ?,
                        closed_by = ?,
                        close_reason = ?,
                        duration_hours = TIMESTAMPDIFF(MINUTE, ?, ?) / 60,
                        status = 'closed'
                    WHERE id = ?
                `;

                await connection.execute(durationQuery, [
                    sessionClosedAt,
                    userId,
                    description || '',
                    openedAt,
                    sessionClosedAt,
                    sessionId
                ]);

                // นับจำนวน activities ในช่วง session นี้
                const [activityCount] = await connection.execute(
                    `SELECT COUNT(*) as total FROM activity_logs WHERE eoc_session_id = ?`,
                    [sessionId]
                );

                // อัพเดท total_activities
                await connection.execute(
                    `UPDATE eoc_sessions SET total_activities = ? WHERE id = ?`,
                    [activityCount[0].total, sessionId]
                );

                // บันทึก log พร้อม session_id
                await connection.execute(
                    `INSERT INTO activity_logs 
                    (user_id, action_type, target_type, target_id, eoc_session_id, description) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        'eoc_deactivate',
                        'eoc_status',
                        eocType,
                        sessionId,
                        `ปิด EOC ${eocType}: ${description || ''}`
                    ]
                );
            }

            // อัพเดทสถานะ EOC
            await connection.execute(
                `UPDATE eoc_status 
                 SET is_active = ?, 
                     deactivated_at = ?, 
                     deactivated_by = ?,
                     description = ?
                 WHERE eoc_type = ?`,
                [false, closedAtSql || formatDateForMysql(new Date()), userId, description || null, eocType]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: `${isActive ? 'เปิด' : 'ปิด'} EOC ${eocType} สำเร็จ`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating EOC status:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัพเดทสถานะ EOC');
    } finally {
        connection.release();
    }
}
