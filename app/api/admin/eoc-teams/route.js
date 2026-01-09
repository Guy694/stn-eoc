// ========================================
// API Route: จัดการทีมงาน EOC (CRUD)
// Path: app/api/admin/eoc-teams/route.js
// ========================================

import { NextResponse } from 'next/server';
import pool from '@/lib/db';

// GET: ดึงรายชื่อทีมทั้งหมด
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const active = searchParams.get('active');

        let query = 'SELECT * FROM eoc_teams';
        if (active === 'true') {
            query += ' WHERE is_active = TRUE';
        }
        query += ' ORDER BY sort_order';

        const [teams] = await pool.query(query);

        return NextResponse.json({
            success: true,
            teams: teams
        });
    } catch (error) {
        console.error('Error fetching teams:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message
        }, { status: 500 });
    }
}

// POST: สร้างทีมใหม่
export async function POST(request) {
    try {
        const body = await request.json();
        const { team_code, team_name_th, team_name_en, description, icon, color, sort_order } = body;

        if (!team_code || !team_name_th || !team_name_en) {
            return NextResponse.json({
                success: false,
                message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
            }, { status: 400 });
        }

        const [result] = await pool.query(`
            INSERT INTO eoc_teams 
            (team_code, team_name_th, team_name_en, description, icon, color, sort_order)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `, [team_code, team_name_th, team_name_en, description || null, icon || '👥', color || 'blue', sort_order || 0]);

        return NextResponse.json({
            success: true,
            message: 'สร้างทีมสำเร็จ',
            teamId: result.insertId
        });

    } catch (error) {
        console.error('Error creating team:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        }, { status: 500 });
    }
}

// PUT: อัพเดทข้อมูลทีม
export async function PUT(request) {
    try {
        const body = await request.json();
        const { id, team_name_th, team_name_en, description, icon, color, sort_order, is_active } = body;

        if (!id) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุ ID ของทีม'
            }, { status: 400 });
        }

        await pool.query(`
            UPDATE eoc_teams 
            SET team_name_th = ?,
                team_name_en = ?,
                description = ?,
                icon = ?,
                color = ?,
                sort_order = ?,
                is_active = ?
            WHERE id = ?
        `, [team_name_th, team_name_en, description, icon, color, sort_order, is_active, id]);

        return NextResponse.json({
            success: true,
            message: 'อัพเดทข้อมูลทีมสำเร็จ'
        });

    } catch (error) {
        console.error('Error updating team:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        }, { status: 500 });
    }
}

// DELETE: ลบทีม (soft delete)
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const teamId = searchParams.get('id');

        if (!teamId) {
            return NextResponse.json({
                success: false,
                message: 'กรุณาระบุ ID ของทีม'
            }, { status: 400 });
        }

        await pool.query('UPDATE eoc_teams SET is_active = FALSE WHERE id = ?', [teamId]);

        return NextResponse.json({
            success: true,
            message: 'ลบทีมสำเร็จ'
        });

    } catch (error) {
        console.error('Error deleting team:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด',
            error: error.message
        }, { status: 500 });
    }
}
