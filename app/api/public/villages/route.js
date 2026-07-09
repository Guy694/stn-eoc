import { NextResponse } from 'next/server';
import { getConnection } from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const search = searchParams.get('search') || '';

        const pool = await getConnection();

        // Search villages by name
        const [villages] = await pool.execute(
            `SELECT DISTINCT 
                villname as name,
                moo,
                subdistnam as subDistrict,
                distname as district
            FROM satun_village_polygon 
            WHERE villname LIKE ? 
            ORDER BY villname, CAST(moo AS UNSIGNED)
            LIMIT 20`,
            [`%${search}%`]
        );

        return NextResponse.json({
            success: true,
            data: villages
        });

    } catch (error) {
        console.error('Village search error:', error);
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาดในการค้นหาหมู่บ้าน'
        }, { status: 500 });
    }
}
