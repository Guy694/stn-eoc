import { NextResponse } from 'next/server';
import { query } from '@/lib/db';

// GET - ดึงรายการ polygon หมู่บ้านทั้งหมด
export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');
        const search = searchParams.get('search');

        let sql = `
            SELECT 
                id, 
                villname, 
                distname, 
                subdistnam, 
                geom
            FROM satun_village_polygon
            WHERE 1=1
        `;
        const params = [];

        if (district) {
            sql += ' AND distname = ?';
            params.push(district);
        }

        if (tambon) {
            sql += ' AND subdistnam = ?';
            params.push(tambon);
        }

        if (search) {
            sql += ' AND villname LIKE ?';
            params.push(`%${search}%`);
        }

        sql += ' ORDER BY distname, subdistnam, villname';

        const polygons = await query(sql, params);

        // นับสtatistics
        const allPolygons = await query('SELECT distname, subdistnam FROM satun_village_polygon');
        const stats = {
            total: allPolygons.length,
            districts: new Set(allPolygons.map(p => p.distname)).size,
            tambons: new Set(allPolygons.map(p => p.subdistnam)).size
        };

        return NextResponse.json({
            success: true,
            data: polygons,
            stats: stats,
            total: polygons.length
        });

    } catch (error) {
        console.error('Error fetching village polygons:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to fetch village polygons', details: error.message },
            { status: 500 }
        );
    }
}

// POST - เพิ่มข้อมูล polygon หมู่บ้านใหม่
export async function POST(request) {
    try {
        const body = await request.json();
        const { villname, distname, subdistnam, coordinates } = body;

        // Validate required fields
        if (!villname || !distname || !subdistnam) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (villname, distname, subdistnam)' },
                { status: 400 }
            );
        }

        // Insert new polygon
        const result = await query(`
            INSERT INTO satun_village_polygon (villname, distname, subdistnam, coordinates)
            VALUES (?, ?, ?, ?)
        `, [villname, distname, subdistnam, coordinates || null]);

        // ดึงข้อมูลที่เพิ่งสร้าง
        const newPolygon = await query(
            'SELECT * FROM satun_village_polygon WHERE id = ?',
            [result.insertId]
        );

        return NextResponse.json({
            success: true,
            message: 'Village polygon created successfully',
            data: newPolygon[0]
        }, { status: 201 });

    } catch (error) {
        console.error('Error creating village polygon:', error);
        return NextResponse.json(
            { success: false, error: 'Failed to create village polygon', details: error.message },
            { status: 500 }
        );
    }
}
