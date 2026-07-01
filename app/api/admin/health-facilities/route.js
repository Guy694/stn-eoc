import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - ดึงรายการสถานพยาบาลทั้งหมด
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const search = searchParams.get('search');

        let sql = `
            SELECT 
                id, 
                name, 
                typecode, 
                address, 
                district_name, 
                tambon, 
                lat, 
                lon
               
            FROM health_facilities
            WHERE 1=1
        `;
        const params = [];

        if (type) {
            sql += ' AND typecode = ?';
            params.push(type);
        }

        if (search) {
            sql += ' AND (name LIKE ? OR address LIKE ? OR district_name LIKE ? OR tambon LIKE ?)';
            const searchTerm = `%${search}%`;
            params.push(searchTerm, searchTerm, searchTerm, searchTerm);
        }

        sql += ' ORDER BY name ASC';

        const facilities = await query(sql, params);

        // นับจำนวนตามประเภท
        const typeCounts = await query(`
            SELECT typecode, COUNT(*) as count 
            FROM health_facilities 
            GROUP BY typecode
        `);

        const stats = typeCounts.reduce((acc, item) => {
            acc[item.typecode] = item.count;
            return acc;
        }, {});

        return NextResponse.json({
            success: true,
            data: facilities,
            stats: stats,
            total: facilities.length
        });

    } catch (error) {
        console.error('Error fetching health facilities:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลสถานพยาบาล');
    }
}

// POST - เพิ่มสถานพยาบาลใหม่
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { name, typecode, address, district_name, tambon, lat, lon } = body;

        // Validate required fields
        if (!name || !typecode) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (name, typecode)' },
                { status: 400 }
            );
        }

        // Insert new facility
        const result = await query(`
            INSERT INTO health_facilities (name, typecode, address, district_name, tambon, lat, lon)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [name, typecode, address, district_name, tambon, lat || null, lon || null]);

        // ดึงข้อมูลที่เพิ่งสร้าง
        const newFacility = await query(
            'SELECT * FROM health_facilities WHERE id = ?',
            [result.insertId]
        );

        return NextResponse.json({
            success: true,
            message: 'Health facility created successfully',
            data: newFacility[0]
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating health facility:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการเพิ่มสถานพยาบาล');
    }
}
