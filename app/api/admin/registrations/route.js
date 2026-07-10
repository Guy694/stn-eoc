import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { requireAuth } from "@/lib/auth";

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

async function hasRegistrationTable(connection) {
    const [rows] = await connection.execute(
        `SELECT COUNT(*) AS count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'registration_requests'`
    );
    return Number(rows[0]?.count || 0) > 0;
}

export async function GET(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;

    let connection;

    try {
        connection = await pool.getConnection();
        const tableExists = await hasRegistrationTable(connection);

        if (!tableExists) {
            return NextResponse.json({
                success: true,
                data: [],
                stats: {
                    pending: 0,
                    verified: 0,
                    approved: 0,
                    rejected: 0,
                    actionable: 0
                }
            });
        }

        const { searchParams } = new URL(request.url);
        const status = searchParams.get('status');
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '10', 10), 1), 50);

        const where = [];
        const params = [];

        if (status) {
            where.push('rr.status = ?');
            params.push(status);
        }

        const whereClause = where.length ? `WHERE ${where.join(' AND ')}` : '';

        const [rows] = await connection.execute(
            `SELECT
                rr.id,
                rr.user_type,
                rr.officer_id,
                rr.title,
                rr.given_name,
                rr.family_name,
                rr.agency,
                rr.username,
                rr.email,
                rr.phone,
                rr.status,
                rr.verified_at,
                rr.created_at,
                o.role,
                o.requested_role,
                o.is_approved,
                o.pid_hash IS NOT NULL AS officer_thaiid_verified
             FROM registration_requests rr
             LEFT JOIN officer o ON o.id = rr.officer_id
             ${whereClause}
             ORDER BY
                FIELD(rr.status, 'verified', 'pending', 'approved', 'rejected'),
                rr.created_at DESC
             LIMIT ?`,
            [...params, String(limit)]
        );

        const [statsRows] = await connection.execute(
            `SELECT status, COUNT(*) AS count
             FROM registration_requests
             GROUP BY status`
        );

        const stats = statsRows.reduce((acc, row) => {
            acc[row.status] = Number(row.count || 0);
            return acc;
        }, {
            pending: 0,
            verified: 0,
            approved: 0,
            rejected: 0
        });

        stats.actionable = Number(stats.pending || 0) + Number(stats.verified || 0);

        return NextResponse.json({
            success: true,
            data: rows,
            stats
        });
    } catch (error) {
        console.error('Admin registrations error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ลงทะเบียนใหม่' },
            { status: 500 }
        );
    } finally {
        if (connection) connection.release();
    }
}
