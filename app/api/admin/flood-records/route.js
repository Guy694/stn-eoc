import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

const dbConfig = {
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'eoc_satun',
};

export async function GET(request) {
    try {
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
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

export async function POST(request) {
    try {
        const data = await request.json();
        const connection = await mysql.createConnection(dbConfig);

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
            data.created_by || 'Admin'
        ];

        const [result] = await connection.execute(query, params);
        await connection.end();

        return NextResponse.json({
            success: true,
            data: { id: result.insertId }
        });
    } catch (error) {
        console.error('Error creating flood record:', error);
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

export async function PUT(request) {
    try {
        const data = await request.json();
        const connection = await mysql.createConnection(dbConfig);

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
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}

export async function DELETE(request) {
    try {
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
        return NextResponse.json({
            success: false,
            error: error.message
        }, { status: 500 });
    }
}
