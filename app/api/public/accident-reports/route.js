import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { publicInternalError } from '@/lib/apiResponse';

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

const ACCIDENT_TYPES = new Set(['รถยนต์', 'จักรยานยนต์', 'รถจักรยาน', 'คนเดินเท้า', 'อื่นๆ']);

function toNonNegativeInteger(value) {
    const number = Number(value);
    if (!Number.isFinite(number) || number < 0) return 0;
    return Math.floor(number);
}

function buildCitizenNotes({ reporterName, reporterPhone, notes }) {
    const lines = [
        reporterName ? `ผู้แจ้ง: ${reporterName}` : null,
        reporterPhone ? `โทร: ${reporterPhone}` : null,
        notes ? `รายละเอียด: ${notes}` : null
    ].filter(Boolean);

    return lines.join('\n') || null;
}

export async function POST(request) {
    let connection;

    try {
        const body = await request.json();
        const {
            session_id,
            reporter_name,
            reporter_phone,
            report_date,
            report_time,
            accident_type,
            location_name,
            lat,
            lng,
            district,
            tambon,
            deaths,
            injuries,
            drunk_driving,
            no_helmet,
            no_seatbelt,
            speeding,
            notes
        } = body;

        if (!session_id || !report_date || !reporter_name || !reporter_phone || !lat || !lng) {
            return NextResponse.json({
                success: false,
                message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        const [sessions] = await connection.execute(
            `SELECT id FROM eoc_sessions
             WHERE id = ? AND eoc_type = 'festival-accidents' AND status = 'active'
             LIMIT 1`,
            [session_id]
        );

        if (sessions.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่มี EOC Session ที่เปิดอยู่ ไม่สามารถส่งรายงานได้'
            }, { status: 400 });
        }

        const safeAccidentType = ACCIDENT_TYPES.has(accident_type) ? accident_type : 'อื่นๆ';
        const citizenNotes = buildCitizenNotes({
            reporterName: reporter_name.trim(),
            reporterPhone: reporter_phone.trim(),
            notes: notes?.trim()
        });

        const [result] = await connection.execute(`
            INSERT INTO accident_reports
            (session_id, report_date, report_time, accident_type, location_name, lat, lng,
             district, tambon, deaths, injuries, drunk_driving, no_helmet, no_seatbelt,
             speeding, notes, reported_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)
        `, [
            session_id,
            report_date,
            report_time || null,
            safeAccidentType,
            location_name || null,
            lat,
            lng,
            district || null,
            tambon || null,
            toNonNegativeInteger(deaths),
            toNonNegativeInteger(injuries),
            drunk_driving ? 1 : 0,
            no_helmet ? 1 : 0,
            no_seatbelt ? 1 : 0,
            speeding ? 1 : 0,
            citizenNotes
        ]);

        return NextResponse.json({
            success: true,
            message: 'บันทึกรายงานอุบัติเหตุสำเร็จ',
            id: result.insertId
        });

    } catch (error) {
        console.error('Error creating public accident report:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกรายงานอุบัติเหตุ');
    } finally {
        if (connection) connection.release();
    }
}
