import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { validateSessionDates } from '@/lib/sessionDateRange';
import { publicInternalError } from '@/lib/apiResponse';
import { requireModuleEdit } from '@/lib/eocModuleAccess';

function validateSessionDateRange(connection, sessionId, dates) {
    return validateSessionDates(connection.execute.bind(connection), sessionId, dates, { eocType: 'flood', label: 'EOC อุทกภัยน้ำท่วม' });
}

export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT', 'staff']);
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

        // ต้องเป็นทีมเจ้าของเมนูบันทึกพื้นที่น้ำท่วม และเหตุการณ์ยังเปิดอยู่ (เหมือนการบันทึกปกติ)
        const gate = await requireModuleEdit(auth.user, session_id, 'records');
        if (gate.response) return gate.response;

        const connection = getPool();
        const validation = await validateSessionDateRange(connection, session_id, [source_date, target_date]);
        if (!validation.ok) {
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
