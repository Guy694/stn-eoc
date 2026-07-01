import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// GET - ดึงรายการรายงานเหตุการณ์ทั้งหมด
export async function GET(request) {
    const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
    if (!auth.success) return auth.response;

    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status'); // pending, approved, rejected
        const disasterType = searchParams.get('disaster_type');
        const page = parseInt(searchParams.get('page') || '1');
        const limit = parseInt(searchParams.get('limit') || '20');
        const offset = (page - 1) * limit;

        let whereConditions = [];
        let params = [];

        if (status) {
            whereConditions.push('status = ?');
            params.push(status);
        }

        if (disasterType) {
            whereConditions.push('disaster_type = ?');
            params.push(disasterType);
        }

        const whereClause = whereConditions.length > 0
            ? 'WHERE ' + whereConditions.join(' AND ')
            : '';

        // Query รายการรายงาน
        const [reports] = await connection.execute(
            `SELECT 
                id,
                first_name,
                last_name,
                phone,
                village,
                sub_district,
                district,
                disaster_type,
                description,
                latitude,
                longitude,
                water_level,
                affected_people,
                urgency,
                travel_status,
                report_type,
                occurred_at,
                photo_path,
                status,
                reviewed_by,
                reviewed_at,
                admin_notes,
                created_at,
                updated_at
            FROM public_incident_reports
            ${whereClause}
            ORDER BY created_at DESC
            LIMIT ? OFFSET ?`,
            [...params, String(limit), String(offset)]
        );

        // นับจำนวนทั้งหมด
        const [countResult] = await connection.execute(
            `SELECT COUNT(*) as total FROM public_incident_reports ${whereClause}`,
            params
        );

        const total = countResult[0].total;

        // สถิติ
        const [stats] = await connection.execute(
            `SELECT 
                status,
                COUNT(*) as count
            FROM public_incident_reports
            GROUP BY status`
        );

        return NextResponse.json({
            success: true,
            data: reports,
            pagination: {
                page,
                limit,
                total,
                totalPages: Math.ceil(total / limit)
            },
            stats: stats.reduce((acc, stat) => {
                acc[stat.status] = stat.count;
                return acc;
            }, {})
        });

    } catch (error) {
        console.error('Error fetching incident reports:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลรายงานเหตุการณ์');
    } finally {
        connection.release();
    }
}

// PUT - อัปเดตสถานะรายงาน (อนุมัติ/ปฏิเสธ)
export async function PUT(request) {
    const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT']);
    if (!auth.success) return auth.response;

    const connection = await pool.getConnection();

    try {
        const body = await request.json();
        const { reportId, status, adminNotes } = body;

        // Validate input
        if (!reportId || !status) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['pending', 'reviewing', 'verified', 'resolved', 'rejected'];
        if (!validStatuses.includes(status)) {
            return NextResponse.json(
                { success: false, message: 'สถานะไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        // อัปเดตสถานะ
        await connection.execute(
            `UPDATE public_incident_reports 
            SET status = ?, 
                reviewed_by = ?, 
                reviewed_at = NOW(), 
                admin_notes = ?
            WHERE id = ?`,
            [status, auth.user.id, adminNotes || null, reportId]
        );

        // ดึงข้อมูลที่อัปเดตแล้ว
        const [updatedReport] = await connection.execute(
            `SELECT * FROM public_incident_reports WHERE id = ?`,
            [reportId]
        );

        return NextResponse.json({
            success: true,
            message: 'อัปเดตสถานะสำเร็จ',
            data: updatedReport[0]
        });

    } catch (error) {
        console.error('Error updating incident report:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการอัปเดตรายงานเหตุการณ์');
    } finally {
        connection.release();
    }
}

// DELETE - ลบรายงาน
export async function DELETE(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;

    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const reportId = searchParams.get('id');

        if (!reportId) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID รายงาน' },
                { status: 400 }
            );
        }

        // ลบรายงาน
        await connection.execute(
            'DELETE FROM public_incident_reports WHERE id = ?',
            [reportId]
        );

        return NextResponse.json({
            success: true,
            message: 'ลบรายงานสำเร็จ'
        });

    } catch (error) {
        console.error('Error deleting incident report:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบรายงานเหตุการณ์');
    } finally {
        connection.release();
    }
}
