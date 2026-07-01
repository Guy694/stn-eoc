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

async function hasOrderFileColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'eoc_sessions'
           AND COLUMN_NAME IN ('open_order_file_path', 'open_order_file_name')`
    );
    return columns.length === 2;
}

// GET - ดึงประวัติ EOC sessions
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('type'); // flood, drought, tsunami, earthquake, disease
        const status = searchParams.get('status'); // active, closed
        const limit = parseInt(searchParams.get('limit')) || 50;
        const offset = parseInt(searchParams.get('offset')) || 0;
        const hasOrderColumns = await hasOrderFileColumns(connection);
        const orderFileSelect = hasOrderColumns
            ? `s.open_order_file_path,
                s.open_order_file_name,`
            : `NULL as open_order_file_path,
                NULL as open_order_file_name,`;

        let query = `
            SELECT 
                s.id,
                s.eoc_type,
                s.session_number,
                s.opened_at,
                s.closed_at,
                s.open_reason,
                ${orderFileSelect}
                s.close_reason,
                s.duration_hours,
                s.status,
                s.total_activities,
                s.total_data_entries,
                s.affected_areas,
                s.summary,
                s.created_at,
                oo.id as opened_by_id,
                oo.username as opened_by_username,
                oo.title as opened_by_title,
                oo.given_name as opened_by_given_name,
                oo.family_name as opened_by_family_name,
                oo.role as opened_by_role,
                co.id as closed_by_id,
                co.username as closed_by_username,
                co.title as closed_by_title,
                co.given_name as closed_by_given_name,
                co.family_name as closed_by_family_name,
                co.role as closed_by_role
            FROM eoc_sessions s
            LEFT JOIN officer oo ON s.opened_by = oo.id
            LEFT JOIN officer co ON s.closed_by = co.id
        `;

        let conditions = [];
        let params = [];

        if (eocType) {
            conditions.push('s.eoc_type = ?');
            params.push(eocType);
        }

        if (status) {
            conditions.push('s.status = ?');
            params.push(status);
        }

        if (conditions.length > 0) {
            query += ' WHERE ' + conditions.join(' AND ');
        }

        query += ` ORDER BY s.opened_at DESC LIMIT ${limit} OFFSET ${offset}`;

        const [rows] = await connection.execute(query, params);

        // ดึงจำนวนทั้งหมด
        let countQuery = 'SELECT COUNT(*) as total FROM eoc_sessions s';
        let countConditions = [];
        let countParams = [];

        if (eocType) {
            countConditions.push('s.eoc_type = ?');
            countParams.push(eocType);
        }

        if (status) {
            countConditions.push('s.status = ?');
            countParams.push(status);
        }

        if (countConditions.length > 0) {
            countQuery += ' WHERE ' + countConditions.join(' AND ');
        }

        const [countResult] = await connection.execute(countQuery, countParams);

        return NextResponse.json({
            success: true,
            data: rows,
            pagination: {
                total: countResult[0].total,
                limit: limit,
                offset: offset,
                hasMore: offset + rows.length < countResult[0].total
            }
        });

    } catch (error) {
        console.error('Error fetching EOC sessions:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลประวัติ EOC');
    } finally {
        connection.release();
    }
}

// GET session detail with activities
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { sessionId } = body;
        const hasOrderColumns = await hasOrderFileColumns(connection);
        const orderFileSelect = hasOrderColumns
            ? `s.open_order_file_path,
                s.open_order_file_name,`
            : `NULL as open_order_file_path,
                NULL as open_order_file_name,`;

        if (!sessionId) {
            return NextResponse.json(
                { success: false, message: 'กรุณาระบุ session ID' },
                { status: 400 }
            );
        }

        // ดึงข้อมูล session
        const [sessions] = await connection.execute(
            `SELECT 
                s.*,
                ${orderFileSelect}
                oo.username as opened_by_username,
                oo.title as opened_by_title,
                oo.given_name as opened_by_given_name,
                oo.family_name as opened_by_family_name,
                oo.role as opened_by_role,
                co.username as closed_by_username,
                co.title as closed_by_title,
                co.given_name as closed_by_given_name,
                co.family_name as closed_by_family_name,
                co.role as closed_by_role
            FROM eoc_sessions s
            LEFT JOIN officer oo ON s.opened_by = oo.id
            LEFT JOIN officer co ON s.closed_by = co.id
            WHERE s.id = ?`,
            [sessionId]
        );

        if (sessions.length === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ session นี้' },
                { status: 404 }
            );
        }

        const session = sessions[0];

        // ดึง activities ในช่วง session นี้
        const [activities] = await connection.execute(
            `SELECT 
                a.*,
                o.username,
                o.title,
                o.given_name,
                o.family_name,
                o.role
            FROM activity_logs a
            LEFT JOIN officer o ON a.user_id = o.id
            WHERE a.eoc_session_id = ?
            ORDER BY a.created_at DESC`,
            [sessionId]
        );

        // สรุปข้อมูลตามประเภท action
        const [actionSummary] = await connection.execute(
            `SELECT 
                action_type,
                COUNT(*) as count
            FROM activity_logs
            WHERE eoc_session_id = ?
            GROUP BY action_type
            ORDER BY count DESC`,
            [sessionId]
        );

        // สรุปผู้ใช้ที่มีกิจกรรมมากที่สุด
        const [userSummary] = await connection.execute(
            `SELECT 
                o.title,
                o.given_name,
                o.family_name,
                o.username,
                COUNT(*) as activity_count
            FROM activity_logs a
            LEFT JOIN officer o ON a.user_id = o.id
            WHERE a.eoc_session_id = ?
            GROUP BY a.user_id, o.title, o.given_name, o.family_name, o.username
            ORDER BY activity_count DESC
            LIMIT 10`,
            [sessionId]
        );

        return NextResponse.json({
            success: true,
            data: {
                session: session,
                activities: activities,
                summary: {
                    actionTypes: actionSummary,
                    topUsers: userSummary
                }
            }
        });

    } catch (error) {
        console.error('Error fetching session detail:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงรายละเอียด session');
    } finally {
        connection.release();
    }
}
