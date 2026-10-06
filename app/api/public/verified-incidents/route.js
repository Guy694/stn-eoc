import { NextResponse } from 'next/server';
import { publicInternalError } from '@/lib/apiResponse';
import { getPool } from "@/lib/db";
import { getAuthSession } from "@/lib/auth";
import { toPublicIncident } from "@/lib/incidentPublishing";

const pool = getPool();

async function getColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'public_incident_reports'
           AND COLUMN_NAME IN ('session_id', 'publish_status')`
    );
    return new Set(columns.map((column) => column.COLUMN_NAME));
}

// GET - จุดจากประชาชนที่เจ้าหน้าที่ "เผยแพร่" แล้วเท่านั้น (ยืนยันแล้วอย่างเดียวไม่พอ)
// ส่งเฉพาะหัวข้อ/รายละเอียดที่เจ้าหน้าที่เขียน รูปที่เลือก และพิกัดโดยประมาณ — ไม่มีชื่อ เบอร์ ข้อความหรือรูปต้นฉบับ
// คำขอความช่วยเหลือไม่ถูกส่งออกในทุกกรณี
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const disasterType = searchParams.get('disaster_type') || 'flood';
        const sessionId = searchParams.get('session_id');
        const startDate = searchParams.get('start_date');
        const endDate = searchParams.get('end_date');
        const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '500', 10) || 500, 1), 1000);

        connection = await pool.getConnection();
        const columns = await getColumns(connection);

        // ยังไม่ได้ migrate ระบบเผยแพร่: ไม่ส่งอะไรออกไปเลย ดีกว่าเผยแพร่ข้อมูลที่ยังไม่ผ่านการคัดกรอง
        if (!columns.has('publish_status')) {
            return NextResponse.json({ success: true, data: [], count: 0 });
        }

        let whereClause = `r.publish_status = 'published'
            AND r.report_type IN ('traffic_report', 'problem_point')
            AND r.merged_into_id IS NULL
            AND (r.expires_at IS NULL OR r.expires_at > NOW())
            AND r.disaster_type = ?`;
        const params = [disasterType];

        if (sessionId && columns.has('session_id')) {
            whereClause += ' AND r.session_id = ?';
            params.push(sessionId);
        }
        if (startDate) {
            whereClause += ' AND DATE(r.occurred_at) >= ?';
            params.push(startDate);
        }
        if (endDate) {
            whereClause += ' AND DATE(r.occurred_at) <= ?';
            params.push(endDate);
        }

        const [rows] = await connection.execute(`
            SELECT
                r.id, r.village, r.sub_district, r.district, r.latitude, r.longitude,
                r.urgency, r.travel_status, r.report_type, r.problem_category, r.occurred_at, r.disaster_type,
                r.public_title, r.public_detail, r.public_photo_path, r.published_at, r.reviewed_at, r.expires_at,
                1 + (SELECT COUNT(*) FROM public_incident_reports m WHERE m.merged_into_id = r.id) AS report_count
            FROM public_incident_reports r
            WHERE ${whereClause}
            ORDER BY r.published_at DESC
            LIMIT ${limit}
        `, params);

        // เจ้าหน้าที่ที่เข้าสู่ระบบเห็นพิกัดจริงเพื่อใช้ปฏิบัติงาน ประชาชนเห็นพิกัดโดยประมาณ (~100 ม.)
        const viewer = await getAuthSession(request).catch(() => ({ success: false }));
        const data = rows.map((row) => toPublicIncident(row, { exactLocation: viewer.success }));

        return NextResponse.json({
            success: true,
            data,
            count: data.length
        });

    } catch (error) {
        console.error('Error fetching verified incidents:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงรายงานที่ตรวจสอบแล้ว');
    } finally {
        if (connection) connection.release();
    }
}
