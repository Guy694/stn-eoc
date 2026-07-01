import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { requireAuth } from '@/lib/auth';
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

// GET - ดึงรายการอุบัติเหตุ
export async function GET(request) {
    let connection;
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const date = searchParams.get('date');
        const district = searchParams.get('district');

        connection = await pool.getConnection();

        let query = 'SELECT * FROM accident_reports WHERE 1=1';
        const params = [];

        if (sessionId) {
            query += ' AND session_id = ?';
            params.push(sessionId);
        }
        if (date) {
            query += ' AND report_date = ?';
            params.push(date);
        }
        if (district) {
            query += ' AND district = ?';
            params.push(district);
        }

        query += ' ORDER BY report_date DESC, report_time DESC';

        const [rows] = await connection.execute(query, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching accident reports:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงรายงานอุบัติเหตุ');
    } finally {
        if (connection) connection.release();
    }
}

// POST - สร้างรายงานอุบัติเหตุใหม่
export async function POST(request) {
    let connection;
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const {
            session_id,
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
            notes,
        } = body;

        if (!session_id || !report_date) {
            return NextResponse.json({
                success: false,
                message: 'session_id และ report_date จำเป็นต้องระบุ'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        const [result] = await connection.execute(`
            INSERT INTO accident_reports 
            (session_id, report_date, report_time, accident_type, location_name, lat, lng, 
             district, tambon, deaths, injuries, drunk_driving, no_helmet, no_seatbelt, 
             speeding, notes, reported_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            session_id,
            report_date,
            report_time || null,
            accident_type || 'รถยนต์',
            location_name || null,
            lat || null,
            lng || null,
            district || null,
            tambon || null,
            deaths || 0,
            injuries || 0,
            drunk_driving ? 1 : 0,
            no_helmet ? 1 : 0,
            no_seatbelt ? 1 : 0,
            speeding ? 1 : 0,
            notes || null,
            auth.user.id
        ]);

        return NextResponse.json({
            success: true,
            message: 'บันทึกรายงานอุบัติเหตุสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating accident report:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกรายงานอุบัติเหตุ');
    } finally {
        if (connection) connection.release();
    }
}

// PUT - แก้ไขรายงานอุบัติเหตุ
export async function PUT(request) {
    let connection;
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        const body = await request.json();

        if (!id) {
            return NextResponse.json({
                success: false,
                message: 'ต้องระบุ id'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        const fields = [];
        const values = [];

        const allowedFields = new Set([
            'session_id',
            'report_date',
            'report_time',
            'accident_type',
            'location_name',
            'lat',
            'lng',
            'district',
            'tambon',
            'deaths',
            'injuries',
            'drunk_driving',
            'no_helmet',
            'no_seatbelt',
            'speeding',
            'notes'
        ]);

        Object.entries(body).forEach(([key, value]) => {
            if (allowedFields.has(key) && value !== undefined) {
                fields.push(`${key} = ?`);
                values.push(value);
            }
        });

        if (fields.length === 0) {
            return NextResponse.json({
                success: false,
                message: 'ไม่มีข้อมูลที่ต้องอัพเดท'
            }, { status: 400 });
        }

        values.push(id);
        await connection.execute(
            `UPDATE accident_reports SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return NextResponse.json({
            success: true,
            message: 'แก้ไขรายงานอุบัติเหตุสำเร็จ'
        });
    } catch (error) {
        console.error('Error updating accident report:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขรายงานอุบัติเหตุ');
    } finally {
        if (connection) connection.release();
    }
}

// DELETE - ลบรายงานอุบัติเหตุ
export async function DELETE(request) {
    let connection;
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                message: 'ต้องระบุ id'
            }, { status: 400 });
        }

        connection = await pool.getConnection();
        await connection.execute('DELETE FROM accident_reports WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบรายงานอุบัติเหตุสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting accident report:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบรายงานอุบัติเหตุ');
    } finally {
        if (connection) connection.release();
    }
}
