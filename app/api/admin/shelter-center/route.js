import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

// GET - Fetch all shelter centers
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const eocType = searchParams.get('eoc_type');

        let query = `SELECT * FROM shelter_centers`;
        let params = [];

        if (eocType) {
            query += ` WHERE eoc_type = ?`;
            params.push(eocType);
        }

        query += ` ORDER BY eoc_type, id DESC`;

        const pool = await getConnection();
        const [rows] = await pool.query(query, params);

        return NextResponse.json({
            success: true,
            data: Array.isArray(rows) ? rows : []
        });
    } catch (error) {
        console.error('Get shelter centers error:', error);

        // Return empty array instead of error to prevent frontend crashes
        return NextResponse.json({
            success: false,
            message: error.message.includes('Table')
                ? 'ยังไม่ได้สร้างตารางในฐานข้อมูล กรุณารัน SQL ก่อน'
                : 'เกิดข้อผิดพลาดในการดึงข้อมูล',
            error: error.message,
            data: []
        });
    }
}

// POST - Create new shelter center
export async function POST(request) {
    try {
        const body = await request.json();
        const {
            sheltername,
            eoc_type,
            lat,
            lon,
            address,
            tambon,
            district_name,
            village,
            is_active,
            shelter_capacity
        } = body;

        // Validation
        if (!sheltername || !eoc_type || !tambon || !lat || !lon || !shelter_capacity) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึงประเภท EOC)' },
                { status: 400 }
            );
        }

        // Validate EOC type
        const validEocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
        if (!validEocTypes.includes(eoc_type)) {
            return NextResponse.json(
                { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        console.log('Inserting shelter center:', { sheltername, eoc_type, lat, lon, tambon, shelter_capacity });

        const pool = await getConnection();
        const [result] = await pool.query(
            `INSERT INTO shelter_centers 
            (sheltername, eoc_type, lat, lon, address, tambon, district_name, village, is_active, shelter_capacity) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                sheltername,
                eoc_type,
                lat,
                lon,
                address || null,
                tambon,
                district_name || null,
                village || null,
                is_active !== undefined ? is_active : 1,
                shelter_capacity
            ]
        );

        console.log('Insert successful, ID:', result.insertId);

        return NextResponse.json({
            success: true,
            message: 'เพิ่มข้อมูลสำเร็จ',
            id: result.insertId
        });
    } catch (error) {
        console.error('Create shelter center error:', error);

        let errorMessage = 'เกิดข้อผิดพลาดในการบันทึกข้อมูล';
        if (error.message.includes("Table 'shelter_centers' doesn't exist")) {
            errorMessage = 'ยังไม่ได้สร้างตาราง shelter_centers ในฐานข้อมูล กรุณารัน SQL ก่อน';
        } else if (error.code === 'ER_BAD_NULL_ERROR') {
            errorMessage = 'ข้อมูลที่จำเป็นไม่ครบถ้วน';
        }

        return NextResponse.json(
            { success: false, message: errorMessage, error: error.message },
            { status: 500 }
        );
    }
}

// PUT - Update shelter center
export async function PUT(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        const body = await request.json();
        const {
            sheltername,
            eoc_type,
            lat,
            lon,
            address,
            tambon,
            district_name,
            village,
            is_active,
            shelter_capacity
        } = body;

        // Validation
        if (!sheltername || !eoc_type || !tambon || !lat || !lon || !shelter_capacity) {
            return NextResponse.json(
                { success: false, message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน (รวมถึงประเภท EOC)' },
                { status: 400 }
            );
        }

        // Validate EOC type
        const validEocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
        if (!validEocTypes.includes(eoc_type)) {
            return NextResponse.json(
                { success: false, message: 'ประเภท EOC ไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        console.log('Updating shelter center:', id, { sheltername, eoc_type, lat, lon, tambon, shelter_capacity });

        const pool = await getConnection();
        await pool.query(
            `UPDATE shelter_centers 
            SET sheltername = ?, eoc_type = ?, lat = ?, lon = ?, address = ?, 
                tambon = ?, district_name = ?, village = ?, is_active = ?, shelter_capacity = ?
            WHERE id = ?`,
            [
                sheltername,
                eoc_type,
                lat,
                lon,
                address || null,
                tambon,
                district_name || null,
                village || null,
                is_active !== undefined ? is_active : 1,
                shelter_capacity,
                id
            ]
        );

        console.log('Update successful for ID:', id);

        return NextResponse.json({
            success: true,
            message: 'แก้ไขข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Update shelter center error:', error);

        let errorMessage = 'เกิดข้อผิดพลาดในการแก้ไขข้อมูล';
        if (error.message.includes("Table 'shelter_centers' doesn't exist")) {
            errorMessage = 'ยังไม่ได้สร้างตาราง shelter_centers ในฐานข้อมูล กรุณารัน SQL ก่อน';
        }

        return NextResponse.json(
            { success: false, message: errorMessage, error: error.message },
            { status: 500 }
        );
    }
}

// DELETE - Delete shelter center
export async function DELETE(request) {
    try {
        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        const pool = await getConnection();
        await pool.query('DELETE FROM shelter_centers WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'ลบข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Delete shelter center error:', error);
        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล', error: error.message },
            { status: 500 }
        );
    }
}
