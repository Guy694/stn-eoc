import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { normalizeDiseaseName, sameDisease } from '@/lib/diseaseNames';

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
        if (error.code === 'ER_NO_SUCH_TABLE') {
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

        return publicInternalError('เกิดข้อผิดพลาดในการดึงรายการโรค');
    }
}

// POST - เพิ่มโรคใหม่ (ตรวจสอบซ้ำ)
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { name, description } = body;

        if (!name || !name.trim()) {
            return NextResponse.json(
                { success: false, message: 'กรุณาระบุชื่อโรค' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        const cleanName = normalizeDiseaseName(name);

        // ตรวจว่ามีโรคเดียวกันอยู่แล้วหรือไม่ (รวมชื่อเรียกอื่นของโรคเดียวกัน เช่น โรคฉี่หนู = เลปโตสไปโรซิส)
        // เดิมใช้ LIKE '%ชื่อ%' ซึ่งบล็อกโรคที่ต่างกันจริง เช่น เพิ่ม "ไข้หวัด" ไม่ได้เพราะมี "ไข้หวัดใหญ่"
        const [rows] = await pool.query('SELECT id, name, is_active FROM common_diseases');
        const existing = rows.find((row) => row.name === cleanName) || rows.find((row) => sameDisease(row.name, cleanName));

        if (existing) {
            if (!existing.is_active) {
                await pool.query('UPDATE common_diseases SET is_active = 1 WHERE id = ?', [existing.id]);
            }
            return NextResponse.json({
                success: false,
                message: `มีโรค "${cleanName}" ในระบบแล้ว`,
                existing_id: existing.id,
                // ส่งชื่อมาตรฐานกลับไปเสมอ (แถวเดิมอาจเป็นชื่อเรียกอื่นที่ยังไม่ได้ปรับ)
                existing_name: cleanName
            }, { status: 409 });
        }

        // เพิ่มโรคใหม่ (ชื่อมาตรฐาน)
        const [result] = await pool.query(
            'INSERT INTO common_diseases (name, description) VALUES (?, ?)',
            [cleanName, description || null]
        );

        return NextResponse.json({
            success: true,
            message: 'เพิ่มโรคใหม่สำเร็จ',
            id: result.insertId,
            name: cleanName
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

        return publicInternalError('เกิดข้อผิดพลาดในการเพิ่มโรค');
    }
}

// DELETE - ลบโรค (soft delete)
export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

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
        return publicInternalError('เกิดข้อผิดพลาดในการลบโรค');
    }
}
