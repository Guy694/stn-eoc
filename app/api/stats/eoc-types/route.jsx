import { NextResponse } from "next/server";
import pool from "@/lib/db";

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

        console.log("Query result rows:", rows); // Debug log
        console.log("Rows type:", typeof rows, "Is array:", Array.isArray(rows)); // Debug log

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

        console.log("Rows count:", rows.length); // Debug log

        // ถ้าไม่มีข้อมูลเลย ให้ return ข้อมูลว่าง
        if (rows.length === 0) {
            console.log("No data found in eoc_sessions");
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

        console.log("Result data:", result); // Debug log

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
        return NextResponse.json(
            { success: false, error: error.message },
            { status: 500 }
        );
    }
}
