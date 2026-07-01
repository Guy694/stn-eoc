import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";

// GET - ดึงข้อมูล EOC Types ทั้งหมด
export async function GET(req) {
    try {
        const auth = await requireAuth(req, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(req.url);
        const activeOnly = searchParams.get('active') === 'true';

        let queryStr = `
            SELECT 
                id,
                eoc_type,
                name_th,
                name_en,
                icon,
                color_primary,
                color_gradient,
                description,
                is_active,
                sort_order,
                created_at,
                updated_at
            FROM eoc_status
        `;

        if (activeOnly) {
            queryStr += ` WHERE is_active = 1`;
        }

        queryStr += ` ORDER BY sort_order ASC, eoc_type ASC`;

        const rows = await query(queryStr);

        if (!Array.isArray(rows)) {
            console.error("EOC Types query error - rows is not array:", rows);
            return NextResponse.json({
                success: false,
                error: "Invalid data format from database"
            }, { status: 500 });
        }

        // แปลง eoc_type เป็น id สำหรับ compatibility
        const formattedRows = rows.map(row => ({
            ...row,
            id: row.eoc_type
        }));

        return NextResponse.json({
            success: true,
            data: formattedRows
        });
    } catch (error) {
        console.error("Error fetching EOC types:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูล EOC Types");
    }
}

// POST - เพิ่ม EOC Type ใหม่
export async function POST(req) {
    try {
        const auth = await requireAuth(req, ['admin']);
        if (!auth.success) return auth.response;

        const body = await req.json();
        const {
            id,
            name_th,
            name_en,
            icon = '⚠️',
            color_primary = 'gray',
            color_gradient = 'from-gray-500 to-gray-600',
            description = '',
            is_active = 1,
            sort_order = 0
        } = body;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!id || !name_th || !name_en) {
            return NextResponse.json(
                { success: false, error: "กรุณากรอกข้อมูลที่จำเป็น (id, name_th, name_en)" },
                { status: 400 }
            );
        }

        // ตรวจสอบว่า id ซ้ำหรือไม่
        const checkRows = await query(
            `SELECT id FROM eoc_status WHERE eoc_type = ?`,
            [id]
        );

        if (Array.isArray(checkRows) && checkRows.length > 0) {
            return NextResponse.json(
                { success: false, error: "รหัส EOC Type นี้มีอยู่ในระบบแล้ว" },
                { status: 400 }
            );
        }

        // เพิ่มข้อมูล
        await query(
            `INSERT INTO eoc_status 
            (eoc_type, name_th, name_en, icon, color_primary, color_gradient, description, is_active, sort_order) 
            VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`,
            [id, name_th, name_en, icon, color_primary, color_gradient, description, sort_order]
        );

        return NextResponse.json({
            success: true,
            message: "เพิ่ม EOC Type สำเร็จ",
            data: { id, name_th, name_en, icon, color_primary, color_gradient }
        });
    } catch (error) {
        console.error("Error creating EOC type:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการเพิ่ม EOC Type");
    }
}

// PUT - แก้ไข EOC Type
export async function PUT(req) {
    try {
        const auth = await requireAuth(req, ['admin']);
        if (!auth.success) return auth.response;

        const body = await req.json();
        const {
            id,
            name_th,
            name_en,
            icon,
            color_primary,
            color_gradient,
            description,
            is_active,
            sort_order
        } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: "กรุณาระบุ id ของ EOC Type" },
                { status: 400 }
            );
        }

        // ตรวจสอบว่ามี EOC Type นี้อยู่หรือไม่
        const checkRows = await query(
            `SELECT id FROM eoc_status WHERE eoc_type = ?`,
            [id]
        );

        if (!Array.isArray(checkRows) || checkRows.length === 0) {
            return NextResponse.json(
                { success: false, error: "ไม่พบ EOC Type นี้ในระบบ" },
                { status: 404 }
            );
        }

        // สร้าง query แบบ dynamic สำหรับ update เฉพาะฟิลด์ที่ส่งมา
        const updates = [];
        const values = [];

        if (name_th !== undefined) { updates.push('name_th = ?'); values.push(name_th); }
        if (name_en !== undefined) { updates.push('name_en = ?'); values.push(name_en); }
        if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
        if (color_primary !== undefined) { updates.push('color_primary = ?'); values.push(color_primary); }
        if (color_gradient !== undefined) { updates.push('color_gradient = ?'); values.push(color_gradient); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
        if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: "ไม่มีข้อมูลที่จะอัพเดท" },
                { status: 400 }
            );
        }

        values.push(id); // เพิ่ม id สำหรับ WHERE clause

        await query(
            `UPDATE eoc_status SET ${updates.join(', ')} WHERE eoc_type = ?`,
            values
        );

        return NextResponse.json({
            success: true,
            message: "แก้ไข EOC Type สำเร็จ"
        });
    } catch (error) {
        console.error("Error updating EOC type:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการแก้ไข EOC Type");
    }
}

// DELETE - ลบ EOC Type
export async function DELETE(req) {
    try {
        const auth = await requireAuth(req, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: "กรุณาระบุ id ของ EOC Type" },
                { status: 400 }
            );
        }

        // ตรวจสอบว่ามีการใช้งาน EOC Type นี้ใน eoc_sessions หรือไม่
        const checkUsageRows = await query(
            `SELECT COUNT(*) as count FROM eoc_sessions WHERE eoc_type = ?`,
            [id]
        );
        const usageCount = Array.isArray(checkUsageRows) && checkUsageRows.length > 0
            ? checkUsageRows[0].count
            : 0;

        if (usageCount > 0) {
            return NextResponse.json(
                {
                    success: false,
                    error: `ไม่สามารถลบได้ เนื่องจากมี EOC Sessions ที่เชื่อมโยงกับ EOC Type นี้อยู่ ${usageCount} รายการ`,
                    canDelete: false,
                    usageCount: usageCount
                },
                { status: 400 }
            );
        }

        // ลบ EOC Type
        await query(
            `DELETE FROM eoc_status WHERE eoc_type = ?`,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "ลบ EOC Type สำเร็จ"
        });
    } catch (error) {
        console.error("Error deleting EOC type:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการลบ EOC Type");
    }
}
