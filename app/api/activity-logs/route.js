import { NextResponse } from "next/server";
import mysql from "mysql2/promise";
import { publicInternalError } from "@/lib/apiResponse";

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// POST - บันทึก activity log
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const body = await request.json();
        const {
            userId,
            username,
            actionType,
            targetType,
            targetId,
            description,
            ipAddress,
            userAgent,
            metadata
        } = body;

        // Validate input
        if (!actionType) {
            return NextResponse.json(
                { success: false, message: 'กรุณาระบุประเภทการกระทำ' },
                { status: 400 }
            );
        }

        const validActionTypes = [
            'login', 'logout',
            'eoc_activate', 'eoc_deactivate',
            'data_create', 'data_update', 'data_delete',
            'profile_update', 'password_change',
            'officer_create', 'officer_update', 'officer_delete',
            'other'
        ];

        if (!validActionTypes.includes(actionType)) {
            return NextResponse.json(
                { success: false, message: 'ประเภทการกระทำไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        await connection.execute(
            `INSERT INTO activity_logs 
            (user_id, username, action_type, target_type, target_id, description, 
             ip_address, user_agent, metadata) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                userId || null,
                username || null,
                actionType,
                targetType || null,
                targetId || null,
                description || null,
                ipAddress || null,
                userAgent || null,
                metadata ? JSON.stringify(metadata) : null
            ]
        );

        return NextResponse.json({
            success: true,
            message: 'บันทึก log สำเร็จ'
        });

    } catch (error) {
        console.error('Error creating activity log:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึก log');
    } finally {
        connection.release();
    }
}

// GET - ดึง activity logs
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const actionType = searchParams.get('actionType');
        const targetType = searchParams.get('targetType');
        const limit = parseInt(searchParams.get('limit')) || 100;
        const offset = parseInt(searchParams.get('offset')) || 0;

        let query = `
            SELECT 
                al.id,
                al.user_id,
                al.username,
                al.action_type,
                al.target_type,
                al.target_id,
                al.description,
                al.ip_address,
                al.user_agent,
                al.metadata,
                al.created_at,
                o.title,
                o.given_name,
                o.family_name,
                o.role as user_role
            FROM activity_logs al
            LEFT JOIN officer o ON al.user_id = o.id
            WHERE 1=1
        `;

        let params = [];

        if (userId) {
            query += ' AND al.user_id = ?';
            params.push(userId);
        }

        if (actionType) {
            query += ' AND al.action_type = ?';
            params.push(actionType);
        }

        if (targetType) {
            query += ' AND al.target_type = ?';
            params.push(targetType);
        }

        query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
        params.push(limit, offset);

        const [rows] = await connection.execute(query, params);

        // Parse metadata JSON
        const logs = rows.map(row => ({
            ...row,
            metadata: row.metadata ? JSON.parse(row.metadata) : null
        }));

        return NextResponse.json({
            success: true,
            data: logs,
            count: logs.length
        });

    } catch (error) {
        console.error('Error fetching activity logs:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูล logs');
    } finally {
        connection.release();
    }
}
