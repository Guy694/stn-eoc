// ========================================
// API Route: จัดการสมาชิกในทีม
// Path: app/api/admin/eoc-teams/[sessionTeamId]/members/route.js
// ========================================

import { NextResponse } from 'next/server';
import { getConnection, query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { appendAuditLog } from '@/lib/auditLog';

const TEAM_MEMBER_ROLES = new Set(['หัวหน้าทีม', 'รองหัวหน้าทีม', 'สมาชิกทีม']);

async function getTeamContext(connection, sessionTeamId) {
    const [rows] = await connection.execute(`
        SELECT st.id AS session_team_id, st.eoc_session_id, st.team_lead_officer_id,
               s.session_number, s.eoc_type, s.status AS session_status,
               t.team_code, t.team_name_th
        FROM eoc_session_teams st
        JOIN eoc_sessions s ON s.id = st.eoc_session_id
        JOIN eoc_teams t ON t.id = st.team_id
        WHERE st.id = ? AND st.is_active = TRUE AND t.is_active = TRUE
        LIMIT 1
    `, [sessionTeamId]);
    return rows[0] || null;
}

function officerDisplayName(officer) {
    return [officer.title, officer.given_name, officer.family_name].filter(Boolean).join(' ');
}

async function writeMemberAudit(connection, request, user, {
    action,
    membershipId,
    context,
    officer,
    oldRole = null,
    newRole = null,
    notes = null,
    source,
}) {
    const actionLabels = {
        data_create: 'เพิ่มเข้ากลุ่มภารกิจ',
        data_update: 'เปลี่ยนบทบาทในกลุ่มภารกิจ',
        data_delete: 'ถอดออกจากกลุ่มภารกิจ',
    };
    const officerName = officerDisplayName(officer);
    await appendAuditLog(
        (sql, values) => connection.execute(sql, values),
        {
            request,
            user,
            action,
            targetType: 'eoc_team_member',
            targetId: membershipId,
            sessionId: context.eoc_session_id,
            sessionTeamId: context.session_team_id,
            description: `${actionLabels[action]}: ${officerName} · ${context.team_code} - ${context.team_name_th}`,
            metadata: {
                source,
                officerId: Number(officer.id),
                officerName,
                officerUsername: officer.username,
                sessionNumber: context.session_number,
                eocType: context.eoc_type,
                teamCode: context.team_code,
                teamName: context.team_name_th,
                notes,
            },
            oldValues: oldRole ? { roleInTeam: oldRole, isActive: true } : null,
            newValues: newRole ? { roleInTeam: newRole, isActive: true } : null,
        }
    );
}

// GET: ดึงรายชื่อสมาชิกในทีม
export async function GET(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { sessionTeamId } = await params;

        const members = await query(`
            SELECT 
                tm.id,
                tm.officer_id,
                o.username,
                CONCAT(COALESCE(o.title, ''), o.given_name, ' ', o.family_name) as full_name,
                o.given_name,
                o.family_name,
                o.title,
                o.role as officer_role,
                tm.role_in_team,
                tm.assigned_at,
                tm.is_active,
                tm.removed_at
            FROM eoc_team_members tm
            JOIN officer o ON tm.officer_id = o.id
            WHERE tm.session_team_id = ?
            ORDER BY tm.is_active DESC, tm.assigned_at ASC
        `, [sessionTeamId]);

        return NextResponse.json({
            success: true,
            members: members
        });

    } catch (error) {
        console.error('Error fetching team members:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลสมาชิกทีม');
    }
}

// POST: เพิ่มสมาชิกเข้าทีม
export async function POST(request, { params }) {
    const auth = await requireAuth(request, ['admin', 'commander']);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const connection = await pool.getConnection();
    try {
        const { sessionTeamId } = await params;
        const body = await request.json();
        const { officerId, roleInTeam, notes } = body;

        // Validate required fields
        if (!sessionTeamId || !officerId || !roleInTeam) {
            return NextResponse.json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            }, { status: 400 });
        }
        if (!TEAM_MEMBER_ROLES.has(roleInTeam)) {
            return NextResponse.json({ success: false, message: 'บทบาทในทีมไม่ถูกต้อง' }, { status: 400 });
        }

        await connection.beginTransaction();
        const context = await getTeamContext(connection, sessionTeamId);
        if (!context || context.session_status !== 'active') {
            await connection.rollback();
            return NextResponse.json({ success: false, message: 'ไม่พบกลุ่มภารกิจที่เปิดใช้งาน' }, { status: 404 });
        }
        const [officers] = await connection.execute(`
            SELECT id, username, title, given_name, family_name
            FROM officer WHERE id = ? LIMIT 1
        `, [officerId]);
        if (!officers.length) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: 'ไม่พบเจ้าหน้าที่' }, { status: 404 });
        }

        const [existing] = await connection.execute(`
            SELECT id FROM eoc_team_members
            WHERE session_team_id = ? AND officer_id = ? AND is_active = TRUE
        `, [sessionTeamId, officerId]);

        if (existing.length > 0) {
            await connection.rollback();
            return NextResponse.json({
                success: false,
                message: 'เจ้าหน้าที่นี้อยู่ในทีมแล้ว'
            }, { status: 400 });
        }

        const [result] = await connection.execute(`
            INSERT INTO eoc_team_members 
            (session_team_id, officer_id, role_in_team, assigned_by, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [sessionTeamId, officerId, roleInTeam || 'เจ้าหน้าที่', auth.user.id, notes || null]);

        await writeMemberAudit(connection, request, auth.user, {
            action: 'data_create',
            membershipId: result.insertId,
            context,
            officer: officers[0],
            newRole: roleInTeam,
            notes: notes || null,
            source: 'team_members',
        });
        await connection.commit();
        return NextResponse.json({
            success: true,
            message: 'เพิ่มสมาชิกสำเร็จ',
            auditEventsCreated: 1,
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error adding team member:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเพิ่มสมาชิกทีม');
    } finally {
        connection.release();
    }
}

// PATCH: อัพเดทบทบาทของสมาชิก
export async function PATCH(request, { params }) {
    const auth = await requireAuth(request, ['admin', 'commander']);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const connection = await pool.getConnection();
    try {
        const { sessionTeamId } = await params;
        const body = await request.json();
        const { memberId, roleInTeam } = body;
        if (!memberId || !TEAM_MEMBER_ROLES.has(roleInTeam)) {
            return NextResponse.json({ success: false, message: 'ข้อมูลสมาชิกหรือบทบาทไม่ถูกต้อง' }, { status: 400 });
        }

        await connection.beginTransaction();
        const context = await getTeamContext(connection, sessionTeamId);
        const [members] = await connection.execute(`
            SELECT tm.id, tm.role_in_team, o.id AS officer_id, o.username,
                   o.title, o.given_name, o.family_name
            FROM eoc_team_members tm
            JOIN officer o ON o.id = tm.officer_id
            WHERE tm.id = ? AND tm.session_team_id = ? AND tm.is_active = TRUE
            FOR UPDATE
        `, [memberId, sessionTeamId]);
        if (!context || !members.length) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: 'ไม่พบสมาชิกในกลุ่มภารกิจ' }, { status: 404 });
        }
        if (members[0].role_in_team === roleInTeam) {
            await connection.rollback();
            return NextResponse.json({ success: true, message: 'บทบาทไม่มีการเปลี่ยนแปลง', auditEventsCreated: 0 });
        }

        await connection.execute(`
            UPDATE eoc_team_members 
            SET role_in_team = ?
            WHERE id = ? AND session_team_id = ?
        `, [roleInTeam, memberId, sessionTeamId]);

        await writeMemberAudit(connection, request, auth.user, {
            action: 'data_update',
            membershipId: memberId,
            context,
            officer: { ...members[0], id: members[0].officer_id },
            oldRole: members[0].role_in_team,
            newRole: roleInTeam,
            source: 'team_members',
        });
        await connection.commit();
        return NextResponse.json({
            success: true,
            message: 'อัพเดทบทบาทสำเร็จ',
            auditEventsCreated: 1,
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating team member:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัพเดทสมาชิกทีม');
    } finally {
        connection.release();
    }
}

// DELETE: ถอดสมาชิกออกจากทีม
export async function DELETE(request, { params }) {
    const auth = await requireAuth(request, ['admin', 'commander']);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const connection = await pool.getConnection();
    try {
        const { sessionTeamId } = await params;
        const { searchParams } = new URL(request.url);
        const memberId = searchParams.get('memberId');

        if (!memberId) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุ memberId'
            }, { status: 400 });
        }

        await connection.beginTransaction();
        const context = await getTeamContext(connection, sessionTeamId);
        const [members] = await connection.execute(`
            SELECT tm.id, tm.role_in_team, o.id AS officer_id, o.username,
                   o.title, o.given_name, o.family_name
            FROM eoc_team_members tm
            JOIN officer o ON o.id = tm.officer_id
            WHERE tm.id = ? AND tm.session_team_id = ? AND tm.is_active = TRUE
            FOR UPDATE
        `, [memberId, sessionTeamId]);
        if (!context || !members.length) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: 'ไม่พบสมาชิกในกลุ่มภารกิจ' }, { status: 404 });
        }

        await connection.execute(`
            UPDATE eoc_team_members 
            SET is_active = FALSE,
                removed_at = NOW(),
                removed_by = ?
            WHERE id = ? AND session_team_id = ?
        `, [auth.user.id, memberId, sessionTeamId]);
        await connection.execute(`
            UPDATE eoc_session_teams
            SET team_lead_officer_id = NULL
            WHERE id = ? AND team_lead_officer_id = ?
        `, [sessionTeamId, members[0].officer_id]);

        await writeMemberAudit(connection, request, auth.user, {
            action: 'data_delete',
            membershipId: memberId,
            context,
            officer: { ...members[0], id: members[0].officer_id },
            oldRole: members[0].role_in_team,
            source: 'team_members',
        });
        await connection.commit();
        return NextResponse.json({
            success: true,
            message: 'ถอดสมาชิกออกจากทีมสำเร็จ',
            auditEventsCreated: 1,
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error removing team member:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการถอดสมาชิกทีม');
    } finally {
        connection.release();
    }
}
