import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const district = searchParams.get("district");
        const params = [];
        let where = "";
        if (district) {
            where = "WHERE distname = ?";
            params.push(district);
        }

        const rows = await query(`
            SELECT distname AS district_name, subdistnam AS tambon_name,
                   MIN(villcode) AS area_code
            FROM satun_village_polygon
            ${where}
            GROUP BY distname, subdistnam
            ORDER BY distname, subdistnam
        `, params);

        const districtMap = new Map();
        rows.forEach((row) => {
            if (!districtMap.has(row.district_name)) {
                districtMap.set(row.district_name, {
                    id: row.district_name,
                    name: row.district_name,
                    tambons: []
                });
            }
            districtMap.get(row.district_name).tambons.push({
                id: row.area_code || `${row.district_name}:${row.tambon_name}`,
                name: row.tambon_name
            });
        });

        const data = [...districtMap.values()];
        return NextResponse.json({
            success: true,
            data,
            meta: {
                source_type: "database",
                source_name: "satun_village_polygon",
                record_count: rows.length,
                generated_at: new Date().toISOString()
            }
        });
    } catch (error) {
        console.error("Area master data error:", error);
        return publicInternalError("ไม่สามารถโหลดข้อมูลอำเภอและตำบลได้");
    }
}
