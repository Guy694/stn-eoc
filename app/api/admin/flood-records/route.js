import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { validateSessionDates } from '@/lib/sessionDateRange';
import { ArchiveError, handleArchiveDelete } from '@/lib/recordArchive';
import { getModuleAccess, requireModuleEdit } from '@/lib/eocModuleAccess';

const INSERT_SQL = `
    INSERT INTO flood_records 
    (session_id, year, polygon_id, province, district, tambon, village, flood_level, 
     flood_start_date, water_depth_cm, affected_area_sqm,
     affected_households, affected_people, description, damage_amount, 
     relief_amount, status, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const MAX_BULK = 60;

async function insertBulk(pool, data, user) {
    const rows = data.records.slice(0, MAX_BULK).filter((row) => row && row.village);
    if (!rows.length) {
        return NextResponse.json({ success: false, message: 'ไม่พบหมู่บ้านที่จะบันทึก' }, { status: 400 });
    }
    const connection = await pool.getConnection();
    let inserted = 0;
    const skipped = [];
    try {
        await connection.beginTransaction();
        for (const row of rows) {
            const [existing] = await connection.execute(
                `SELECT id FROM flood_records
                 WHERE session_id = ? AND flood_start_date = ? AND district = ? AND tambon = ? AND village = ?
                 LIMIT 1`,
                [data.session_id, data.flood_start_date, data.district, data.tambon, row.village]
            );
            if (existing.length) {
                skipped.push(row.village);
                continue;
            }
            await connection.execute(INSERT_SQL, [
                data.session_id, data.year, row.polygon_id || null, data.province || 'สตูล', data.district, data.tambon, row.village,
                data.flood_level || 'ไม่มี', data.flood_start_date, data.water_depth_cm || null, data.affected_area_sqm || null,
                Number(row.affected_households ?? data.affected_households) || 0, Number(row.affected_people ?? data.affected_people) || 0,
                data.description || null, 0, 0, data.status || 'กำลังดำเนินการ', user.username
            ]);
            inserted += 1;
        }
        await connection.commit();
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
    return NextResponse.json({ success: true, data: { inserted, skipped } });
}

async function validateFloodSessionDate(connection, sessionId, floodStartDate) {
    if (!floodStartDate) return { ok: false, status: 400, error: 'กรุณาระบุวันที่เริ่มอุทกภัยน้ำท่วม' };
    return validateSessionDates(connection.execute.bind(connection), sessionId, [floodStartDate], { eocType: 'flood', label: 'EOC อุทกภัยน้ำท่วม' });
}

export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const year = searchParams.get('year');
        const sessionId = searchParams.get('session_id');
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');
        const floodLevel = searchParams.get('flood_level');
        const status = searchParams.get('status');
        const privileged = ['admin', 'commander'].includes(auth.user.role);
        if (!sessionId && !privileged) {
            return NextResponse.json({ success: false, message: 'กรุณาระบุเหตุการณ์ EOC' }, { status: 400 });
        }
        // ทีมเจ้าของเมนู (ค่าเริ่มต้น SAT — ตั้งได้ที่ ตั้งค่าระบบ → สิทธิ์กลุ่มภารกิจ) บันทึกได้ ทีมอื่นในเหตุการณ์ดูได้อย่างเดียว
        let permissions = { can_edit: privileged, read_only_message: null };
        if (sessionId) {
            const access = await getModuleAccess(auth.user, sessionId, 'records');
            if (!access.ok) {
                return NextResponse.json({ success: false, message: access.message }, { status: access.status });
            }
            permissions = access.permissions;
        }

        const connection = getPool();

        let query = `
            SELECT 
                f.*,
                DATE_FORMAT(f.flood_start_date, '%Y-%m-%d') AS flood_start_date,
                v.villname,
                v.villcode,
                v.distname,
                v.subdistnam
            FROM flood_records f
            LEFT JOIN satun_village_polygon v ON f.polygon_id = v.id
            WHERE 1=1
        `;
        const params = [];

        if (sessionId) {
            query += ' AND f.session_id = ?';
            params.push(sessionId);
        } else if (year) {
            query += ' AND f.year = ?';
            params.push(year);
        }

        if (district && district !== 'all') {
            query += ' AND f.district = ?';
            params.push(district);
        }
        if (tambon && tambon !== 'all') {
            query += ' AND f.tambon = ?';
            params.push(tambon);
        }
        if (floodLevel && floodLevel !== 'all') {
            query += ' AND f.flood_level = ?';
            params.push(floodLevel);
        }
        if (status && status !== 'all') {
            query += ' AND f.status = ?';
            params.push(status);
        }

        query += ' ORDER BY f.created_at DESC';

        const [rows] = await connection.execute(query, params);

        return NextResponse.json({
            success: true,
            data: rows,
            permissions
        });
    } catch (error) {
        console.error('Error fetching flood records:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลอุทกภัยน้ำท่วม');
    }
}

export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        const gate = await requireModuleEdit(auth.user, data.session_id, 'records');
        if (gate.response) return gate.response;
        const connection = getPool();
        const validation = await validateFloodSessionDate(connection, data.session_id, data.flood_start_date);
        if (!validation.ok) {
            return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
        }

        // บันทึกทั้งตำบล: ส่ง records หลายหมู่บ้านพร้อมกัน บันทึกใน transaction เดียว และข้ามหมู่บ้านที่มีข้อมูลวันนั้นแล้ว
        if (Array.isArray(data.records)) {
            return insertBulk(connection, data, auth.user);
        }

        const params = [
            data.session_id || null,
            data.year,
            data.polygon_id || null,
            data.province || 'สตูล',
            data.district,
            data.tambon,
            data.village || null,
            data.flood_level || 'ไม่มี',
            data.flood_start_date || null,
            data.water_depth_cm || null,
            data.affected_area_sqm || null,
            data.affected_households || 0,
            data.affected_people || 0,
            data.description || null,
            data.damage_amount || 0,
            data.relief_amount || 0,
            data.status || 'รอดำเนินการ',
            auth.user.username
        ];

        const [result] = await connection.execute(INSERT_SQL, params);

        return NextResponse.json({
            success: true,
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Error creating flood record:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกข้อมูลอุทกภัยน้ำท่วม');
    }
}

export async function PUT(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        if (!data.id) {
            return NextResponse.json({ success: false, message: 'ไม่พบรหัสข้อมูลที่ต้องการแก้ไข' }, { status: 400 });
        }
        const gate = await requireModuleEdit(auth.user, data.session_id, 'records');
        if (gate.response) return gate.response;
        const connection = getPool();
        const validation = await validateFloodSessionDate(connection, data.session_id, data.flood_start_date);
        if (!validation.ok) {
            return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
        }

        const query = `
            UPDATE flood_records SET
                session_id = ?, year = ?, polygon_id = ?, province = ?, district = ?, tambon = ?, 
                village = ?, flood_level = ?, flood_start_date = ?, 
                water_depth_cm = ?, affected_area_sqm = ?, affected_households = ?,
                affected_people = ?, description = ?, damage_amount = ?, 
                relief_amount = ?, status = ?
            WHERE id = ? AND session_id = ?
        `;

        const params = [
            data.session_id || null,
            data.year,
            data.polygon_id || null,
            data.province || 'สตูล',
            data.district,
            data.tambon,
            data.village || null,
            data.flood_level,
            data.flood_start_date || null,
            data.water_depth_cm || null,
            data.affected_area_sqm || null,
            data.affected_households || 0,
            data.affected_people || 0,
            data.description || null,
            data.damage_amount || 0,
            data.relief_amount || 0,
            data.status || 'กำลังดำเนินการ',
            data.id,
            data.session_id
        ];

        const [result] = await connection.execute(query, params);
        if (!result.affectedRows) {
            return NextResponse.json({ success: false, message: 'ไม่พบข้อมูลนี้ในเหตุการณ์ที่เลือก (อาจถูกลบไปแล้ว)' }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            data: { affectedRows: result.affectedRows }
        });
    } catch (error) {
        console.error('Error updating flood record:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขข้อมูลอุทกภัยน้ำท่วม');
    }
}

// DELETE - ย้ายไปถังขยะ (กู้คืนได้) ทีม SAT ของเหตุการณ์ที่ยังเปิดอยู่ลบได้ ต้องระบุเหตุผล
export async function DELETE(request) {
    const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
    if (!auth.success) return auth.response;
    return handleArchiveDelete(request, auth.user, {
        table: 'flood_records',
        beforeDelete: async (row) => {
            const access = await getModuleAccess(auth.user, row.session_id, 'records');
            if (!access.ok) throw new ArchiveError(access.message, access.status);
            if (!access.canEdit) throw new ArchiveError(access.readOnlyMessage, access.reason === 'closed' ? 409 : 403);
        }
    });
}
