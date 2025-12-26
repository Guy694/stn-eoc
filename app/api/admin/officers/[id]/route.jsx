import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import bcrypt from 'bcryptjs';

// GET - ดึงข้อมูลเจ้าหน้าที่คนเดียว
export async function GET(request, { params }) {
    try {
        const { id } = await params;

        const officers = await query(
            `SELECT id, username, title, given_name, family_name, email, phone, role, created_at, updated_at 
             FROM officer WHERE id = ?`,
            [id]
        );

        if (officers.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Officer not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: officers[0]
        });

    } catch (error) {
        console.error('Error fetching officer:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch officer', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - แก้ไขข้อมูลเจ้าหน้าที่
export async function PUT(request, { params }) {
    try {
        const { id } = await params;
        const body = await request.json();
        const { username, password, title, given_name, family_name, email, phone, role } = body;

        // ตรวจสอบว่ามีเจ้าหน้าที่นี้อยู่หรือไม่
        const existing = await query('SELECT id FROM officer WHERE id = ?', [id]);
        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Officer not found' },
                { status: 404 }
            );
        }

        // ตรวจสอบว่า username ซ้ำกับคนอื่นหรือไม่
        if (username) {
            const duplicate = await query(
                'SELECT id FROM officer WHERE username = ? AND id != ?',
                [username, id]
            );
            if (duplicate.length > 0) {
                return NextResponse.json(
                    { success: false, error: 'Username already exists' },
                    { status: 409 }
                );
            }
        }

        // สร้าง SQL update แบบ dynamic
        const updates = [];
        const values = [];

        if (username) {
            updates.push('username = ?');
            values.push(username);
        }
        if (title !== undefined) {
            updates.push('title = ?');
            values.push(title);
        }
        if (given_name) {
            updates.push('given_name = ?');
            values.push(given_name);
        }
        if (family_name) {
            updates.push('family_name = ?');
            values.push(family_name);
        }
        if (email !== undefined) {
            updates.push('email = ?');
            values.push(email);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            values.push(phone);
        }
        if (role) {
            updates.push('role = ?');
            values.push(role);
        }
        if (password) {
            const password_hash = await bcrypt.hash(password, 10);
            updates.push('password_hash = ?');
            values.push(password_hash);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: 'No fields to update' },
                { status: 400 }
            );
        }

        values.push(id);

        await query(
            `UPDATE officer SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        // ดึงข้อมูลที่อัปเดตแล้ว
        const updated = await query(
            'SELECT id, username, full_name, email, phone, role, created_at, updated_at FROM officer WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            message: 'Officer updated successfully',
            data: updated[0]
        });

    } catch (error) {
        console.error('Error updating officer:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update officer', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - ลบเจ้าหน้าที่
export async function DELETE(request, { params }) {
    try {
        const { id } = await params;

        // ตรวจสอบว่ามีเจ้าหน้าที่นี้อยู่หรือไม่
        const existing = await query('SELECT id, username FROM officer WHERE id = ?', [id]);
        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Officer not found' },
                { status: 404 }
            );
        }

        await query('DELETE FROM officer WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'Officer deleted successfully',
            data: { id: parseInt(id), username: existing[0].username }
        });

    } catch (error) {
        console.error('Error deleting officer:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete officer', details: error.message },
            { status: 500 }
        );
    }
}
