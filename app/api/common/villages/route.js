import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { publicInternalError } from '@/lib/apiResponse';

export async function GET() {
    try {
        // Query to get distinct village information
        // We use DISTINCT to avoid duplicates if any, though distinct id usually implies unique rows
        // But for the purpose of the dropdown hierarchy, we need list of villages with their district and tambon
        const sql = `
            SELECT 
                id,
                villcode,
                moo,
                villname as name,
                subdistnam as subDistrict,
                distname as district
            FROM satun_village_polygon
            ORDER BY distname, subdistnam, CAST(moo AS UNSIGNED), villname
        `;

        const results = await query(sql);

        // Map data to match frontend expectations
        const data = results.map(row => ({
            id: row.id,
            code: row.villcode,
            moo: row.moo,
            name: row.name,
            subDistrict: row.subDistrict, // Tambon
            district: row.district      // District (Amphoe)
        }));

        return NextResponse.json({
            success: true,
            data: data
        });

    } catch (error) {
        console.error('Error fetching villages:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลหมู่บ้าน');
    }
}
