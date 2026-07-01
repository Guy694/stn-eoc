import { NextResponse } from "next/server";
import pool from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

export async function GET(req) {
    try {
        const { searchParams } = new URL(req.url);
        const year = searchParams.get('year'); // 'all' หรือปีเฉพาะ เช่น '2025'

        let query = `
            SELECT 
                eoc_type,
                COUNT(*) as count,
                YEAR(opened_at) as year
            FROM eoc_sessions
        `;

        const params = [];

        if (year && year !== 'all') {
            query += ` WHERE YEAR(opened_at) = ?`;
            params.push(year);
        }

        query += `
            GROUP BY eoc_type, YEAR(opened_at)
            ORDER BY eoc_type, year DESC
        `;

        const [rows] = await pool.query(query, params);

        // ตรวจสอบว่า rows เป็น array และมีข้อมูล
        if (!Array.isArray(rows)) {
            console.error("Rows is not an array:", rows);
            // ถ้าได้ object เดียว ให้แปลงเป็น array
            const rowsArray = rows ? [rows] : [];
            if (rowsArray.length === 0) {
                return NextResponse.json({
                    success: true,
                    data: {},
                    availableYears: [],
                    rawData: []
                });
            }
            // ใช้ rowsArray แทน
            const result = rowsArray.reduce((acc, row) => {
                if (!acc[row.eoc_type]) {
                    acc[row.eoc_type] = 0;
                }
                acc[row.eoc_type] += parseInt(row.count) || 0;
                return acc;
            }, {});

            return NextResponse.json({
                success: true,
                data: result,
                availableYears: [],
                rawData: rowsArray
            });
        }

        // ถ้าไม่มีข้อมูลเลย ให้ return ข้อมูลว่าง
        if (rows.length === 0) {
            return NextResponse.json({
                success: true,
                data: {},
                availableYears: [],
                rawData: [],
                message: "ไม่พบข้อมูล EOC Sessions"
            });
        }

        // ถ้าเลือกปีเฉพาะ ให้ group ตาม eoc_type เท่านั้น
        const result = rows.reduce((acc, row) => {
            if (!acc[row.eoc_type]) {
                acc[row.eoc_type] = 0;
            }
            acc[row.eoc_type] += parseInt(row.count) || 0;
            return acc;
        }, {});

        // ดึงรายการปีทั้งหมดที่มีข้อมูล
        const [yearRows] = await pool.query(`
            SELECT DISTINCT YEAR(opened_at) as year
            FROM eoc_sessions
            WHERE opened_at IS NOT NULL
            ORDER BY year DESC
        `);

        const availableYears = Array.isArray(yearRows) ? yearRows.map(row => row.year) : [];

        return NextResponse.json({
            success: true,
            data: result,
            availableYears: availableYears,
            rawData: rows
        });
    } catch (error) {
        console.error("Error fetching EOC type stats:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงสถิติประเภท EOC");
    }
}
