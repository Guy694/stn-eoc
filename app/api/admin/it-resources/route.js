import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - Fetch all IT resources
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const resourceType = searchParams.get('resource_type');
        const status = searchParams.get('status');

        let query = `SELECT * FROM it_resources WHERE 1=1`;
        let params = [];

        if (resourceType) {
            query += ` AND resource_type = ?`;
            params.push(resourceType);
        }

        if (status) {
            query += ` AND status = ?`;
            params.push(status);
        }

        query += ` ORDER BY resource_type, unit_name`;

        const pool = await getConnection();
        const [rows] = await pool.query(query, params);

        // Calculate stats
        const [statsResult] = await pool.query(`
            SELECT 
                COUNT(*) as total,
                SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
                SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline,
                SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance,
                SUM(CASE WHEN status = 'unknown' THEN 1 ELSE 0 END) as unknown
            FROM it_resources
        `);

        // Stats by resource type
        const [byTypeResult] = await pool.query(`
            SELECT resource_type, COUNT(*) as count
            FROM it_resources
            GROUP BY resource_type
            ORDER BY count DESC
        `);

        // Stats by ISP provider (for internet type)
        const [byIspResult] = await pool.query(`
            SELECT isp_provider, COUNT(*) as count, 
                   SUM(CASE WHEN status = 'online' THEN 1 ELSE 0 END) as online,
                   SUM(CASE WHEN status = 'offline' THEN 1 ELSE 0 END) as offline
            FROM it_resources
            WHERE resource_type = 'internet' AND isp_provider IS NOT NULL AND isp_provider != ''
            GROUP BY isp_provider
            ORDER BY count DESC
        `);

        return NextResponse.json({
            success: true,
            data: Array.isArray(rows) ? rows : [],
            stats: {
                ...(statsResult[0] || { total: 0, online: 0, offline: 0, maintenance: 0, unknown: 0 }),
                byType: byTypeResult || [],
                byIsp: byIspResult || []
            }
        });
    } catch (error) {
        console.error('Get IT resources error:', error);
        return NextResponse.json({
            success: false,
            message: error.code === 'ER_NO_SUCH_TABLE'
                ? 'ยังไม่ได้สร้างตาราง it_resources กรุณารัน SQL ก่อน'
                : 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            data: [],
            stats: { total: 0, online: 0, offline: 0, maintenance: 0, unknown: 0 }
        });
    }
}

// POST - Create new IT resource
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const {
            resource_type,
            unit_name,
            unit_code,
            location,
            server_name,
            server_ip,
            server_os,
            isp_provider,
            connection_type,
            bandwidth,
            status,
            notes,
            contact_person,
            contact_phone
        } = body;

        // Validation
        if (!resource_type || !unit_name) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกประเภททรัพยากรและชื่อหน่วยบริการ' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        const [result] = await pool.query(
            `INSERT INTO it_resources 
            (resource_type, unit_name, unit_code, location, server_name, server_ip, server_os, 
             isp_provider, connection_type, bandwidth, status, notes, contact_person, contact_phone, last_check) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
            [
                resource_type,
                unit_name,
                unit_code || null,
                location || null,
                server_name || null,
                server_ip || null,
                server_os || null,
                isp_provider || null,
                connection_type || null,
                bandwidth || null,
                status || 'unknown',
                notes || null,
                contact_person || null,
                contact_phone || null
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'เพิ่มข้อมูลสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create IT resource error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    }
}

// PUT - Update IT resource
export async function PUT(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const {
            resource_type,
            unit_name,
            unit_code,
            location,
            server_name,
            server_ip,
            server_os,
            isp_provider,
            connection_type,
            bandwidth,
            status,
            notes,
            contact_person,
            contact_phone
        } = body;

        const pool = await getConnection();
        await pool.query(
            `UPDATE it_resources 
            SET resource_type = ?, unit_name = ?, unit_code = ?, location = ?, 
                server_name = ?, server_ip = ?, server_os = ?,
                isp_provider = ?, connection_type = ?, bandwidth = ?,
                status = ?, notes = ?, contact_person = ?, contact_phone = ?, last_check = NOW()
            WHERE id = ?`,
            [
                resource_type,
                unit_name,
                unit_code || null,
                location || null,
                server_name || null,
                server_ip || null,
                server_os || null,
                isp_provider || null,
                connection_type || null,
                bandwidth || null,
                status || 'unknown',
                notes || null,
                contact_person || null,
                contact_phone || null,
                id
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update IT resource error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขข้อมูล');
    }
}

// DELETE - Delete IT resource
export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        await pool.query('DELETE FROM it_resources WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Delete IT resource error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบข้อมูล');
    }
}
