import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import bcrypt from 'bcryptjs';
import { SYSTEM_ROLE_CODES } from '@/lib/eocRoles';

const SYSTEM_ROLES = new Set(SYSTEM_ROLE_CODES);

// GET - ดึงข้อมูลเจ้าหน้าที่คนเดียว
export async function GET(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { id } = await params;

        const officers = await query(
            `SELECT id, username, title, given_name, family_name, email, phone, role, department, requested_role, is_approved, created_at, updated_at
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
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลเจ้าหน้าที่');
    }
}

// PUT - แก้ไขข้อมูลเจ้าหน้าที่
export async function PUT(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { id } = await params;
        const body = await request.json();
        const { username, password, title, given_name, family_name, email, phone, role, department, requested_role, is_approved } = body;

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
            if (!SYSTEM_ROLES.has(role)) {
                return NextResponse.json(
                    { success: false, error: 'บทบาทสิทธิ์ระบบไม่ถูกต้อง' },
                    { status: 400 }
                );
            }
            updates.push('role = ?');
            values.push(role);
        }
        if (department !== undefined) {
            updates.push('department = ?');
            values.push(department);
        }
        if (requested_role !== undefined) {
            updates.push('requested_role = ?');
            values.push(requested_role);
        }
        if (is_approved !== undefined) {
            updates.push('is_approved = ?');
            updates.push('approved_time = CASE WHEN ? = 1 THEN NOW() ELSE approved_time END');
            updates.push('approved_by = CASE WHEN ? = 1 THEN ? ELSE approved_by END');
            values.push(Number(is_approved) === 1 ? 1 : 0);
            values.push(Number(is_approved) === 1 ? 1 : 0);
            values.push(Number(is_approved) === 1 ? 1 : 0);
            values.push(auth.user?.id || null);
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

        if (Number(is_approved) === 1) {
            await query(
                `UPDATE registration_requests
                 SET status = 'approved', updated_at = NOW()
                 WHERE officer_id = ?`,
                [id]
            );
        }

        // ดึงข้อมูลที่อัปเดตแล้ว
        const updated = await query(
            'SELECT id, username, title, given_name, family_name, email, phone, role, department, requested_role, is_approved, created_at, updated_at FROM officer WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            message: 'Officer updated successfully',
            data: updated[0]
        });

    } catch (error) {
        console.error('Error updating officer:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขเจ้าหน้าที่');
    }
}

// DELETE - ลบเจ้าหน้าที่
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

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
        return publicInternalError('เกิดข้อผิดพลาดในการลบเจ้าหน้าที่');
    }
}
