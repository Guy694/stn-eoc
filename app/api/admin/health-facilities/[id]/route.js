import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - ดึงข้อมูลสถานพยาบาลตาม ID
export async function GET(request, { params }) {
    try {
        const { id } = params;

        const facilities = await query(
            'SELECT * FROM health_facilities WHERE id = ?',
            [id]
        );

        if (facilities.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Health facility not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: facilities[0]
        });

    } catch (error) {
        console.error('Error fetching health facility:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch health facility', details: error.message },
            { status: 500 }
        );
    }
}

// PUT - แก้ไขข้อมูลสถานพยาบาล
export async function PUT(request, { params }) {
    try {
        const { id } = params;
        const body = await request.json();
        const { name, typecode, address, district, tambon, lat, lon, phone } = body;

        // Validate required fields
        if (!name || !typecode) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (name, typecode)' },
                { status: 400 }
            );
        }

        // Update facility
        await query(`
            UPDATE health_facilities 
            SET name = ?, 
                typecode = ?, 
                address = ?, 
                district = ?, 
                tambon = ?, 
                lat = ?, 
                lon = ?, 
                phone = ?
            WHERE id = ?
        `, [name, typecode, address, district, tambon, lat || null, lon || null, phone, id]);

        // ดึงข้อมูลที่อัปเดต
        const updatedFacility = await query(
            'SELECT * FROM health_facilities WHERE id = ?',
            [id]
        );

        if (updatedFacility.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Health facility not found after update' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Health facility updated successfully',
            data: updatedFacility[0]
        });

    } catch (error) {
        console.error('Error updating health facility:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to update health facility', details: error.message },
            { status: 500 }
        );
    }
}

// DELETE - ลบสถานพยาบาล
export async function DELETE(request, { params }) {
    try {
        const { id } = params;

        // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
        const existing = await query(
            'SELECT id FROM health_facilities WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Health facility not found' },
                { status: 404 }
            );
        }

        // ลบข้อมูล
        await query('DELETE FROM health_facilities WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'Health facility deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting health facility:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to delete health facility', details: error.message },
            { status: 500 }
        );
    }
}
