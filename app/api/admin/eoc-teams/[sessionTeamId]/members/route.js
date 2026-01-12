// ========================================
// API Route: จัดการสมาชิกในทีม
// Path: app/api/admin/eoc-teams/[sessionTeamId]/members/route.js
// ========================================

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: ดึงรายชื่อสมาชิกในทีม
export async function GET(request, { params }) {
    try {
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
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        }, { status: 500 });
    }
}

// POST: เพิ่มสมาชิกเข้าทีม
export async function POST(request, { params }) {
    try {
        const { sessionTeamId } = await params;
        const body = await request.json();
        const { officerId, roleInTeam, assignedBy, notes } = body;

        console.log('POST /members - Received:', { sessionTeamId, officerId, roleInTeam, assignedBy, notes });

        // Validate required fields
        if (!sessionTeamId || !officerId || !roleInTeam || !assignedBy) {
            return NextResponse.json({
                success: false,
                message: 'ข้อมูลไม่ครบถ้วน'
            }, { status: 400 });
        }

        // ตรวจสอบว่าเจ้าหน้าที่อยู่ในทีมนี้แล้วหรือยัง
        const existing = await query(`
            SELECT id FROM eoc_team_members 
            WHERE session_team_id = ? AND officer_id = ? AND is_active = TRUE
        `, [sessionTeamId, officerId]);

        if (existing.length > 0) {
            return NextResponse.json({
                success: false,
                message: 'เจ้าหน้าที่นี้อยู่ในทีมแล้ว'
            }, { status: 400 });
        }

        // เพิ่มสมาชิก - แปลง undefined เป็น null
        await query(`
            INSERT INTO eoc_team_members 
            (session_team_id, officer_id, role_in_team, assigned_by, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [sessionTeamId, officerId, roleInTeam || 'เจ้าหน้าที่', assignedBy, notes || null]);

        return NextResponse.json({
            success: true,
            message: 'เพิ่มสมาชิกสำเร็จ'
        });

    } catch (error) {
        console.error('Error adding team member:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        }, { status: 500 });
    }
}

// PATCH: อัพเดทบทบาทของสมาชิก
export async function PATCH(request, { params }) {
    try {
        const { sessionTeamId } = await params;
        const body = await request.json();
        const { memberId, roleInTeam } = body;

        await query(`
            UPDATE eoc_team_members 
            SET role_in_team = ?
            WHERE id = ? AND session_team_id = ?
        `, [roleInTeam, memberId, sessionTeamId]);

        return NextResponse.json({
            success: true,
            message: 'อัพเดทบทบาทสำเร็จ'
        });

    } catch (error) {
        console.error('Error updating team member:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        }, { status: 500 });
    }
}

// DELETE: ถอดสมาชิกออกจากทีม
export async function DELETE(request, { params }) {
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

        await query(`
            UPDATE eoc_team_members 
            SET is_active = FALSE,
                removed_at = NOW()
            WHERE id = ? AND session_team_id = ?
        `, [memberId, sessionTeamId]);

        return NextResponse.json({
            success: true,
            message: 'ถอดสมาชิกออกจากทีมสำเร็จ'
        });

    } catch (error) {
        console.error('Error removing team member:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        }, { status: 500 });
    }
}
