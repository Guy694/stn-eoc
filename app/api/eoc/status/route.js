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

// GET - ดึงสถานะ EOC ทั้งหมด หรือเฉพาะ type
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('type'); // flood, drought, tsunami, earthquake, disease

        let query = `
            SELECT 
                es.id,
                es.eoc_type,
                es.is_active,
                es.activated_at,
                es.deactivated_at,
                es.description,
                es.created_at,
                es.updated_at,
                ao.username as activated_by_username,
                ao.full_name as activated_by_name,
                do.username as deactivated_by_username,
                do.full_name as deactivated_by_name
            FROM eoc_status es
            LEFT JOIN officer ao ON es.activated_by = ao.id
            LEFT JOIN officer do ON es.deactivated_by = do.id
        `;

        let params = [];

        if (eocType) {
            query += ' WHERE es.eoc_type = ?';
            params.push(eocType);
        }

        query += ' ORDER BY es.eoc_type';

        const [rows] = await connection.execute(query, params);

        return NextResponse.json({
            success: true,
            data: rows
        });

    } catch (error) {
        console.error('Error fetching EOC status:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการดึงข้อมูลสถานะ EOC',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}

// POST - เปิด/ปิด EOC (admin only)
export async function POST(request) {
    const connection = await pool.getConnection();

    try {
        const body = await request.json();
        const { eocType, isActive, userId, description } = body;

        // Validate input
        if (!eocType || isActive === undefined || !userId) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลไม่ครบถ้วน' },
                { status: 400 }
            );
        }

        // Validate eocType
        const validTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
        if (!validTypes.includes(eocType)) {
            return NextResponse.json(
                { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        await connection.beginTransaction();

        if (isActive) {
            // เปิด EOC - สร้าง session ใหม่

            // หา session_number ล่าสุด
            const [lastSession] = await connection.execute(
                `SELECT COALESCE(MAX(session_number), 0) as last_number 
                 FROM eoc_sessions 
                 WHERE eoc_type = ?`,
                [eocType]
            );
            const newSessionNumber = lastSession[0].last_number + 1;

            // สร้าง session ใหม่
            const [sessionResult] = await connection.execute(
                `INSERT INTO eoc_sessions 
                (eoc_type, session_number, opened_at, opened_by, open_reason, status) 
                VALUES (?, ?, NOW(), ?, ?, 'active')`,
                [eocType, newSessionNumber, userId, description || '']
            );
            const sessionId = sessionResult.insertId;

            // อัพเดทสถานะ EOC
            await connection.execute(
                `UPDATE eoc_status 
                 SET is_active = ?, 
                     activated_at = NOW(), 
                     activated_by = ?,
                     description = ?
                 WHERE eoc_type = ?`,
                [true, userId, description || null, eocType]
            );

            // บันทึก log พร้อม session_id
            await connection.execute(
                `INSERT INTO activity_logs 
                (user_id, action_type, target_type, target_id, eoc_session_id, description) 
                VALUES (?, ?, ?, ?, ?, ?)`,
                [
                    userId,
                    'eoc_activate',
                    'eoc_status',
                    eocType,
                    sessionId,
                    `เปิด EOC ${eocType} ครั้งที่ ${newSessionNumber}: ${description || ''}`
                ]
            );

        } else {
            // ปิด EOC - อัพเดท session ที่เปิดอยู่

            // หา active session
            const [activeSessions] = await connection.execute(
                `SELECT id, opened_at FROM eoc_sessions 
                 WHERE eoc_type = ? AND status = 'active'
                 LIMIT 1`,
                [eocType]
            );

            if (activeSessions.length > 0) {
                const sessionId = activeSessions[0].id;
                const openedAt = activeSessions[0].opened_at;

                // คำนวณระยะเวลา (ชั่วโมง)
                const durationQuery = `
                    UPDATE eoc_sessions 
                    SET closed_at = NOW(),
                        closed_by = ?,
                        close_reason = ?,
                        duration_hours = TIMESTAMPDIFF(MINUTE, ?, NOW()) / 60,
                        status = 'closed'
                    WHERE id = ?
                `;

                await connection.execute(durationQuery, [
                    userId,
                    description || '',
                    openedAt,
                    sessionId
                ]);

                // นับจำนวน activities ในช่วง session นี้
                const [activityCount] = await connection.execute(
                    `SELECT COUNT(*) as total FROM activity_logs WHERE eoc_session_id = ?`,
                    [sessionId]
                );

                // อัพเดท total_activities
                await connection.execute(
                    `UPDATE eoc_sessions SET total_activities = ? WHERE id = ?`,
                    [activityCount[0].total, sessionId]
                );

                // บันทึก log พร้อม session_id
                await connection.execute(
                    `INSERT INTO activity_logs 
                    (user_id, action_type, target_type, target_id, eoc_session_id, description) 
                    VALUES (?, ?, ?, ?, ?, ?)`,
                    [
                        userId,
                        'eoc_deactivate',
                        'eoc_status',
                        eocType,
                        sessionId,
                        `ปิด EOC ${eocType}: ${description || ''}`
                    ]
                );
            }

            // อัพเดทสถานะ EOC
            await connection.execute(
                `UPDATE eoc_status 
                 SET is_active = ?, 
                     deactivated_at = NOW(), 
                     deactivated_by = ?,
                     description = ?
                 WHERE eoc_type = ?`,
                [false, userId, description || null, eocType]
            );
        }

        await connection.commit();

        return NextResponse.json({
            success: true,
            message: `${isActive ? 'เปิด' : 'ปิด'} EOC ${eocType} สำเร็จ`
        });

    } catch (error) {
        await connection.rollback();
        console.error('Error updating EOC status:', error);
        return NextResponse.json(
            {
                success: false,
                message: 'เกิดข้อผิดพลาดในการอัพเดทสถานะ EOC',
                error: error.message
            },
            { status: 500 }
        );
    } finally {
        connection.release();
    }
}
