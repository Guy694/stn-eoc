// ========================================
// API Route: ข้อมูลทีมงานที่ user รับผิดชอบ
// Path: app/api/user/my-assignments/route.js
// ========================================

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
    try {
        // ดึง user จาก session/cookie (ปรับตามระบบ auth ของคุณ)
        const userId = request.headers.get('x-user-id') || request.cookies.get('userId')?.value;

        if (!userId) {
            return NextResponse.json({
                success: false,
                message: 'กรุณา login ก่อนใช้งาน'
            }, { status: 401 });
        }

        // ดึงข้อมูลจาก view
        const [assignments] = await pool.query(`
            SELECT * FROM vw_officer_team_assignments
            WHERE officer_id = ? 
              AND is_active = TRUE
              AND session_status = 'active'
            ORDER BY assigned_at DESC
        `, [userId]);

        // ดึง modules ที่แต่ละทีมสามารถเข้าถึงได้
        for (let assignment of assignments) {
            const [modules] = await pool.query(`
                SELECT 
                    m.id,
                    m.module_code,
                    m.module_name_th,
                    m.module_name_en,
                    m.module_type,
                    m.route_path,
                    m.icon,
                    p.can_view,
                    p.can_create,
                    p.can_edit,
                    p.can_delete,
                    p.can_approve
                FROM eoc_type_modules m
                LEFT JOIN module_permissions p ON m.id = p.module_id
                LEFT JOIN eoc_teams t ON p.team_id = t.id
                WHERE m.eoc_type = ? 
                  AND (t.team_code = ? OR p.team_id IS NULL)
                  AND m.is_active = TRUE
                ORDER BY m.sort_order
            `, [assignment.eoc_type, assignment.team_code]);

            assignment.modules = modules;
        }

        return NextResponse.json({
            success: true,
            assignments: assignments
        });

    } catch (error) {
        console.error('Error fetching user assignments:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        }, { status: 500 });
    }
}
