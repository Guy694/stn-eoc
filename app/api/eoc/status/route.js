import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { getSessionToken, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { mkdir, writeFile } from "fs/promises";
import path from "path";
import { createRandomFilename, getUploadDir, resolveInside } from "@/lib/fileUpload";

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

async function hasDiseaseSubtypeColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'eoc_sessions'
           AND COLUMN_NAME IN ('disease_id', 'disease_name')`
    );
    return columns.length === 2;
}

async function tableExists(connection, tableName) {
    const [tables] = await connection.execute(
        `SELECT TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return tables.length > 0;
}

async function resolveDiseaseSubtype(connection, diseaseId, diseaseName) {
    const trimmedName = String(diseaseName || '').trim();

    if (diseaseId) {
        const parsedId = Number(diseaseId);
        if (!Number.isInteger(parsedId) || parsedId <= 0) {
            return { ok: false, error: 'ประเภทโรคไม่ถูกต้อง' };
        }

        const [rows] = await connection.execute(
            `SELECT id, name
             FROM common_diseases
             WHERE id = ? AND is_active = 1
             LIMIT 1`,
            [parsedId]
        );

        if (rows.length === 0) {
            return { ok: false, error: 'ไม่พบประเภทโรคที่เลือก หรือประเภทโรคถูกปิดใช้งานแล้ว' };
        }

        return { ok: true, diseaseId: rows[0].id, diseaseName: rows[0].name };
    }

    if (!trimmedName) {
        return { ok: false, error: 'กรุณาเลือกหรือระบุประเภทโรคระบาด' };
    }

    const normalizedName = trimmedName.slice(0, 150);
    await connection.execute(
        `INSERT IGNORE INTO common_diseases (name, description)
         VALUES (?, ?)`,
        [normalizedName, 'เพิ่มจากแบบฟอร์มเปิด EOC โรคระบาด']
    );
    const [rows] = await connection.execute(
        `SELECT id, name
         FROM common_diseases
         WHERE name = ?
         LIMIT 1`,
        [normalizedName]
    );

    return {
        ok: true,
        diseaseId: rows[0]?.id || null,
        diseaseName: rows[0]?.name || normalizedName
    };
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

    const uploadDir = getUploadDir('eoc-orders', eocType);
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
        const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection);
        const orderFileSelect = hasOrderColumns
            ? `sess.open_order_file_path,
                sess.open_order_file_name,`
            : `NULL as open_order_file_path,
                NULL as open_order_file_name,`;
        const diseaseSubtypeSelect = hasDiseaseColumns
            ? `sess.disease_id,
                sess.disease_name,`
            : `NULL as disease_id,
                NULL as disease_name,`;
        const activeSessionJoin = `
            LEFT JOIN (
                SELECT s.*
                FROM eoc_sessions s
                INNER JOIN (
                    SELECT eoc_type, MAX(id) AS latest_active_id
                    FROM eoc_sessions
                    WHERE status = 'active'
                    GROUP BY eoc_type
                ) latest ON latest.latest_active_id = s.id
            ) sess ON es.eoc_type = sess.eoc_type
        `;

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
                sess.opened_at as session_opened_at,
                sess.festival_type,
                ${diseaseSubtypeSelect}
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
            ${activeSessionJoin}
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
                sess.opened_at as session_opened_at,
                sess.festival_type,
                ${diseaseSubtypeSelect}
                ${orderFileSelect}
                sess.status as session_status
            FROM eoc_status es
            ${activeSessionJoin}
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
        let diseaseId;
        let diseaseName;
        let openedAt;
        let closedAt;
        let orderFile = null;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            eocType = formData.get('eocType');
            isActive = formData.get('isActive') === 'true';
            description = formData.get('description') || '';
            festivalType = formData.get('festivalType') || null;
            diseaseId = formData.get('diseaseId') || null;
            diseaseName = formData.get('diseaseName') || null;
            openedAt = formData.get('openedAt') || null;
            closedAt = formData.get('closedAt') || null;
            orderFile = formData.get('orderFile');
        } else {
            const body = await request.json();
            eocType = body.eocType;
            isActive = body.isActive;
            description = body.description;
            festivalType = body.festivalType;
            diseaseId = body.diseaseId;
            diseaseName = body.diseaseName;
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

        let diseaseSubtype = { diseaseId: null, diseaseName: null };
        if (isActive && eocType === 'disease') {
            const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection);
            if (!hasDiseaseColumns) {
                return NextResponse.json(
                    { success: false, message: 'ฐานข้อมูลยังไม่มีคอลัมน์ประเภทโรค กรุณารัน migration add_disease_subtype_to_eoc_sessions.sql' },
                    { status: 500 }
                );
            }

            if (!await tableExists(connection, 'common_diseases')) {
                return NextResponse.json(
                    { success: false, message: 'ยังไม่มีตาราง common_diseases กรุณารัน migration add_disease_subtype_to_eoc_sessions.sql' },
                    { status: 500 }
                );
            }

            const resolvedDisease = await resolveDiseaseSubtype(connection, diseaseId, diseaseName);
            if (!resolvedDisease.ok) {
                return NextResponse.json(
                    { success: false, message: resolvedDisease.error },
                    { status: 400 }
                );
            }
            diseaseSubtype = {
                diseaseId: resolvedDisease.diseaseId,
                diseaseName: resolvedDisease.diseaseName
            };
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
            const hasDiseaseColumns = await hasDiseaseSubtypeColumns(connection);
            const sessionOpenedAt = openedAtSql || formatDateForMysql(new Date());

            // สร้าง session ใหม่
            const sessionColumns = ['eoc_type', 'session_number', 'opened_at', 'opened_by', 'open_reason', 'status', 'festival_type'];
            const sessionPlaceholders = ['?', '?', '?', '?', '?', '?', '?'];
            const sessionValues = [eocType, newSessionNumber, sessionOpenedAt, userId, description || '', 'active', festivalType || null];

            if (hasOrderColumns) {
                sessionColumns.push('open_order_file_path', 'open_order_file_name');
                sessionPlaceholders.push('?', '?');
                sessionValues.push(orderFileData?.filePath || null, orderFileData?.originalName || null);
            }

            if (hasDiseaseColumns) {
                sessionColumns.push('disease_id', 'disease_name');
                sessionPlaceholders.push('?', '?');
                sessionValues.push(
                    eocType === 'disease' ? diseaseSubtype.diseaseId : null,
                    eocType === 'disease' ? diseaseSubtype.diseaseName : null
                );
            }

            const [sessionResult] = await connection.execute(
                `INSERT INTO eoc_sessions (${sessionColumns.join(', ')})
                 VALUES (${sessionPlaceholders.join(', ')})`,
                sessionValues
            );
            const sessionId = sessionResult.insertId;
            const diseaseLogSuffix = eocType === 'disease' && diseaseSubtype.diseaseName
                ? ` (${diseaseSubtype.diseaseName})`
                : '';

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
                    `เปิด EOC ${eocType}${diseaseLogSuffix} ครั้งที่ ${newSessionNumber}: ${description || ''}`
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
                let sessionClosedAt = closedAtSql || formatDateForMysql(new Date());
                const openedAtDate = new Date(openedAt);
                const closedAtDate = new Date(sessionClosedAt.replace(' ', 'T'));

                if (!Number.isNaN(openedAtDate.getTime())
                    && !Number.isNaN(closedAtDate.getTime())
                    && closedAtDate < openedAtDate) {
                    sessionClosedAt = formatDateForMysql(openedAtDate);
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

                let closedShelterCount = 0;
                if (await tableExists(connection, 'shelter_session_activations')) {
                    const closeShelterNote = `ปิดอัตโนมัติเมื่อปิด EOC ${eocType}`;
                    const [closedShelters] = await connection.execute(
                        `UPDATE shelter_session_activations
                         SET is_active = 0,
                             deactivated_at = COALESCE(deactivated_at, ?),
                             notes = CASE
                                 WHEN notes IS NULL OR notes = '' THEN ?
                                 ELSE CONCAT(notes, '\n', ?)
                             END
                         WHERE session_id = ?
                           AND is_active = 1`,
                        [sessionClosedAt, closeShelterNote, closeShelterNote, sessionId]
                    );
                    closedShelterCount = closedShelters.affectedRows || 0;
                }

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
                        `ปิด EOC ${eocType}: ${description || ''}${closedShelterCount > 0 ? ` | ปิดศูนย์พักพิง ${closedShelterCount} แห่ง` : ''}`
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
            message: `${isActive ? 'เปิด' : 'ปิด'} EOC ${eocType}${isActive && eocType === 'disease' && diseaseSubtype.diseaseName ? ` (${diseaseSubtype.diseaseName})` : ''} สำเร็จ`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating EOC status:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัพเดทสถานะ EOC');
    } finally {
        connection.release();
    }
}
