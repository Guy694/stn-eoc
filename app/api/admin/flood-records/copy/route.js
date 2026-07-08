import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
};

function toDateKey(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

async function validateSessionDateRange(connection, sessionId, dates) {
    const [sessions] = await connection.execute(
        `SELECT opened_at, closed_at
         FROM eoc_sessions
         WHERE id = ? AND eoc_type = 'flood'
         LIMIT 1`,
        [sessionId]
    );

    if (sessions.length === 0) {
        return { ok: false, status: 404, error: 'ไม่พบ EOC Session อุทกภัยน้ำท่วม' };
    }

    const openedKey = toDateKey(sessions[0].opened_at);
    const closedKey = toDateKey(sessions[0].closed_at) || toDateKey(new Date());

    for (const date of dates) {
        const dateKey = toDateKey(date);
        if (!dateKey) return { ok: false, status: 400, error: 'วันที่ไม่ถูกต้อง' };
        if (openedKey && dateKey < openedKey) {
            return { ok: false, status: 400, error: 'วันที่ต้องไม่ก่อนวันเปิด EOC' };
        }
        if (closedKey && dateKey > closedKey) {
            return { ok: false, status: 400, error: 'วันที่ต้องไม่เกินวันปิด EOC' };
        }
    }

    return { ok: true };
}

// API สำหรับคัดลอกข้อมูลอุทกภัยน้ำท่วมจากวันหนึ่งไปยังอีกวันหนึ่ง
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        const { session_id, source_date, target_date, overwrite = false, district, tambon } = data;

        // ตรวจสอบ parameters ที่จำเป็น
        if (!session_id || !source_date || !target_date) {
            return NextResponse.json({
                success: false,
                error: 'กรุณาระบุ session_id, source_date และ target_date'
            }, { status: 400 });
        }

        // ตรวจสอบว่า source_date และ target_date ไม่เหมือนกัน
        if (source_date === target_date) {
            return NextResponse.json({
                success: false,
                error: 'วันที่ต้นทางและวันที่ปลายทางต้องไม่เหมือนกัน'
            }, { status: 400 });
        }

        const connection = await mysql.createConnection(dbConfig);
        const validation = await validateSessionDateRange(connection, session_id, [source_date, target_date]);
        if (!validation.ok) {
            await connection.end();
            return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
        }

        // 1. Query ข้อมูลจาก source_date
        let sourceQuery = `
            SELECT 
                f.*,
                v.villname,
                v.villcode,
                v.distname,
                v.subdistnam
            FROM flood_records f
            LEFT JOIN satun_village_polygon v ON f.polygon_id = v.id
            WHERE f.session_id = ? 
            AND DATE(f.flood_start_date) = ?
        `;
        const sourceParams = [session_id, source_date];

        // เพิ่มตัวกรองอำเภอ/ตำบลถ้ามี
        if (district) {
            sourceQuery += ' AND f.district = ?';
            sourceParams.push(district);
        }
        if (tambon) {
            sourceQuery += ' AND f.tambon = ?';
            sourceParams.push(tambon);
        }

        const [sourceRecords] = await connection.execute(sourceQuery, sourceParams);

        if (sourceRecords.length === 0) {
            await connection.end();
            return NextResponse.json({
                success: false,
                error: `ไม่พบข้อมูลในวันที่ ${source_date}`
            }, { status: 404 });
        }

        let copiedCount = 0;
        let skippedCount = 0;
        let overwrittenCount = 0;

        // 2. คัดลอกข้อมูลทีละรายการ
        for (const record of sourceRecords) {
            // ตรวจสอบว่ามีข้อมูลในวันที่ target_date แล้วหรือยัง
            const checkQuery = `
                SELECT id FROM flood_records
                WHERE session_id = ?
                AND DATE(flood_start_date) = ?
                AND district = ?
                AND tambon = ?
                AND village = ?
                LIMIT 1
            `;
            const [existing] = await connection.execute(checkQuery, [
                session_id,
                target_date,
                record.district,
                record.tambon,
                record.village
            ]);

            if (existing.length > 0) {
                if (overwrite) {
                    // ลบข้อมูลเดิม
                    await connection.execute(
                        'DELETE FROM flood_records WHERE id = ?',
                        [existing[0].id]
                    );
                    overwrittenCount++;
                } else {
                    // ข้ามรายการนี้
                    skippedCount++;
                    continue;
                }
            }

            // Insert ข้อมูลใหม่
            const insertQuery = `
                INSERT INTO flood_records 
                (session_id, year, polygon_id, province, district, tambon, village, 
                 flood_level, flood_start_date, water_depth_cm, affected_area_sqm,
                 affected_households, affected_people, description, damage_amount, 
                 relief_amount, status, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const insertParams = [
                session_id,
                record.year,
                record.polygon_id,
                record.province || 'สตูล',
                record.district,
                record.tambon,
                record.village,
                record.flood_level,
                target_date, // ใช้วันที่ใหม่
                record.water_depth_cm,
                record.affected_area_sqm,
                record.affected_households,
                record.affected_people,
                record.description,
                record.damage_amount,
                record.relief_amount,
                record.status,
                auth.user.username
            ];

            await connection.execute(insertQuery, insertParams);
            copiedCount++;
        }

        await connection.end();

        return NextResponse.json({
            success: true,
            data: {
                total: sourceRecords.length,
                copied: copiedCount,
                skipped: skippedCount,
                overwritten: overwrittenCount,
                source_date,
                target_date
            },
            message: `คัดลอกข้อมูลสำเร็จ ${copiedCount} รายการ` +
                (skippedCount > 0 ? ` (ข้าม ${skippedCount} รายการที่มีข้อมูลแล้ว)` : '') +
                (overwrittenCount > 0 ? ` (ทับ ${overwrittenCount} รายการ)` : '')
        });

    } catch (error) {
        console.error('Error copying flood records:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการคัดลอกข้อมูลอุทกภัยน้ำท่วม');
    }
}
