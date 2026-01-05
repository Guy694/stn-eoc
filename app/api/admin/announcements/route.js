import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { writeFile, mkdir } from "fs/promises";
import path from "path";

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
        const { searchParams } = new URL(request.url);
        const isActive = searchParams.get('is_active');
        const showPopup = searchParams.get('show_popup');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

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

        // Query รายการแบนเนอร์
        const [announcements] = await connection.execute(
            `SELECT 
                a.*,
                CONCAT(o.given_name, ' ', o.family_name) as created_by_name
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

        return NextResponse.json({
            success: true,
            data: announcements,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            stats: statsResult[0]
        });

    } catch (error) {
        console.error('Error fetching announcements:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// POST - สร้างแบนเนอร์ใหม่
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const formData = await request.formData();
        const title = formData.get('title');
        const description = formData.get('description');
        const showPopup = formData.get('show_popup') === 'true';
        const priority = parseInt(formData.get('priority') || '0');
        const isActive = formData.get('is_active') === 'true';
        const startDate = formData.get('start_date');
        const endDate = formData.get('end_date');
        const createdBy = parseInt(formData.get('created_by') || '1');
        const image = formData.get('image');

        // Validate
        if (!title || !image) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลให้ครบถ้วน' },
                { status: 400 }
            );
        }

        // สร้างโฟลเดอร์สำหรับเก็บรูป
        const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'announcements');
        try {
            await mkdir(uploadDir, { recursive: true });
        } catch (err) {
            // Folder might already exist
        }

        // บันทึกรูปภาพ
        const bytes = await image.arrayBuffer();
        const buffer = Buffer.from(bytes);

        const fileName = `${Date.now()}-${image.name}`;
        const filePath = path.join(uploadDir, fileName);
        await writeFile(filePath, buffer);

        const imagePath = `/uploads/announcements/${fileName}`;

        // บันทึกลงฐานข้อมูล
        const [result] = await connection.execute(
            `INSERT INTO announcements 
            (title, description, image_path, show_popup, priority, is_active, start_date, end_date, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [title, description, imagePath, showPopup, priority, isActive, startDate || null, endDate || null, createdBy]
        );

        return NextResponse.json({
            success: true,
            message: 'สร้างแบนเนอร์สำเร็จ',
            data: { id: result.insertId }
        });

    } catch (error) {
        console.error('Error creating announcement:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการสร้างแบนเนอร์',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// PUT - อัปเดตแบนเนอร์
export async function PUT(request) {
    const connection = await pool.getConnection();

    try {
        const body = await request.json();
        const { id, title, description, show_popup, priority, is_active, start_date, end_date } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID แบนเนอร์' },
                { status: 400 }
            );
        }

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

        return NextResponse.json({
            success: true,
            message: 'อัปเดตแบนเนอร์สำเร็จ'
        });

    } catch (error) {
        console.error('Error updating announcement:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัปเดตแบนเนอร์',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// DELETE - ลบแบนเนอร์
export async function DELETE(request) {
    const connection = await pool.getConnection();

    try {
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
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบแบนเนอร์',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
