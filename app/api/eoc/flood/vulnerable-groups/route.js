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

// GET - ดึงข้อมูลกลุ่มเปราะบาง
export async function GET(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');

        connection = await pool.getConnection();

        let whereClause = '1=1';
        let params = [];

        if (sessionId) {
            whereClause += ' AND session_id = ?';
            params.push(sessionId);
        }

        if (district && district !== 'all') {
            whereClause += ' AND district = ?';
            params.push(district);
        }

        if (tambon && tambon !== 'all') {
            whereClause += ' AND tambon = ?';
            params.push(tambon);
        }

        const [rows] = await connection.execute(`
            SELECT 
                id,
                session_id,
                province,
                district,
                tambon,
                village,
                elderly,
                children,
                disabled,
                bedridden,
                pregnant,
                chronic_illness,
                notes,
                needs,
                created_by,
                created_at,
                updated_at
            FROM vulnerable_groups
            WHERE ${whereClause}
            ORDER BY district, tambon, village
        `, params);

        return NextResponse.json({
            success: true,
            data: rows,
            count: rows.length
        });

    } catch (error) {
        console.error('Error fetching vulnerable groups:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// POST - บันทึกข้อมูลกลุ่มเปราะบาง
export async function POST(request) {
    let connection;

    try {
        const data = await request.json();
        connection = await pool.getConnection();

        // ตรวจสอบว่ามีข้อมูลของหมู่บ้านนี้ใน session นี้แล้วหรือยัง
        const [existing] = await connection.execute(`
            SELECT id FROM vulnerable_groups 
            WHERE session_id = ? AND district = ? AND tambon = ? 
            AND COALESCE(village, '') = COALESCE(?, '')
        `, [
            data.session_id,
            data.district,
            data.tambon,
            data.village || ''
        ]);

        if (existing.length > 0) {
            // ถ้ามีแล้ว ให้ UPDATE
            await connection.execute(`
                UPDATE vulnerable_groups SET
                    elderly = ?,
                    children = ?,
                    disabled = ?,
                    bedridden = ?,
                    pregnant = ?,
                    chronic_illness = ?,
                    notes = ?,
                    needs = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                data.elderly || 0,
                data.children || 0,
                data.disabled || 0,
                data.bedridden || 0,
                data.pregnant || 0,
                data.chronic_illness || 0,
                data.notes || null,
                data.needs || null,
                existing[0].id
            ]);

            return NextResponse.json({
                success: true,
                data: { id: existing[0].id, updated: true }
            });
        } else {
            // ถ้ายังไม่มี ให้ INSERT
            const [result] = await connection.execute(`
                INSERT INTO vulnerable_groups
                (session_id, province, district, tambon, village,
                 elderly, children, disabled, bedridden, pregnant, chronic_illness,
                 notes, needs, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                data.session_id,
                data.province || 'สตูล',
                data.district,
                data.tambon,
                data.village || null,
                data.elderly || 0,
                data.children || 0,
                data.disabled || 0,
                data.bedridden || 0,
                data.pregnant || 0,
                data.chronic_illness || 0,
                data.notes || null,
                data.needs || null,
                data.created_by || 'System'
            ]);

            return NextResponse.json({
                success: true,
                data: { id: result.insertId }
            });
        }
    } catch (error) {
        console.error('Error saving vulnerable group data:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// PUT - แก้ไขข้อมูล
export async function PUT(request) {
    let connection;

    try {
        const data = await request.json();

        if (!data.id) {
            return NextResponse.json({
                success: false,
                error: 'ID is required'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        await connection.execute(`
            UPDATE vulnerable_groups SET
                elderly = ?,
                children = ?,
                disabled = ?,
                bedridden = ?,
                pregnant = ?,
                chronic_illness = ?,
                notes = ?,
                needs = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            data.elderly || 0,
            data.children || 0,
            data.disabled || 0,
            data.bedridden || 0,
            data.pregnant || 0,
            data.chronic_illness || 0,
            data.notes || null,
            data.needs || null,
            data.id
        ]);

        return NextResponse.json({
            success: true,
            data: { id: data.id }
        });

    } catch (error) {
        console.error('Error updating vulnerable group data:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}

// DELETE - ลบข้อมูล
export async function DELETE(request) {
    let connection;

    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json({
                success: false,
                error: 'ID is required'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        const [result] = await connection.execute(
            'DELETE FROM vulnerable_groups WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            data: { affectedRows: result.affectedRows }
        });

    } catch (error) {
        console.error('Error deleting vulnerable group data:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    } finally {
        if (connection) connection.release();
    }
}
