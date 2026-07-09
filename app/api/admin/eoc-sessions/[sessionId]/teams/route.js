// ========================================
// API Route: จัดการทีมงานใน EOC Session
// Path: app/api/admin/eoc-sessions/[sessionId]/teams/route.js
// ========================================

import { NextResponse } from 'next/server';
import { query, getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET: ดึงข้อมูลทีมงานทั้งหมดของ Session
export async function GET(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { sessionId } = await params;

        // ดึงข้อมูล Session พร้อมทีมงาน
        const session = await query(`
            SELECT 
                s.id,
                s.eoc_type,
                s.session_number,
                s.status,
                s.opened_at,
                status.name_th as eoc_name
            FROM eoc_sessions s
            JOIN eoc_status status ON s.eoc_type = status.eoc_type
            WHERE s.id = ?
        `, [sessionId]);

        if (session.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่พบ Session นี้'
            }, { status: 404 });
        }

        // ดึงข้อมูลทีมงานของ Session นี้ (เฉพาะทีมที่เปิดใช้งาน)
        const teams = await query(`
            SELECT 
                st.id as session_team_id,
                st.team_id,
                t.team_code,
                t.team_name_th,
                t.team_name_en,
                t.icon,
                t.color,
                st.team_lead_officer_id,
                CONCAT(COALESCE(o.title, ''), o.given_name, ' ', o.family_name) as team_lead_name,
                o.username as team_lead_username,
                st.assigned_at,
                st.notes,
                COUNT(tm.id) as member_count,
                st.is_active,
                t.is_active as team_is_active
            FROM eoc_session_teams st
            JOIN eoc_teams t ON st.team_id = t.id
            LEFT JOIN officer o ON st.team_lead_officer_id = o.id
            LEFT JOIN eoc_team_members tm ON st.id = tm.session_team_id AND tm.is_active = TRUE
            WHERE st.eoc_session_id = ? 
            AND st.is_active = TRUE 
            AND t.is_active = TRUE
            GROUP BY st.id
            ORDER BY t.sort_order
        `, [sessionId]);

        // ดึงรายละเอียดสมาชิกแต่ละทีม
        for (let team of teams) {
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
                    tm.is_active
                FROM eoc_team_members tm
                JOIN officer o ON tm.officer_id = o.id
                WHERE tm.session_team_id = ?
                ORDER BY 
                    CASE tm.role_in_team 
                        WHEN 'หัวหน้าทีม' THEN 1
                        WHEN 'รองหัวหน้าทีม' THEN 2
                        ELSE 3
                    END,
                    o.given_name, o.family_name
            `, [team.session_team_id]);

            team.members = members;
        }

        return NextResponse.json({
            success: true,
            session: session[0],
            teams: teams
        });

    } catch (error) {
        console.error('Error fetching session teams:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลทีมใน session');
    }
}

// POST: มอบหมายทีมใหม่เข้า Session
export async function POST(request, { params }) {
    const auth = await requireAuth(request, ['admin', 'commander']);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const conn = await pool.getConnection();

    try {
        const { sessionId } = await params;
        const body = await request.json();
        const { teamId, teamLeadOfficerId, notes } = body;

        // ตรวจสอบว่า Session ยังเปิดอยู่หรือไม่
        const [session] = await conn.query(
            'SELECT status FROM eoc_sessions WHERE id = ?',
            [sessionId]
        );

        if (session.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่พบ Session นี้'
            }, { status: 404 });
        }

        if (session[0].status !== 'active') {
            return NextResponse.json({
                success: false,
                message: 'ไม่สามารถเพิ่มทีมในเซสชันที่ปิดแล้วได้'
            }, { status: 400 });
        }

        await conn.beginTransaction();

        // ตรวจสอบว่าทีมนี้ถูกมอบหมายไปแล้วหรือยัง
        const [existing] = await conn.query(`
            SELECT id FROM eoc_session_teams 
            WHERE eoc_session_id = ? AND team_id = ? AND is_active = TRUE
        `, [sessionId, teamId]);

        if (existing.length > 0) {
            await conn.rollback();
            return NextResponse.json({
                success: false,
                message: 'ทีมนี้ได้รับการมอบหมายในเซสชันนี้แล้ว'
            }, { status: 400 });
        }

        // เพิ่มทีมเข้า Session
        const [result] = await conn.query(`
            INSERT INTO eoc_session_teams 
            (eoc_session_id, team_id, team_lead_officer_id, assigned_by, notes)
            VALUES (?, ?, ?, ?, ?)
        `, [sessionId, teamId, teamLeadOfficerId, auth.user.id, notes]);

        const sessionTeamId = result.insertId;

        // เพิ่มหัวหน้าทีมเป็นสมาชิกคนแรก
        if (teamLeadOfficerId) {
            await conn.query(`
                INSERT INTO eoc_team_members 
                (session_team_id, officer_id, role_in_team, assigned_by)
                VALUES (?, ?, 'หัวหน้าทีม', ?)
            `, [sessionTeamId, teamLeadOfficerId, auth.user.id]);
        }

        await conn.commit();

        return NextResponse.json({
            success: true,
            message: 'มอบหมายทีมสำเร็จ',
            sessionTeamId: sessionTeamId
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error assigning team:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการมอบหมายทีม');
    } finally {
        conn.release();
    }
}

// PUT: แก้ไขข้อมูลทีมใน Session
export async function PUT(request, { params }) {
    const auth = await requireAuth(request, ['admin', 'commander']);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const conn = await pool.getConnection();

    try {
        const { sessionId } = await params;
        const body = await request.json();
        const { sessionTeamId, teamLeadOfficerId, notes } = body;

        if (!sessionTeamId) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุ sessionTeamId'
            }, { status: 400 });
        }

        const [sessionTeams] = await conn.query(`
            SELECT st.id, st.eoc_session_id, s.status
            FROM eoc_session_teams st
            JOIN eoc_sessions s ON st.eoc_session_id = s.id
            WHERE st.id = ? AND st.eoc_session_id = ? AND st.is_active = TRUE
        `, [sessionTeamId, sessionId]);

        if (sessionTeams.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่พบทีมใน Session นี้'
            }, { status: 404 });
        }

        if (sessionTeams[0].status !== 'active') {
            return NextResponse.json({
                success: false,
                message: 'ไม่สามารถแก้ไขทีมในเซสชันที่ปิดแล้วได้'
            }, { status: 400 });
        }

        await conn.beginTransaction();

        await conn.query(`
            UPDATE eoc_session_teams
            SET team_lead_officer_id = ?,
                notes = ?
            WHERE id = ? AND eoc_session_id = ?
        `, [teamLeadOfficerId || null, notes || null, sessionTeamId, sessionId]);

        if (teamLeadOfficerId) {
            const [existingLeadMember] = await conn.query(`
                SELECT id
                FROM eoc_team_members
                WHERE session_team_id = ?
                  AND officer_id = ?
                  AND is_active = TRUE
                LIMIT 1
            `, [sessionTeamId, teamLeadOfficerId]);

            if (existingLeadMember.length === 0) {
                await conn.query(`
                    INSERT INTO eoc_team_members
                    (session_team_id, officer_id, role_in_team, assigned_by)
                    VALUES (?, ?, 'หัวหน้าทีม', ?)
                `, [sessionTeamId, teamLeadOfficerId, auth.user.id]);
            } else {
                await conn.query(`
                    UPDATE eoc_team_members
                    SET role_in_team = 'หัวหน้าทีม'
                    WHERE id = ?
                `, [existingLeadMember[0].id]);
            }
        }

        await conn.commit();

        return NextResponse.json({
            success: true,
            message: 'แก้ไขทีมใน Session สำเร็จ'
        });
    } catch (error) {
        await conn.rollback();
        console.error('Error updating session team:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขทีม');
    } finally {
        conn.release();
    }
}

// DELETE: ถอดทีมออกจาก Session
export async function DELETE(request, { params }) {
    const auth = await requireAuth(request, ['admin', 'commander']);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const conn = await pool.getConnection();

    try {
        const { sessionId } = await params;
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('teamId');

        if (!teamId) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุ teamId'
            }, { status: 400 });
        }

        await conn.beginTransaction();

        // อัพเดทสถานะทีมเป็น inactive
        await conn.query(`
            UPDATE eoc_session_teams 
            SET is_active = FALSE
            WHERE eoc_session_id = ? AND team_id = ?
        `, [sessionId, teamId]);

        // อัพเดทสถานะสมาชิกทั้งหมดเป็น inactive
        await conn.query(`
            UPDATE eoc_team_members tm
            JOIN eoc_session_teams st ON tm.session_team_id = st.id
            SET tm.is_active = FALSE,
                tm.removed_at = NOW()
            WHERE st.eoc_session_id = ? AND st.team_id = ?
        `, [sessionId, teamId]);

        await conn.commit();

        return NextResponse.json({
            success: true,
            message: 'ถอดทีมออกจาก Session สำเร็จ'
        });

    } catch (error) {
        await conn.rollback();
        console.error('Error removing team:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการถอดทีม');
    } finally {
        conn.release();
    }
}
