// ========================================
// API Route: จัดการสมาชิกในทีม
// Path: app/api/admin/eoc-teams/[sessionTeamId]/members/route.js
// ========================================

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: ดึงรายชื่อสมาชิกในทีม
export async function GET(request, { params }) {
    try {
        const { sessionTeamId } = params;

        const [members] = await pool.query(`
            SELECT 
                tm.id,
                tm.officer_id,
                o.username,
                o.full_name,
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
        const { sessionTeamId } = params;
        const body = await request.json();
        const { officerId, roleInTeam, assignedBy, notes } = body;

        // ตรวจสอบว่าเจ้าหน้าที่อยู่ในทีมนี้แล้วหรือยัง
        const [existing] = await pool.query(`
            SELECT id FROM eoc_team_members 
            WHERE session_team_id = ? AND officer_id = ? AND is_active = TRUE
        `, [sessionTeamId, officerId]);

        if (existing.length > 0) {
            return NextResponse.json({
                success: false,
                message: 'เจ้าหน้าที่นี้อยู่ในทีมแล้ว'
            }, { status: 400 });
        }

        // เพิ่มสมาชิก
        const [result] = await pool.query(`
            INSERT INTO eoc_team_members 
            (session_team_id, officer_id, role_in_team, assigned_by, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [sessionTeamId, officerId, roleInTeam || 'สมาชิก', assignedBy, notes]);

        return NextResponse.json({
            success: true,
            message: 'เพิ่มสมาชิกสำเร็จ',
            memberId: result.insertId
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
        const { sessionTeamId } = params;
        const body = await request.json();
        const { memberId, roleInTeam } = body;

        await pool.query(`
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
        const { sessionTeamId } = params;
        const { searchParams } = new URL(request.url);
        const memberId = searchParams.get('memberId');

        if (!memberId) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุ memberId'
            }, { status: 400 });
        }

        await pool.query(`
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
