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
        const force = searchParams.get('force') === 'true'; // ลบแบบบังคับพร้อมข้อมูลที่เกี่ยวข้อง

        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        const pool = await getConnection();

        let activationsCount = 0;
        let diseaseReportsCount = 0;

        // ตรวจสอบว่ามีการใช้งานศูนย์พักพิงนี้อยู่หรือไม่ (ถ้าตารางมีอยู่)
        try {
            const [activations] = await pool.query(
                'SELECT COUNT(*) as count FROM shelter_activations WHERE shelter_id = ?',
                [id]
            );
            activationsCount = activations[0].count;
        } catch (error) {
            // ถ้าตารางไม่มี ให้ข้ามไป
            if (!error.message.includes("doesn't exist")) {
                throw error; // ถ้าเป็น error อื่นให้ throw ต่อ
            }
        }

        // ตรวจสอบว่ามีข้อมูลโรคระบาดที่เกี่ยวข้องหรือไม่ (ถ้าตารางมีอยู่)
        try {
            const [diseaseReports] = await pool.query(
                'SELECT COUNT(*) as count FROM shelter_disease_reports WHERE shelter_id = ?',
                [id]
            );
            diseaseReportsCount = diseaseReports[0].count;
        } catch (error) {
            // ถ้าตารางไม่มี ให้ข้ามไป
            if (!error.message.includes("doesn't exist")) {
                throw error; // ถ้าเป็น error อื่นให้ throw ต่อ
            }
        }

        const hasRelatedData = activationsCount > 0 || diseaseReportsCount > 0;

        // ถ้ามีข้อมูลที่เกี่ยวข้องและไม่ได้เลือก force delete
        if (hasRelatedData && !force) {
            return NextResponse.json(
                {
                    success: false,
                    needsConfirmation: true,
                    message: `ศูนย์พักพิงนี้มีข้อมูลที่เกี่ยวข้อง:\n- การใช้งาน: ${activationsCount} ครั้ง\n- รายงานโรค: ${diseaseReportsCount} รายการ\n\nต้องการลบพร้อมข้อมูลที่เกี่ยวข้องทั้งหมดหรือไม่?`,
                    relatedData: {
                        activations: activationsCount,
                        diseaseReports: diseaseReportsCount
                    }
                },
                { status: 400 }
            );
        }

        // ถ้าเลือก force delete ให้ลบข้อมูลที่เกี่ยวข้องก่อน
        if (force && hasRelatedData) {
            // ลบรายงานโรคก่อน (ถ้าตารางมีอยู่)
            if (diseaseReportsCount > 0) {
                try {
                    await pool.query('DELETE FROM shelter_disease_reports WHERE shelter_id = ?', [id]);
                } catch (error) {
                    if (!error.message.includes("doesn't exist")) {
                        throw error;
                    }
                }
            }

            // ลบการใช้งาน (ถ้าตารางมีอยู่)
            if (activationsCount > 0) {
                try {
                    await pool.query('DELETE FROM shelter_activations WHERE shelter_id = ?', [id]);
                } catch (error) {
                    if (!error.message.includes("doesn't exist")) {
                        throw error;
                    }
                }
            }
        }

        // ลบศูนย์พักพิง
        const [result] = await pool.query('DELETE FROM shelter_centers WHERE id = ?', [id]);

        if (result.affectedRows === 0) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบข้อมูลที่ต้องการลบ' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: force
                ? 'ลบศูนย์พักพิงและข้อมูลที่เกี่ยวข้องทั้งหมดสำเร็จ'
                : 'ลบข้อมูลสำเร็จ'
        });
    } catch (error) {
        console.error('Delete shelter center error:', error);

        // จัดการ error จาก foreign key constraint
        if (error.code === 'ER_ROW_IS_REFERENCED_2') {
            return NextResponse.json(
                {
                    success: false,
                    message: 'ไม่สามารถลบได้ เนื่องจากศูนย์พักพิงนี้ถูกใช้งานอยู่ในระบบ กรุณาลบข้อมูลที่เกี่ยวข้องก่อน'
                },
                { status: 400 }
            );
        }

        return NextResponse.json(
            { success: false, message: 'เกิดข้อผิดพลาดในการลบข้อมูล: ' + error.message, error: error.message },
            { status: 500 }
        );
    }
}
