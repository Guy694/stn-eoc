import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// GET - ดึงรายการโรคทั้งหมด
export async function GET(request) {
    try {
        const pool = await getConnection();
        const [diseases] = await pool.query(
            'SELECT * FROM common_diseases WHERE is_active = 1 ORDER BY name'
        );

        return NextResponse.json({
            success: true,
            data: diseases
        });
    } catch (error) {
        console.error('Get diseases error:', error);

        // ถ้าตารางยังไม่มี ส่ง default list
        if (error.message.includes("doesn't exist")) {
            return NextResponse.json({
                success: true,
                data: [
                    { id: 1, name: 'ไข้เลือดออก' },
                    { id: 2, name: 'โควิด-19' },
                    { id: 3, name: 'มือเท้าปาก' },
                    { id: 4, name: 'ไข้หวัดใหญ่' },
                    { id: 5, name: 'อุจจาระร่วง' },
                    { id: 6, name: 'โรคผิวหนัง' }
                ],
                message: 'ยังไม่ได้สร้างตาราง common_diseases (ใช้ข้อมูล default)'
            });
        }

        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาด', error: error.message },
            { status: 500 }
        );
    }
}

// POST - เพิ่มโรคใหม่ (ตรวจสอบซ้ำ)
export async function POST(request) {
    try {
        const body = await request.json();
        const { name, description } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { success: false, message: 'กรุณาระบุชื่อโรค' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        // ตรวจสอบว่ามีโรคนี้อยู่แล้วหรือไม่
        const [existing] = await pool.query(
            'SELECT id, name FROM common_diseases WHERE name = ? OR name LIKE ?',
            [name.trim(), `%${name.trim()}%`]
        );

        if (existing.length > 0) {
            return NextResponse.json({
                success: false,
                message: `มีโรค "${existing[0].name}" ในระบบแล้ว`,
                existing_id: existing[0].id,
                existing_name: existing[0].name
            }, { status: 409 });
        }

        // เพิ่มโรคใหม่
        const [result] = await pool.query(
            'INSERT INTO common_diseases (name, description) VALUES (?, ?)',
            [name.trim(), description || null]
        );

        return NextResponse.json({
            success: true,
            message: 'เพิ่มโรคใหม่สำเร็จ',
            id: result.insertId,
            name: name.trim()
        });
    } catch (error) {
        console.error('Add disease error:', error);

        // ถ้าเป็น duplicate key error
        if (error.code === 'ER_DUP_ENTRY') {
            return NextResponse.json({
                success: false,
                message: 'มีโรคนี้ในระบบแล้ว'
            }, { status: 409 });
        }

        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาด', error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - ลบโรค (soft delete)
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ต้องระบุ ID' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        await pool.query(
            'UPDATE common_diseases SET is_active = 0 WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            message: 'ลบโรคสำเร็จ'
        });
    } catch (error) {
        console.error('Delete disease error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาด', error: error.message },
            { status: 500 }
        );
    }
}
