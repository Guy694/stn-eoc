import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

// API สำหรับดึงข้อมูลสถานพยาบาล
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const type = searchParams.get('type'); // กรองตามประเภท
        const district = searchParams.get('district'); // กรองตามอำเภอ
        const risk = searchParams.get('risk'); // กรองตามความเสี่ยง

        // Query จาก database
        let sql = `
            SELECT 
                id,
                name,
                typecode,
                lat,
                lon,
                risk_level,
                district_name as district,
                is_active
            FROM health_facilities
            WHERE is_active = 1
        `;

        const params = [];

        if (type) {
            sql += ' AND typecode = ?';
            params.push(type);
        }

        if (district) {
            sql += ' AND district_name = ?';
            params.push(district);
        }

        if (risk) {
            sql += ' AND risk_level = ?';
            params.push(risk);
        }

        sql += ' ORDER BY typecode, name';

        const facilities = await query(sql, params);

        // สถิติ
        const stats = {
            total: facilities.length,
            byType: {},
            byRisk: {},
            byDistrict: {}
        };

        facilities.forEach(f => {
            // นับตามประเภท
            stats.byType[f.typecode] = (stats.byType[f.typecode] || 0) + 1;

            // นับตามความเสี่ยง
            stats.byRisk[f.risk_level] = (stats.byRisk[f.risk_level] || 0) + 1;

            // นับตามอำเภอ
            stats.byDistrict[f.district] = (stats.byDistrict[f.district] || 0) + 1;
        });

        return NextResponse.json({
            success: true,
            data: facilities,
            stats: stats
        });

    } catch (error) {
        console.error('Error fetching health facilities:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลสถานพยาบาล');
    }
}
