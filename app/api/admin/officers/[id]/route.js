import { NextResponse } from 'next/server';
import { query, transaction } from '@/lib/db';
import { recordChange } from '@/lib/recordArchive';
import { requireAuth, revokeUserSessions } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import bcrypt from 'bcryptjs';
import { SYSTEM_ROLE_CODES } from '@/lib/eocRoles';
import { validatePassword } from "@/lib/passwordPolicy";

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
                { success: false, error: 'ไม่พบเจ้าหน้าที่' },
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
        const existing = await query('SELECT id, role, is_approved FROM officer WHERE id = ?', [id]);
        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, error: 'ไม่พบเจ้าหน้าที่' },
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
                    { success: false, error: 'ชื่อผู้ใช้นี้มีอยู่แล้ว' },
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
            const passwordError = validatePassword(password, { username });
            if (passwordError) {
                return NextResponse.json({ success: false, error: passwordError }, { status: 400 });
            }
            const password_hash = await bcrypt.hash(password, 12);
            // รหัสผ่านที่ผู้ดูแลรีเซ็ตให้เป็นรหัสชั่วคราว บังคับเปลี่ยนเมื่อเข้าสู่ระบบครั้งถัดไป
            updates.push('password_hash = ?', 'must_change_password = 1', 'failed_login_attempts = 0', 'account_locked_until = NULL');
            values.push(password_hash);
        }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: 'ไม่มีข้อมูลที่เปลี่ยนแปลง' },
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

        // เมื่อรีเซ็ตรหัสผ่าน เปลี่ยน role หรือยกเลิกอนุมัติ ให้ปิด session เดิมของผู้ใช้นั้นทั้งหมด
        const roleChanged = Boolean(role) && role !== existing[0].role;
        const approvalRevoked = is_approved !== undefined && Number(is_approved) !== 1 && Number(existing[0].is_approved) === 1;
        if (password || roleChanged || approvalRevoked) {
            await revokeUserSessions(id);
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

// ประวัติการทำงานที่ต้องเก็บไว้ (ตารางเหล่านี้อ้างถึงเจ้าหน้าที่โดยไม่ยอมให้ลบ) — มีอย่างใดอย่างหนึ่ง = ลบไม่ได้ ให้ระงับแทน
const HISTORY_CHECKS = [
    { label: 'เปิด/ปิดเหตุการณ์ EOC', sql: 'SELECT COUNT(*) AS n FROM eoc_sessions WHERE opened_by = ? OR closed_by = ?', params: (id) => [id, id] },
    { label: 'ผู้บัญชาการเหตุการณ์', sql: 'SELECT COUNT(*) AS n FROM eoc_session_commanders WHERE officer_id = ?', params: (id) => [id] },
    { label: 'รายงานทีม', sql: 'SELECT COUNT(*) AS n FROM eoc_team_reports WHERE created_by = ?', params: (id) => [id] }
];

async function officerHistory(id) {
    const found = [];
    for (const check of HISTORY_CHECKS) {
        try {
            const rows = await query(check.sql, check.params(id));
            const count = Number(rows[0]?.n || 0);
            if (count) found.push(`${check.label} ${count} รายการ`);
        } catch (error) {
            if (error?.code !== 'ER_NO_SUCH_TABLE' && error?.code !== 'ER_BAD_FIELD_ERROR') throw error;
        }
    }
    return found;
}

const historyResponse = (history) => NextResponse.json({
    success: false,
    code: 'HAS_HISTORY',
    error: `ลบไม่ได้ เพราะมีประวัติการทำงานในระบบ (${history.join(', ')}) ซึ่งต้องเก็บไว้ ให้ใช้ "ระงับการใช้งาน" แทน บัญชีจะเข้าระบบไม่ได้แต่ประวัติยังอยู่`,
    history
}, { status: 409 });

// DELETE - ลบเจ้าหน้าที่ (เฉพาะที่ไม่มีประวัติการทำงาน) — ถอดออกจากทีมที่ได้รับมอบหมายก่อนลบ
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { id } = await params;
        if (String(id) === String(auth.user.id)) {
            return NextResponse.json({ success: false, error: 'ลบบัญชีของตัวเองไม่ได้' }, { status: 400 });
        }

        const existing = await query('SELECT id, username FROM officer WHERE id = ?', [id]);
        if (existing.length === 0) {
            return NextResponse.json({ success: false, error: 'ไม่พบเจ้าหน้าที่' }, { status: 404 });
        }

        const history = await officerHistory(id);
        if (history.length) return historyResponse(history);

        try {
            await transaction(async (execute) => {
                await execute('UPDATE eoc_session_teams SET team_lead_officer_id = NULL WHERE team_lead_officer_id = ?', [id]).catch((error) => {
                    if (error?.code !== 'ER_NO_SUCH_TABLE' && error?.code !== 'ER_BAD_FIELD_ERROR') throw error;
                });
                await execute('DELETE FROM eoc_team_members WHERE officer_id = ?', [id]).catch((error) => {
                    if (error?.code !== 'ER_NO_SUCH_TABLE') throw error;
                });
                await execute('DELETE FROM officer WHERE id = ?', [id]);
            });
        } catch (error) {
            // ตารางอื่นที่อ้างถึงเจ้าหน้าที่ (ไม่อยู่ในรายการตรวจด้านบน)
            if (error?.code === 'ER_ROW_IS_REFERENCED_2' || error?.code === 'ER_ROW_IS_REFERENCED') {
                return historyResponse(['ข้อมูลที่บันทึกไว้ในระบบ']);
            }
            throw error;
        }

        await recordChange({ request, user: auth.user, action: 'data_delete', table: 'officer', id, description: `ลบบัญชีเจ้าหน้าที่ ${existing[0].username}` });
        return NextResponse.json({
            success: true,
            message: 'ลบบัญชีแล้ว',
            data: { id: parseInt(id), username: existing[0].username }
        });

    } catch (error) {
        console.error('Error deleting officer:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบเจ้าหน้าที่');
    }
}

// วันล็อกแบบไม่มีกำหนด (ใช้ช่อง account_locked_until ที่ระบบตรวจทั้งตอนเข้าสู่ระบบและทุกคำขอ)
const SUSPEND_UNTIL = '9999-12-31 00:00:00';

// PATCH - ระงับ / เปิดใช้งานบัญชีอีกครั้ง { action: 'suspend' | 'reactivate' }
export async function PATCH(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;
        const { id } = await params;
        const body = await request.json().catch(() => ({}));
        if (!['suspend', 'reactivate'].includes(body.action)) {
            return NextResponse.json({ success: false, error: 'คำสั่งไม่ถูกต้อง' }, { status: 400 });
        }
        if (body.action === 'suspend' && String(id) === String(auth.user.id)) {
            return NextResponse.json({ success: false, error: 'ระงับบัญชีของตัวเองไม่ได้' }, { status: 400 });
        }
        const existing = await query('SELECT id, username FROM officer WHERE id = ?', [id]);
        if (!existing.length) return NextResponse.json({ success: false, error: 'ไม่พบเจ้าหน้าที่' }, { status: 404 });

        if (body.action === 'suspend') {
            await query('UPDATE officer SET account_locked_until = ? WHERE id = ?', [SUSPEND_UNTIL, id]);
            await revokeUserSessions(id);
        } else {
            await query('UPDATE officer SET account_locked_until = NULL, failed_login_attempts = 0 WHERE id = ?', [id]);
        }
        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'officer', id,
            description: `${body.action === 'suspend' ? 'ระงับการใช้งาน' : 'เปิดใช้งานอีกครั้ง'} บัญชี ${existing[0].username}`
        });
        return NextResponse.json({ success: true, message: body.action === 'suspend' ? 'ระงับการใช้งานแล้ว' : 'เปิดใช้งานแล้ว' });
    } catch (error) {
        console.error('Error suspending officer:', error);
        return publicInternalError('บันทึกสถานะบัญชีไม่สำเร็จ');
    }
}
