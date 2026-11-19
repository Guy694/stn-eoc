import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { requireAuth } from "@/lib/auth";
import { getPool } from "@/lib/db";

const pool = getPool();

// บันทึกประวัติทำที่ฝั่งเซิร์ฟเวอร์เท่านั้น (เดิมมี POST ให้ client เขียนประวัติเอง — ปลอม IP/ประเภทได้ จึงเอาออก)
// GET - ดึง activity logs
export async function GET(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;

    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');
        const actionType = searchParams.get('actionType');
        const targetType = searchParams.get('targetType');
        const sessionId = searchParams.get('sessionId');
        const sessionTeamId = searchParams.get('sessionTeamId');
        const search = searchParams.get('search')?.trim();
        const dateFrom = searchParams.get('dateFrom');
        const dateTo = searchParams.get('dateTo');
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit')) || 25, 1), 100);
        const offset = Math.max(parseInt(searchParams.get('offset')) || 0, 0);

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
                al.old_values,
                al.new_values,
                al.change_reason,
                al.eoc_session_id,
                al.session_team_id,
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

        if (sessionId) {
            const parsedSessionId = Number(sessionId);
            if (!Number.isInteger(parsedSessionId) || parsedSessionId <= 0) {
                return NextResponse.json({ success: false, message: 'sessionId ไม่ถูกต้อง' }, { status: 400 });
            }
            query += ' AND al.eoc_session_id = ?';
            params.push(parsedSessionId);
        }

        if (sessionTeamId) {
            const parsedSessionTeamId = Number(sessionTeamId);
            if (!Number.isInteger(parsedSessionTeamId) || parsedSessionTeamId <= 0) {
                return NextResponse.json({ success: false, message: 'sessionTeamId ไม่ถูกต้อง' }, { status: 400 });
            }
            query += ' AND al.session_team_id = ?';
            params.push(parsedSessionTeamId);
        }

        if (dateFrom) {
            query += ' AND DATE(al.created_at) >= ?';
            params.push(dateFrom);
        }

        if (dateTo) {
            query += ' AND DATE(al.created_at) <= ?';
            params.push(dateTo);
        }

        if (search) {
            query += ' AND (al.username LIKE ? OR al.action_type LIKE ? OR al.target_type LIKE ? OR al.description LIKE ?)';
            const wildcard = `%${search}%`;
            params.push(wildcard, wildcard, wildcard, wildcard);
        }

        const countQuery = query.replace(/SELECT[\s\S]*?FROM activity_logs al/, 'SELECT COUNT(*) AS total FROM activity_logs al');
        const [countRows] = await connection.execute(countQuery, params);

        query += ' ORDER BY al.created_at DESC LIMIT ? OFFSET ?';
        params.push(String(limit), String(offset)); // mysql2 execute: ส่งเป็นสตริง (MySQL 8.0.22+ ไม่รับตัวเลขใน LIMIT ของ prepared statement)

        const [rows] = await connection.execute(query, params);

        // Parse metadata JSON
        const parseJson = (value) => {
            if (!value || typeof value !== 'string') return value || null;
            try { return JSON.parse(value); } catch { return null; }
        };
        const logs = rows.map(row => ({
            ...row,
            metadata: parseJson(row.metadata),
            old_values: parseJson(row.old_values),
            new_values: parseJson(row.new_values)
        }));

        return NextResponse.json({
            success: true,
            data: logs,
            count: logs.length,
            pagination: {
                total: Number(countRows[0]?.total || 0),
                limit,
                offset
            }
        });

    } catch (error) {
        console.error('Error fetching activity logs:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูล logs');
    } finally {
        connection.release();
    }
}
