import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";

// GET - ดึงข้อมูล EOC Modules ทั้งหมดหรือตาม eoc_type
export async function GET(req) {
    try {
        const auth = await requireAuth(req, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(req.url);
        const eocType = searchParams.get('eoc_type');
        const activeOnly = searchParams.get('active') === 'true';

        let queryStr = `
            SELECT 
                id,
                eoc_type,
                module_code,
                module_name_th,
                module_name_en,
                module_type,
                route_path,
                icon,
                description,
                form_config,
                map_config,
                required_teams,
                is_active,
                sort_order,
                created_at,
                updated_at
            FROM eoc_type_modules
            WHERE 1=1
        `;

        const params = [];

        if (eocType) {
            queryStr += ` AND eoc_type = ?`;
            params.push(eocType);
        }

        if (activeOnly) {
            queryStr += ` AND is_active = 1`;
        }

        queryStr += ` ORDER BY sort_order ASC, module_code ASC`;

        const rows = await query(queryStr, params);

        return NextResponse.json({
            success: true,
            data: Array.isArray(rows) ? rows : []
        });
    } catch (error) {
        console.error("Error fetching EOC modules:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูล EOC Modules");
    }
}

// POST - เพิ่ม EOC Module ใหม่
export async function POST(req) {
    try {
        const auth = await requireAuth(req, ['admin']);
        if (!auth.success) return auth.response;

        const body = await req.json();
        const {
            eoc_type,
            module_code,
            module_name_th,
            module_name_en,
            module_type,
            route_path,
            icon = '📄',
            description = '',
            form_config = null,
            map_config = null,
            required_teams = null,
            is_active = 1,
            sort_order = 0
        } = body;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (!eoc_type || !module_code || !module_name_th || !module_name_en || !module_type || !route_path) {
            return NextResponse.json(
                { success: false, error: "กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน" },
                { status: 400 }
            );
        }

        // ตรวจสอบว่า module ซ้ำหรือไม่
        const checkRows = await query(
            `SELECT id FROM eoc_type_modules WHERE eoc_type = ? AND module_code = ?`,
            [eoc_type, module_code]
        );

        if (Array.isArray(checkRows) && checkRows.length > 0) {
            return NextResponse.json(
                { success: false, error: "Module นี้มีอยู่ในระบบแล้วสำหรับ EOC Type นี้" },
                { status: 400 }
            );
        }

        // เพิ่มข้อมูล
        await query(
            `INSERT INTO eoc_type_modules 
            (eoc_type, module_code, module_name_th, module_name_en, module_type, route_path, 
             icon, description, form_config, map_config, required_teams, is_active, sort_order) 
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                eoc_type, module_code, module_name_th, module_name_en, module_type, route_path,
                icon, description, form_config, map_config, required_teams, is_active, sort_order
            ]
        );

        return NextResponse.json({
            success: true,
            message: "เพิ่ม Module สำเร็จ"
        });
    } catch (error) {
        console.error("Error creating EOC module:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการเพิ่ม EOC Module");
    }
}

// PUT - แก้ไข EOC Module
export async function PUT(req) {
    try {
        const auth = await requireAuth(req, ['admin']);
        if (!auth.success) return auth.response;

        const body = await req.json();
        const {
            id,
            module_name_th,
            module_name_en,
            module_type,
            route_path,
            icon,
            description,
            form_config,
            map_config,
            required_teams,
            is_active,
            sort_order
        } = body;

        if (!id) {
            return NextResponse.json(
                { success: false, error: "กรุณาระบุ ID ของ Module" },
                { status: 400 }
            );
        }

        // สร้าง query แบบ dynamic
        const updates = [];
        const values = [];

        if (module_name_th !== undefined) { updates.push('module_name_th = ?'); values.push(module_name_th); }
        if (module_name_en !== undefined) { updates.push('module_name_en = ?'); values.push(module_name_en); }
        if (module_type !== undefined) { updates.push('module_type = ?'); values.push(module_type); }
        if (route_path !== undefined) { updates.push('route_path = ?'); values.push(route_path); }
        if (icon !== undefined) { updates.push('icon = ?'); values.push(icon); }
        if (description !== undefined) { updates.push('description = ?'); values.push(description); }
        if (form_config !== undefined) { updates.push('form_config = ?'); values.push(form_config); }
        if (map_config !== undefined) { updates.push('map_config = ?'); values.push(map_config); }
        if (required_teams !== undefined) { updates.push('required_teams = ?'); values.push(required_teams); }
        if (is_active !== undefined) { updates.push('is_active = ?'); values.push(is_active); }
        if (sort_order !== undefined) { updates.push('sort_order = ?'); values.push(sort_order); }

        if (updates.length === 0) {
            return NextResponse.json(
                { success: false, error: "ไม่มีข้อมูลที่จะอัพเดท" },
                { status: 400 }
            );
        }

        values.push(id);

        await query(
            `UPDATE eoc_type_modules SET ${updates.join(', ')} WHERE id = ?`,
            values
        );

        return NextResponse.json({
            success: true,
            message: "แก้ไข Module สำเร็จ"
        });
    } catch (error) {
        console.error("Error updating EOC module:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการแก้ไข EOC Module");
    }
}

// DELETE - ลบ EOC Module
export async function DELETE(req) {
    try {
        const auth = await requireAuth(req, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(req.url);
        const id = searchParams.get('id');

        if (!id) {
            return NextResponse.json(
                { success: false, error: "กรุณาระบุ ID ของ Module" },
                { status: 400 }
            );
        }

        await query(
            `DELETE FROM eoc_type_modules WHERE id = ?`,
            [id]
        );

        return NextResponse.json({
            success: true,
            message: "ลบ Module สำเร็จ"
        });
    } catch (error) {
        console.error("Error deleting EOC module:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการลบ EOC Module");
    }
}
