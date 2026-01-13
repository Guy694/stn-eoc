import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

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

// GET - ดึงรายการจุดบริการชั่วคราว
export async function GET(request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const activeOnly = searchParams.get('active_only') !== 'false';

        connection = await pool.getConnection();

        let query = 'SELECT * FROM temporary_service_points WHERE 1=1';
        const params = [];

        if (sessionId) {
            query += ' AND session_id = ?';
            params.push(sessionId);
        }
        if (activeOnly) {
            query += ' AND is_active = 1';
        }

        query += ' ORDER BY name';

        const [rows] = await connection.execute(query, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching service points:', error);
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// POST - สร้างจุดบริการใหม่
export async function POST(request) {
    let connection;
    try {
        const body = await request.json();
        const {
            session_id,
            name,
            point_type,
            lat,
            lng,
            district,
            tambon,
            address,
            officer_count,
            vehicle_count,
            start_date,
            end_date,
            operating_hours,
            contact_phone,
            is_active
        } = body;

        if (!session_id || !name) {
            return NextResponse.json({
                success: false,
                message: 'session_id และ name จำเป็นต้องระบุ'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        const [result] = await connection.execute(`
            INSERT INTO temporary_service_points 
            (session_id, name, point_type, lat, lng, district, tambon, address, 
             officer_count, vehicle_count, start_date, end_date, operating_hours, 
             contact_phone, is_active)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            session_id,
            name,
            point_type || 'จุดตรวจ',
            lat || null,
            lng || null,
            district || null,
            tambon || null,
            address || null,
            officer_count || 0,
            vehicle_count || 0,
            start_date || null,
            end_date || null,
            operating_hours || '00:00-24:00',
            contact_phone || null,
            is_active !== false ? 1 : 0
        ]);

        return NextResponse.json({
            success: true,
            message: 'เพิ่มจุดบริการสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Error creating service point:', error);
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// PUT - แก้ไขจุดบริการ
export async function PUT(request) {
    let connection;
    try {
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

        Object.entries(body).forEach(([key, value]) => {
            if (key !== 'id' && value !== undefined) {
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
            `UPDATE temporary_service_points SET ${fields.join(', ')} WHERE id = ?`,
            values
        );

        return NextResponse.json({
            success: true,
            message: 'แก้ไขจุดบริการสำเร็จ'
        });
    } catch (error) {
        console.error('Error updating service point:', error);
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// DELETE - ลบจุดบริการ
export async function DELETE(request) {
    let connection;
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                message: 'ต้องระบุ id'
            }, { status: 400 });
        }

        connection = await pool.getConnection();
        await connection.execute('DELETE FROM temporary_service_points WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบจุดบริการสำเร็จ'
        });
    } catch (error) {
        console.error('Error deleting service point:', error);
        return NextResponse.json({
            success: false,
            message: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
