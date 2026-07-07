import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { writeFile, mkdir } from "fs/promises";
import { requireAuth } from "@/lib/auth";
import { DEFAULT_MAX_IMAGE_SIZE_BYTES, createRandomFilename, getUploadDir, resolveInside, validateImageFile } from "@/lib/fileUpload";
import { publicInternalError } from "@/lib/apiResponse";

const MAX_ANNOUNCEMENT_IMAGE_SIZE_BYTES = DEFAULT_MAX_IMAGE_SIZE_BYTES;
const VALID_EOC_TYPES = ['flood', 'drought', 'tsunami', 'earthquake', 'disease', 'accident', 'festival-accidents'];

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

async function hasAnnouncementColumn(connection, columnName) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'announcements'
           AND COLUMN_NAME = ?`,
        [columnName]
    );
    return columns.length > 0;
}

function normalizeOptionalId(value) {
    if (value === undefined || value === null || value === '') return null;
    const numericValue = Number(value);
    return Number.isInteger(numericValue) && numericValue > 0 ? numericValue : null;
}

async function resolveSessionEocType(connection, sessionId) {
    if (!sessionId) return null;
    const [sessions] = await connection.execute(
        `SELECT id, eoc_type FROM eoc_sessions WHERE id = ?`,
        [sessionId]
    );
    return sessions[0]?.eoc_type || null;
}

function missingSessionResponse() {
    return NextResponse.json(
        { success: false, message: 'กรุณาเลือก EOC Session' },
        { status: 400 }
    );
}

async function saveAnnouncementImage(image) {
    const imageValidation = await validateImageFile(image, {
        maxSizeBytes: MAX_ANNOUNCEMENT_IMAGE_SIZE_BYTES
    });
    if (!imageValidation.ok) {
        return { ok: false, error: imageValidation.error };
    }

    const uploadDir = getUploadDir('announcements');
    await mkdir(uploadDir, { recursive: true });

    const fileName = createRandomFilename(imageValidation.extension);
    const filePath = resolveInside(uploadDir, fileName);
    await writeFile(filePath, imageValidation.buffer);

    return {
        ok: true,
        imagePath: `/uploads/announcements/${fileName}`
    };
}

// GET - ดึงรายการแบนเนอร์
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const auth = await requireAuth(request, ['admin', 'commander']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('is_active');
        const showPopup = searchParams.get('show_popup');
        const eocType = searchParams.get('eoc_type');
        const sessionId = normalizeOptionalId(searchParams.get('session_id'));
        const rawPage = parseInt(searchParams.get('page') || '1', 10);
        const rawLimit = parseInt(searchParams.get('limit') || '20', 10);
        const page = Number.isFinite(rawPage) && rawPage > 0 ? rawPage : 1;
        const limit = Number.isFinite(rawLimit) && rawLimit > 0 ? Math.min(rawLimit, 100) : 20;
        const offset = (page - 1) * limit;
        const hasEocType = await hasAnnouncementColumn(connection, 'eoc_type');
        const hasSessionId = await hasAnnouncementColumn(connection, 'session_id');

        let whereConditions = [];
        let params = [];

        if (hasEocType && eocType) {
            whereConditions.push('a.eoc_type = ?');
            params.push(eocType);
        }

        if (hasSessionId && sessionId) {
            whereConditions.push('a.session_id = ?');
            params.push(sessionId);
        }

        if (isActive !== null && isActive !== undefined && isActive !== '') {
            whereConditions.push('a.is_active = ?');
            params.push(isActive === 'true' ? 1 : 0);
        }

        if (showPopup !== null && showPopup !== undefined && showPopup !== '') {
            whereConditions.push('a.show_popup = ?');
            params.push(showPopup === 'true' ? 1 : 0);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Query รายการแบนเนอร์
        const sessionJoin = hasSessionId
            ? 'LEFT JOIN eoc_sessions es ON a.session_id = es.id'
            : '';
        const sessionSelect = hasSessionId
            ? `a.session_id,
                es.session_number,
                es.status as session_status,
                es.opened_at as session_opened_at,
                es.closed_at as session_closed_at,`
            : `NULL as session_id,
                NULL as session_number,
                NULL as session_status,
                NULL as session_opened_at,
                NULL as session_closed_at,`;
        const selectFields = hasEocType
            ? `a.id, a.title, a.eoc_type, ${sessionSelect} a.description, a.image_path, a.show_popup, a.priority, a.is_active, a.start_date, a.end_date, a.created_by, a.created_at, a.updated_at, CONCAT(o.given_name, ' ', o.family_name) as created_by_name`
            : `a.id, a.title, 'flood' as eoc_type, ${sessionSelect} a.description, a.image_path, a.show_popup, a.priority, a.is_active, a.start_date, a.end_date, a.created_by, a.created_at, a.updated_at, CONCAT(o.given_name, ' ', o.family_name) as created_by_name`;

        const [announcements] = await connection.execute(
            `SELECT ${selectFields}
            FROM announcements a
            LEFT JOIN officer o ON a.created_by = o.id
            ${sessionJoin}
            ${whereClause}
            ORDER BY a.priority DESC, a.created_at DESC
            LIMIT ${limit} OFFSET ${offset}`,
            params
        );

        // นับจำนวนทั้งหมด
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total
             FROM announcements a
             ${sessionJoin}
             ${whereClause}`,
            params
        );

        const total = countResult[0].total;

        // สถิติ
        const [statsResult] = await connection.execute(
            `SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active,
                SUM(CASE WHEN is_active = 0 THEN 1 ELSE 0 END) as inactive,
                SUM(CASE WHEN show_popup = 1 AND is_active = 1 THEN 1 ELSE 0 END) as popup
            FROM announcements`
        );

        // สถิติแยกตาม EOC type (ถ้ามีคอลัมน์)
        let eocStats = {};
        if (hasEocType) {
            const [eocStatsResult] = await connection.execute(
                `SELECT 
                    eoc_type,
                    COUNT(*) as count,
                    SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) as active_count
                FROM announcements
                GROUP BY eoc_type`
            );

            eocStatsResult.forEach(row => {
                eocStats[row.eoc_type] = {
                    count: row.count,
                    active: row.active_count
                };
            });
        }

        return NextResponse.json({
            success: true,
            data: announcements,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            stats: statsResult[0],
            eocStats: eocStats
        });

    } catch (error) {
        console.error('Error fetching announcements:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
        connection.release();
    }
}

// POST - สร้างแบนเนอร์ใหม่
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const auth = await requireAuth(request, ['admin', 'commander']);
        if (!auth.success) return auth.response;

        const formData = await request.formData();
        const title = formData.get('title');
        const sessionId = normalizeOptionalId(formData.get('session_id'));
        const sessionEocType = await resolveSessionEocType(connection, sessionId);
        const eocType = sessionEocType;
        const description = formData.get('description');
        const showPopup = formData.get('show_popup') === 'true';
        const priority = parseInt(formData.get('priority') || '0');
        const isActive = formData.get('is_active') === 'true';
        const startDate = formData.get('start_date');
        const endDate = formData.get('end_date');
        const createdBy = auth.user.id;
        const image = formData.get('image');

        // Validate
        if (!title || !image) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
                { status: 400 }
            );
        }

        if (!sessionId || !sessionEocType) {
            return missingSessionResponse();
        }

        const savedImage = await saveAnnouncementImage(image);
        if (!savedImage.ok) {
            return NextResponse.json(
                { success: false, message: savedImage.error },
                { status: 400 }
            );
        }

        // Validate EOC type (ถ้ามี)
        if (eocType) {
            if (!VALID_EOC_TYPES.includes(eocType)) {
                return NextResponse.json(
                    { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                    { status: 400 }
                );
            }
        }

        const imagePath = savedImage.imagePath;

        const hasEocType = await hasAnnouncementColumn(connection, 'eoc_type');
        const hasSessionId = await hasAnnouncementColumn(connection, 'session_id');

        // บันทึกลงฐานข้อมูล
        let result;
        if (hasEocType && hasSessionId) {
            [result] = await connection.execute(
                `INSERT INTO announcements
                (title, eoc_type, session_id, description, image_path, show_popup, priority, is_active, start_date, end_date, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, eocType, sessionId, description, imagePath, showPopup, priority, isActive, startDate || null, endDate || null, createdBy]
            );
        } else if (hasEocType) {
            [result] = await connection.execute(
                `INSERT INTO announcements 
                (title, eoc_type, description, image_path, show_popup, priority, is_active, start_date, end_date, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, eocType, description, imagePath, showPopup, priority, isActive, startDate || null, endDate || null, createdBy]
            );
        } else {
            [result] = await connection.execute(
                `INSERT INTO announcements 
                (title, description, image_path, show_popup, priority, is_active, start_date, end_date, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [title, description, imagePath, showPopup, priority, isActive, startDate || null, endDate || null, createdBy]
            );
        }

        return NextResponse.json({
            success: true,
            message: 'สร้างแบนเนอร์สำเร็จ',
            data: { id: result.insertId }
        });

    } catch (error) {
        console.error('Error creating announcement:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการสร้างแบนเนอร์');
    } finally {
        connection.release();
    }
}

// PUT - อัปเดตแบนเนอร์
export async function PUT(request) {
    const connection = await pool.getConnection();

    try {
        const auth = await requireAuth(request, ['admin', 'commander']);
        if (!auth.success) return auth.response;

        const contentType = request.headers.get('content-type') || '';
        let id;
        let title;
        let description;
        let show_popup;
        let priority;
        let is_active;
        let start_date;
        let end_date;
        let sessionId;
        let image = null;

        if (contentType.includes('multipart/form-data')) {
            const formData = await request.formData();
            id = formData.get('id');
            title = formData.get('title');
            description = formData.get('description');
            show_popup = formData.get('show_popup') === 'true';
            priority = parseInt(formData.get('priority') || '0', 10);
            is_active = formData.get('is_active') === 'true';
            start_date = formData.get('start_date');
            end_date = formData.get('end_date');
            sessionId = normalizeOptionalId(formData.get('session_id'));
            image = formData.get('image');
        } else {
            const body = await request.json();
            ({ id, title, description, show_popup, priority, is_active, start_date, end_date } = body);
            sessionId = normalizeOptionalId(body.session_id);
        }
        const sessionEocType = await resolveSessionEocType(connection, sessionId);
        const resolvedEocType = sessionEocType;

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID แบนเนอร์' },
                { status: 400 }
            );
        }

        if (!sessionId || !sessionEocType) {
            return missingSessionResponse();
        }

        // Validate EOC type (ถ้ามี)
        if (resolvedEocType) {
            if (!VALID_EOC_TYPES.includes(resolvedEocType)) {
                return NextResponse.json(
                    { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                    { status: 400 }
                );
            }
        }

        const hasEocType = await hasAnnouncementColumn(connection, 'eoc_type');
        const hasSessionId = await hasAnnouncementColumn(connection, 'session_id');
        let updatedImagePath = null;
        if (image && image.size > 0) {
            const savedImage = await saveAnnouncementImage(image);
            if (!savedImage.ok) {
                return NextResponse.json(
                    { success: false, message: savedImage.error },
                    { status: 400 }
                );
            }
            updatedImagePath = savedImage.imagePath;
        }

        const imageSetSql = updatedImagePath ? ', image_path = ?' : '';

        if (hasEocType && hasSessionId && resolvedEocType) {
            const values = [title, resolvedEocType, sessionId, description, show_popup, priority, is_active, start_date || null, end_date || null];
            if (updatedImagePath) values.push(updatedImagePath);
            values.push(id);
            await connection.execute(
                `UPDATE announcements
                SET title = ?,
                    eoc_type = ?,
                    session_id = ?,
                    description = ?,
                    show_popup = ?,
                    priority = ?,
                    is_active = ?,
                    start_date = ?,
                    end_date = ?
                    ${imageSetSql}
                WHERE id = ?`,
                values
            );
        } else if (hasEocType && resolvedEocType) {
            const values = [title, resolvedEocType, description, show_popup, priority, is_active, start_date || null, end_date || null];
            if (updatedImagePath) values.push(updatedImagePath);
            values.push(id);
            await connection.execute(
                `UPDATE announcements 
                SET title = ?, 
                    eoc_type = ?,
                    description = ?, 
                    show_popup = ?, 
                    priority = ?, 
                    is_active = ?, 
                    start_date = ?, 
                    end_date = ?
                    ${imageSetSql}
                WHERE id = ?`,
                values
            );
        } else {
            const values = [title, description, show_popup, priority, is_active, start_date || null, end_date || null];
            if (updatedImagePath) values.push(updatedImagePath);
            values.push(id);
            await connection.execute(
                `UPDATE announcements 
                SET title = ?, 
                    description = ?, 
                    show_popup = ?, 
                    priority = ?, 
                    is_active = ?, 
                    start_date = ?, 
                    end_date = ?
                    ${imageSetSql}
                WHERE id = ?`,
                values
            );
        }

        return NextResponse.json({
            success: true,
            message: 'อัปเดตแบนเนอร์สำเร็จ'
        });

    } catch (error) {
        console.error('Error updating announcement:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัปเดตแบนเนอร์');
    } finally {
        connection.release();
    }
}

// DELETE - ลบแบนเนอร์
export async function DELETE(request) {
    const connection = await pool.getConnection();

    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID แบนเนอร์' },
                { status: 400 }
            );
        }

        await connection.execute('DELETE FROM announcements WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบแบนเนอร์สำเร็จ'
        });

    } catch (error) {
        console.error('Error deleting announcement:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบแบนเนอร์');
    } finally {
        connection.release();
    }
}
