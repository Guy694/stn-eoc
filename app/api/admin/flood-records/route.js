import { NextResponse } from 'next/server';
import { getPool } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { getSessionTeamAccessByCode } from '@/lib/eocTeamAccess';
import { validateSessionDates } from '@/lib/sessionDateRange';

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
        if (sessionId) {
            const access = await getSessionTeamAccessByCode(auth.user, sessionId, 'sat');
            if (!access.ok) {
                return NextResponse.json({ success: false, message: access.message }, { status: access.status });
            }
        }

        const connection = getPool();

        let query = `
            SELECT 
                f.*,
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
            data: rows
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
        const access = await getSessionTeamAccessByCode(auth.user, data.session_id, 'sat');
        if (!access.ok) {
            return NextResponse.json({ success: false, message: access.message }, { status: access.status });
        }
        if (!access.canOperate) {
            return NextResponse.json({ success: false, message: 'เหตุการณ์นี้ไม่เปิดให้บันทึกข้อมูลปฏิบัติการ' }, { status: 409 });
        }
        const connection = getPool();
        const validation = await validateFloodSessionDate(connection, data.session_id, data.flood_start_date);
        if (!validation.ok) {
            return NextResponse.json({ success: false, error: validation.error }, { status: validation.status });
        }

        const query = `
            INSERT INTO flood_records 
            (session_id, year, polygon_id, province, district, tambon, village, flood_level, 
             flood_start_date, water_depth_cm, affected_area_sqm,
             affected_households, affected_people, description, damage_amount, 
             relief_amount, status, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;

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

        const [result] = await connection.execute(query, params);

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
        const access = await getSessionTeamAccessByCode(auth.user, data.session_id, 'sat');
        if (!access.ok) {
            return NextResponse.json({ success: false, message: access.message }, { status: access.status });
        }
        if (!access.canOperate) {
            return NextResponse.json({ success: false, message: 'เหตุการณ์นี้ไม่เปิดให้แก้ไขข้อมูลปฏิบัติการ' }, { status: 409 });
        }
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
            WHERE id = ?
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
            data.status,
            data.id
        ];

        const [result] = await connection.execute(query, params);

        return NextResponse.json({
            success: true,
            data: { affectedRows: result.affectedRows }
        });
    } catch (error) {
        console.error('Error updating flood record:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขข้อมูลอุทกภัยน้ำท่วม');
    }
}

export async function DELETE(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID is required'
            }, { status: 400 });
        }

        const connection = getPool();
        const [result] = await connection.execute('DELETE FROM flood_records WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            data: { affectedRows: result.affectedRows }
        });
    } catch (error) {
        console.error('Error deleting flood record:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบข้อมูลอุทกภัยน้ำท่วม');
    }
}
