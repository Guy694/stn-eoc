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

// GET - ดึงข้อมูล flood_records ตามวันที่และ session
export async function GET(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const date = searchParams.get('date');
        const sessionId = searchParams.get('session_id');
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');
        const floodLevel = searchParams.get('flood_level');

        connection = await pool.getConnection();

        let whereClause = '1=1';
        let params = [];

        if (sessionId) {
            whereClause += ' AND f.session_id = ?';
            params.push(sessionId);
        }

        if (date) {
            whereClause += ' AND DATE(f.flood_start_date) = ?';
            params.push(date);
        }

        if (district) {
            whereClause += ' AND v.distname = ?';
            params.push(district);
        }

        if (tambon) {
            whereClause += ' AND v.subdistnam = ?';
            params.push(tambon);
        }

        if (floodLevel) {
            // แปลงจากภาษาไทยเป็นอังกฤษ
            const levelMap = {
                'ไม่มี': 'safe',
                'ต่ำ': 'mild',
                'ปานกลาง': 'moderate',
                'สูง': 'severe'
            };
            const englishLevel = levelMap[floodLevel] || floodLevel;
            whereClause += ' AND f.flood_level = ?';
            params.push(englishLevel);
        }

        const [rows] = await connection.execute(`
            SELECT 
                f.*,
                v.villcode,
                v.villname,
                v.distname as district,
                v.subdistnam as tambon
            FROM flood_records f
            INNER JOIN satun_village_polygon v ON f.polygon_id = v.id
            WHERE ${whereClause}
            ORDER BY f.flood_start_date DESC, f.updated_at DESC
        `, params);

        return NextResponse.json({
            success: true,
            data: rows
        });
    } catch (error) {
        console.error('Error fetching flood area status:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลอุทกภัยน้ำท่วมรายวัน');
    } finally {
        if (connection) connection.release();
    }
}

// POST - บันทึกข้อมูลลง flood_records
export async function POST(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        connection = await pool.getConnection();

        // แปลงระดับอุทกภัยน้ำท่วมจากภาษาไทยเป็นภาษาอังกฤษ
        const levelMap = {
            'ไม่มี': 'safe',
            'ต่ำ': 'mild',
            'ปานกลาง': 'moderate',
            'สูง': 'severe',
            'สูงมาก': 'severe'
        };

        const floodLevel = levelMap[data.flood_level] || 'safe';

        // ตรวจสอบว่ามีข้อมูลของหมู่บ้านนี้ในวันนี้แล้วหรือยัง
        const [existing] = await connection.execute(`
            SELECT id FROM flood_records 
            WHERE vid = ? AND session_id = ? AND recorded_day = ?
        `, [data.polygon_id, data.session_id, data.recorded_day]);

        if (existing.length > 0) {
            // ถ้ามีแล้ว ให้ UPDATE
            await connection.execute(`
                UPDATE flood_records SET
                    flood_level = ?,
                    water_level = ?,
                    affected_households = ?,
                    affected_population = ?,
                    notes = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                floodLevel,
                data.water_depth_cm ? (data.water_depth_cm / 100).toFixed(2) : 0,
                data.affected_households || 0,
                data.affected_people || 0,
                data.description || null,
                existing[0].id
            ]);

            return NextResponse.json({
                success: true,
                data: { id: existing[0].id, updated: true }
            });
        } else {
            // ถ้ายังไม่มี ให้ INSERT
            const [result] = await connection.execute(`
                INSERT INTO flood_records
                (vid, session_id, flood_level, water_level, affected_households, 
                 affected_population, recorded_day, notes, status)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'active')
            `, [
                data.polygon_id,
                data.session_id,
                floodLevel,
                data.water_depth_cm ? (data.water_depth_cm / 100).toFixed(2) : 0,
                data.affected_households || 0,
                data.affected_people || 0,
                data.recorded_day,
                data.description || null
            ]);

            return NextResponse.json({
                success: true,
                data: { id: result.insertId }
            });
        }
    } catch (error) {
        console.error('Error saving flood area status:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกข้อมูลอุทกภัยน้ำท่วมรายวัน');
    } finally {
        if (connection) connection.release();
    }
}

// DELETE - ลบข้อมูล
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
                error: 'ID is required'
            }, { status: 400 });
        }

        connection = await pool.getConnection();
        const [result] = await connection.execute(
            'DELETE FROM flood_records WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            data: { affectedRows: result.affectedRows }
        });
    } catch (error) {
        console.error('Error deleting flood area status:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบข้อมูลอุทกภัยน้ำท่วมรายวัน');
    } finally {
        if (connection) connection.release();
    }
}
