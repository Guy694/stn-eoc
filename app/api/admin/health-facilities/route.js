import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { FACILITY_STATUS_SELECT, hasFacilityStatusColumns } from '@/lib/healthFacilityDb';
import { facilityOrderSql } from "@/lib/facilityOrder";

// GET - ดึงรายการสถานพยาบาลทั้งหมด
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SEhRT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type');
        const search = searchParams.get('search');
        const withStatus = await hasFacilityStatusColumns();

        let sql = `
            SELECT 
                id, 
                name, 
                typecode, 
                address, 
                district_name, 
                tambon,
                tambon as tambon_name,
                lat, 
                lon
                ${withStatus ? `, ${FACILITY_STATUS_SELECT}` : ''}
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

        sql += ` ORDER BY ${facilityOrderSql()}`;

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
        const { name, typecode, address, district_name, district, tambon, lat, lon, phone } = body;

        // Validate required fields
        if (!name || !typecode) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (name, typecode)' },
                { status: 400 }
            );
        }

        // Insert new facility (ฟอร์มส่ง district; ตารางใช้ district_name, address/tambon ห้ามว่างเป็น NULL)
        const withPhone = await hasFacilityStatusColumns();
        const result = await query(`
            INSERT INTO health_facilities (name, typecode, address, district_name, tambon, lat, lon${withPhone ? ', phone' : ''})
            VALUES (?, ?, ?, ?, ?, ?, ?${withPhone ? ', ?' : ''})
        `, [
            name, typecode, address || '', district_name || district || null, tambon || '', lat || null, lon || null,
            ...(withPhone ? [String(phone || '').trim().slice(0, 80) || null] : [])
        ]);

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
