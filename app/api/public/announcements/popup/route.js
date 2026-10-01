import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { getPool } from "@/lib/db";

const pool = getPool();

// GET - ดึงแบนเนอร์สำหรับแสดง popup (1 รายการล่าสุด)
export async function GET(request) {
    const connection = await pool.getConnection();

    try {
        // ดึงแบนเนอร์ที่:
        // 1. is_active = true
        // 2. show_popup = true
        // 3. อยู่ในช่วงวันที่แสดง (ถ้ามีกำหนด)
        // 4. เรียงตาม priority สูงสุดและล่าสุด
        const [announcements] = await connection.execute(
            `SELECT 
                id,
                title,
                description,
                image_path,
                priority,
                start_date,
                end_date
            FROM announcements
            WHERE is_active = 1 
            AND show_popup = 1
            AND (start_date IS NULL OR start_date <= NOW())
            AND (end_date IS NULL OR end_date >= NOW())
            ORDER BY priority DESC, created_at DESC
            LIMIT 1`,
            []
        );

        if (announcements.length === 0) {
            return NextResponse.json({
                success: true,
                data: null
            });
        }

        return NextResponse.json({
            success: true,
            data: announcements[0]
        });

    } catch (error) {
        console.error('Error fetching popup announcement:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูล');
    } finally {
        connection.release();
    }
}
