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

async function validateFloodSessionDate(connection, sessionId, floodStartDate) {
    if (!sessionId) {
        return { ok: false, status: 400, error: 'กรุณาระบุ EOC Session' };
    }

    const [sessions] = await connection.execute(
        `SELECT id, opened_at, closed_at, status
         FROM eoc_sessions
         WHERE id = ? AND eoc_type = 'flood'
         LIMIT 1`,
        [sessionId]
    );

    if (sessions.length === 0) {
        return { ok: false, status: 404, error: 'ไม่พบ EOC Session อุทกภัยน้ำท่วม' };
    }

    const dateKey = toDateKey(floodStartDate);
    if (!dateKey) {
        return { ok: false, status: 400, error: 'กรุณาระบุวันที่เริ่มอุทกภัยน้ำท่วม' };
    }

    const openedKey = toDateKey(sessions[0].opened_at);
    const closedKey = toDateKey(sessions[0].closed_at) || toDateKey(new Date());

    if (openedKey && dateKey < openedKey) {
        return { ok: false, status: 400, error: 'วันที่บันทึกต้องไม่ก่อนวันเปิด EOC' };
    }

    if (closedKey && dateKey > closedKey) {
        return { ok: false, status: 400, error: 'วันที่บันทึกต้องไม่เกินวันปิด EOC' };
    }

    return { ok: true, session: sessions[0] };
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

        const connection = await mysql.createConnection(dbConfig);

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
        await connection.end();

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
        const connection = await mysql.createConnection(dbConfig);
        const validation = await validateFloodSessionDate(connection, data.session_id, data.flood_start_date);
        if (!validation.ok) {
            await connection.end();
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
        await connection.end();

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
        const connection = await mysql.createConnection(dbConfig);
        const validation = await validateFloodSessionDate(connection, data.session_id, data.flood_start_date);
        if (!validation.ok) {
            await connection.end();
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
        await connection.end();

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

        const connection = await mysql.createConnection(dbConfig);
        const [result] = await connection.execute('DELETE FROM flood_records WHERE id = ?', [id]);
        await connection.end();

        return NextResponse.json({
            success: true,
            data: { affectedRows: result.affectedRows }
        });
    } catch (error) {
        console.error('Error deleting flood record:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบข้อมูลอุทกภัยน้ำท่วม');
    }
}
