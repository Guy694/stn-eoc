import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";
import { recordChange } from "@/lib/recordArchive";
import { emailOutcomeText, notifyAccountDecision } from "@/lib/accountEmails";

const pool = getPool();

// คิว "รออนุมัติ" ของเจ้าหน้าที่ — ยึดตาราง officer เป็นหลัก (is_approved = 0) แล้วเติมข้อมูลคำขอลงทะเบียนล่าสุด
// เดิมนับจาก registration_requests อย่างเดียว ทำให้คนที่อนุมัติแล้วยังค้างเป็น "ผู้ลงทะเบียนใหม่"
// และคนที่รออนุมัติแต่ไม่มีคำขอ (เช่น บัญชีเก่า) ไม่โผล่ในคิว

async function hasRegistrationTable(connection) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS count FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'registration_requests'`
    );
    return Number(rows[0]?.count || 0) > 0;
}

/** คำขอของเจ้าหน้าที่ที่อนุมัติไปแล้ว (จากช่องทางใดก็ตาม) → ปิดคำขอให้ตรงกับสถานะจริง */
async function syncApprovedRequests(connection) {
    const [result] = await connection.execute(
        `UPDATE registration_requests rr
         JOIN officer o ON o.id = rr.officer_id
         SET rr.status = 'approved'
         WHERE rr.user_type = 'officer' AND o.is_approved = 1 AND rr.status IN ('pending', 'verified')`
    );
    return result?.affectedRows || 0;
}

export async function GET(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;

    let connection;
    try {
        connection = await pool.getConnection();
        const withRequests = await hasRegistrationTable(connection);
        if (withRequests) await syncApprovedRequests(connection);

        const { searchParams } = new URL(request.url);
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10), 1), 200);

        const requestJoin = withRequests
            ? `LEFT JOIN registration_requests rr ON rr.id = (
                   SELECT r2.id FROM registration_requests r2 WHERE r2.officer_id = o.id ORDER BY r2.created_at DESC, r2.id DESC LIMIT 1
               )`
            : '';
        const requestCols = withRequests
            ? 'rr.id AS request_id, rr.status AS request_status, rr.agency, rr.created_at AS requested_at, rr.verified_at'
            : 'NULL AS request_id, NULL AS request_status, NULL AS agency, NULL AS requested_at, NULL AS verified_at';

        const [rows] = await connection.execute(
            `SELECT o.id, o.username, o.title, o.given_name, o.family_name, o.email, o.phone, o.department, o.position,
                    o.role, o.requested_role, o.created_at, o.request_time,
                    o.pid_hash IS NOT NULL AS thaiid_verified,
                    ${requestCols}
             FROM officer o
             ${requestJoin}
             WHERE COALESCE(o.is_approved, 0) <> 1
             ORDER BY (o.pid_hash IS NOT NULL) DESC, COALESCE(${withRequests ? 'rr.created_at, ' : ''}o.request_time, o.created_at) DESC
             LIMIT ?`,
            [String(limit)]
        );

        const queue = rows.map((row) => ({
            ...row,
            thaiid_verified: Boolean(Number(row.thaiid_verified)),
            agency: row.agency || row.department || null,
            rejected: row.request_status === 'rejected'
        }));
        const waiting = queue.filter((row) => !row.rejected);
        const stats = {
            waiting: waiting.length,
            verified: waiting.filter((row) => row.thaiid_verified).length,
            unverified: waiting.filter((row) => !row.thaiid_verified).length,
            rejected: queue.length - waiting.length
        };
        // badge ในเมนู = คนที่ต้องตัดสินใจ (ไม่นับที่ปฏิเสธไปแล้ว)
        stats.actionable = stats.waiting;

        return NextResponse.json({ success: true, data: queue, stats });
    } catch (error) {
        console.error('Admin registrations error:', error);
        return NextResponse.json({ success: false, message: 'เกิดข้อผิดพลาดในการดึงคำขอสมัครเจ้าหน้าที่' }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// ปฏิเสธคำขอ (บัญชียังอยู่แต่เข้าใช้ไม่ได้) หรือคืนคำขอที่ปฏิเสธไปแล้วกลับเข้าคิว
export async function PATCH(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;

    const body = await request.json().catch(() => ({}));
    const officerId = Number(body.officer_id);
    const action = body.action;
    if (!Number.isInteger(officerId) || officerId <= 0 || !['reject', 'restore'].includes(action)) {
        return NextResponse.json({ success: false, message: 'ข้อมูลคำขอไม่ถูกต้อง' }, { status: 400 });
    }
    const reason = String(body.reason || '').trim().slice(0, 300);
    if (action === 'reject' && reason.length < 5) {
        return NextResponse.json({ success: false, message: 'กรุณาระบุเหตุผลที่ปฏิเสธอย่างน้อย 5 ตัวอักษร' }, { status: 400 });
    }

    let connection;
    try {
        connection = await pool.getConnection();
        const [officers] = await connection.execute('SELECT id, username, title, given_name, family_name, email, is_approved FROM officer WHERE id = ?', [officerId]);
        const officer = officers[0];
        if (!officer) return NextResponse.json({ success: false, message: 'ไม่พบเจ้าหน้าที่' }, { status: 404 });
        if (Number(officer.is_approved) === 1) return NextResponse.json({ success: false, message: 'บัญชีนี้อนุมัติแล้ว' }, { status: 409 });

        if (!(await hasRegistrationTable(connection))) {
            return NextResponse.json({ success: false, message: 'ยังไม่มีตารางคำขอลงทะเบียน' }, { status: 503 });
        }
        const [existing] = await connection.execute('SELECT id FROM registration_requests WHERE officer_id = ? ORDER BY created_at DESC, id DESC LIMIT 1', [officerId]);
        const nextStatus = action === 'reject' ? 'rejected' : 'pending';
        if (existing.length) {
            await connection.execute('UPDATE registration_requests SET status = ? WHERE id = ?', [nextStatus, existing[0].id]);
        } else if (action === 'reject') {
            // บัญชีเก่าที่ไม่มีคำขอ: สร้างบันทึกคำขอไว้เก็บสถานะปฏิเสธ
            await connection.execute(
                `INSERT INTO registration_requests (user_type, officer_id, given_name, family_name, normalized_given_name, normalized_family_name, agency, status)
                 VALUES ('officer', ?, ?, ?, ?, ?, '-', 'rejected')`,
                [officerId, officer.given_name || '-', officer.family_name || '-', String(officer.given_name || '').replace(/\s+/g, '').toLowerCase(), String(officer.family_name || '').replace(/\s+/g, '').toLowerCase()]
            );
        }
        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'officer', id: officerId,
            description: action === 'reject' ? `ปฏิเสธคำขอสมัครเจ้าหน้าที่ ${officer.username}: ${reason}` : `คืนคำขอสมัครเจ้าหน้าที่ ${officer.username} กลับเข้าคิว`
        });
        const email = action === 'reject' ? await notifyAccountDecision(officer, 'rejected', { reason }) : null;
        return NextResponse.json({
            success: true,
            message: action === 'reject' ? 'ปฏิเสธคำขอแล้ว' : 'คืนคำขอเข้าคิวแล้ว',
            email,
            emailMessage: emailOutcomeText(email)
        });
    } catch (error) {
        console.error('Admin registration update error:', error);
        return NextResponse.json({ success: false, message: 'บันทึกไม่สำเร็จ' }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
