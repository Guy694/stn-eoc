// ========================================
// API Route: ดูข้อมูลทีมงานใน EOC Session (Public)
// Path: app/api/eoc/sessions/[sessionId]/teams/route.js
// ========================================

import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET: ดึงข้อมูลทีมงานและสมาชิกทั้งหมดของ Session (สำหรับ public view)
export async function GET(request, { params }) {
    try {
        const { sessionId } = await params;

        // ดึงข้อมูล Session
        const session = await query(`
            SELECT 
                s.id,
                s.eoc_type,
                s.session_number,
                s.status,
                s.opened_at,
                s.closed_at,
                status.name_th as eoc_name
            FROM eoc_sessions s
            JOIN eoc_status status ON s.eoc_type = status.eoc_type
            WHERE s.id = ?
        `, [sessionId]);

        if (!Array.isArray(session) || session.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่พบ Session นี้'
            }, { status: 404 });
        }

        // ดึงข้อมูลทีมงานที่เปิดใช้งานใน Session นี้
        const teams = await query(`
            SELECT 
                st.id as session_team_id,
                st.team_id,
                t.team_code,
                t.team_name_th,
                t.team_name_en,
                t.description,
                t.icon,
                t.color,
                st.team_lead_officer_id,
                CONCAT(COALESCE(o.title, ''), o.given_name, ' ', o.family_name) as team_lead_name,
                o.username as team_lead_username,
                o.role as team_lead_role,
                st.assigned_at,
                st.notes,
                COUNT(tm.id) as member_count
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

        // ดึงรายละเอียดสมาชิกแต่ละทีม (เฉพาะสมาชิกที่ active)
        for (let team of teams) {
            const members = await query(`
                SELECT 
                    tm.id,
                    tm.officer_id,
                    o.username,
                    o.given_name,
                    o.family_name,
                    o.role as officer_role,
                    tm.role_in_team,
                    tm.assigned_at
                FROM eoc_team_members tm
                JOIN officer o ON tm.officer_id = o.id
                WHERE tm.session_team_id = ?
                AND tm.is_active = TRUE
                ORDER BY 
                    CASE tm.role_in_team 
                        WHEN 'หัวหน้าทีม' THEN 1
                        WHEN 'รองหัวหน้าทีม' THEN 2
                        ELSE 3
                    END,
                    o.given_name ASC
            `, [team.session_team_id]);

            team.members = Array.isArray(members) ? members : [];
        }

        return NextResponse.json({
            success: true,
            session: session[0],
            teams: teams
        });

    } catch (error) {
        console.error('Error fetching session teams:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        }, { status: 500 });
    }
}
