import { NextResponse } from "next/server";
import mysql from "mysql2/promise";

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
                disaster_type,
                description,
                latitude,
                longitude,
                description,
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
            [...params, limit, offset]
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
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูล',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// PUT - อัปเดตสถานะรายงาน (อนุมัติ/ปฏิเสธ)
export async function PUT(request) {
    const connection = await pool.getConnection();

    try {
        const body = await request.json();
        const { reportId, status, reviewNotes, reviewedBy } = body;

        // Validate input
        if (!reportId || !status || !reviewedBy) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        // Validate status
        const validStatuses = ['pending', 'approved', 'rejected'];
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
            [status, reviewedBy, admin_notes || null, reportId]
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
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัปเดตข้อมูล',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// DELETE - ลบรายงาน
export async function DELETE(request) {
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
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการลบข้อมูล',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
