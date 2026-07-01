import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { requireAuth } from "@/lib/auth";
import { createRandomFilename, resolveInside, validateImageFile } from "@/lib/fileUpload";
import { publicInternalError } from "@/lib/apiResponse";

const MAX_ANNOUNCEMENT_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

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
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

        if (eocType) {
            whereConditions.push('eoc_type = ?');
            params.push(eocType);
        }

        if (isActive !== null && isActive !== undefined && isActive !== '') {
            whereConditions.push('is_active = ?');
            params.push(isActive === 'true' ? 1 : 0);
        }

        if (showPopup !== null && showPopup !== undefined && showPopup !== '') {
            whereConditions.push('show_popup = ?');
            params.push(showPopup === 'true' ? 1 : 0);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // ตรวจสอบว่ามีคอลัมน์ eoc_type หรือไม่
        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM announcements LIKE 'eoc_type'`
        );
        const hasEocType = columns.length > 0;

        // Query รายการแบนเนอร์
        const selectFields = hasEocType
            ? 'a.*, CONCAT(o.given_name, \' \', o.family_name) as created_by_name'
            : 'a.id, a.title, a.description, a.image_path, a.show_popup, a.priority, a.is_active, a.start_date, a.end_date, a.created_by, a.created_at, a.updated_at, CONCAT(o.given_name, \' \', o.family_name) as created_by_name, \'flood\' as eoc_type';

        const [announcements] = await connection.execute(
            `SELECT ${selectFields}
            FROM announcements a
            LEFT JOIN officer o ON a.created_by = o.id
            ${whereClause}
            ORDER BY priority DESC, created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, limit, offset]
        );

        // นับจำนวนทั้งหมด
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total FROM announcements ${whereClause}`,
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
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const formData = await request.formData();
        const title = formData.get('title');
        const eocType = formData.get('eoc_type');
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

        const imageValidation = await validateImageFile(image, {
            maxSizeBytes: MAX_ANNOUNCEMENT_IMAGE_SIZE_BYTES
        });
        if (!imageValidation.ok) {
            return NextResponse.json(
                { success: false, message: imageValidation.error },
                { status: 400 }
            );
        }

        // Validate EOC type (ถ้ามี)
        if (eocType) {
            const validEocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
            if (!validEocTypes.includes(eocType)) {
                return NextResponse.json(
                    { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                    { status: 400 }
                );
            }
        }

        // สร้างโฟลเดอร์สำหรับเก็บรูป
        const uploadBaseDir = path.join(process.cwd(), 'public', 'uploads');
        const uploadDir = resolveInside(uploadBaseDir, 'announcements');
        await mkdir(uploadDir, { recursive: true });

        // บันทึกรูปภาพ
        const fileName = createRandomFilename(imageValidation.extension);
        const filePath = resolveInside(uploadDir, fileName);
        await writeFile(filePath, imageValidation.buffer);

        const imagePath = `/uploads/announcements/${fileName}`;

        // ตรวจสอบว่ามีคอลัมน์ eoc_type หรือไม่
        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM announcements LIKE 'eoc_type'`
        );
        const hasEocType = columns.length > 0;

        // บันทึกลงฐานข้อมูล
        let result;
        if (hasEocType) {
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
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { id, title, eoc_type, description, show_popup, priority, is_active, start_date, end_date } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID แบนเนอร์' },
                { status: 400 }
            );
        }

        // Validate EOC type (ถ้ามี)
        if (eoc_type) {
            const validEocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
            if (!validEocTypes.includes(eoc_type)) {
                return NextResponse.json(
                    { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                    { status: 400 }
                );
            }
        }

        // ตรวจสอบว่ามีคอลัมน์ eoc_type หรือไม่
        const [columns] = await connection.execute(
            `SHOW COLUMNS FROM announcements LIKE 'eoc_type'`
        );
        const hasEocType = columns.length > 0;

        if (hasEocType && eoc_type) {
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
                WHERE id = ?`,
                [title, eoc_type, description, show_popup, priority, is_active, start_date || null, end_date || null, id]
            );
        } else {
            await connection.execute(
                `UPDATE announcements 
                SET title = ?, 
                    description = ?, 
                    show_popup = ?, 
                    priority = ?, 
                    is_active = ?, 
                    start_date = ?, 
                    end_date = ?
                WHERE id = ?`,
                [title, description, show_popup, priority, is_active, start_date || null, end_date || null, id]
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
