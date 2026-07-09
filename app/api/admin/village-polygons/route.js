import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - ดึงรายการ polygon หมู่บ้านทั้งหมด
export async function GET(request) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');
        const search = searchParams.get('search');
        const page = parseInt(searchParams.get('page')) || 1;
        const limit = parseInt(searchParams.get('limit')) || 20;
        const offset = (page - 1) * limit;

        let sql = `
            SELECT 
                id, 
                villname, 
                moo,
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

        // นับจำนวนทั้งหมดตามเงื่อนไข
        let countSql = 'SELECT COUNT(*) as total FROM satun_village_polygon WHERE 1=1';
        const countParams = [];

        if (district) {
            countSql += ' AND distname = ?';
            countParams.push(district);
        }

        if (tambon) {
            countSql += ' AND subdistnam = ?';
            countParams.push(tambon);
        }

        if (search) {
            countSql += ' AND villname LIKE ?';
            countParams.push(`%${search}%`);
        }

        const [countResult] = await query(countSql, countParams);
        const totalRecords = countResult.total;
        const totalPages = Math.ceil(totalRecords / limit);

        sql += ' ORDER BY distname, subdistnam, CAST(moo AS UNSIGNED), villname LIMIT ? OFFSET ?';
        params.push(limit, offset);

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
            pagination: {
                currentPage: page,
                totalPages: totalPages,
                totalRecords: totalRecords,
                limit: limit
            }
        });

    } catch (error) {
        console.error('Error fetching village polygons:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูล polygon หมู่บ้าน');
    }
}

// POST - เพิ่มข้อมูล polygon หมู่บ้านใหม่
export async function POST(request) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const body = await request.json();
        const { villname, moo, distname, subdistnam, coordinates } = body;

        // Validate required fields
        if (!villname || !distname || !subdistnam) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (villname, distname, subdistnam)' },
                { status: 400 }
            );
        }

        // Insert new polygon
        const result = await query(`
            INSERT INTO satun_village_polygon (villname, moo, distname, subdistnam, coordinates)
            VALUES (?, ?, ?, ?, ?)
        `, [villname, moo || null, distname, subdistnam, coordinates || null]);

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
        return publicInternalError('เกิดข้อผิดพลาดในการเพิ่ม polygon หมู่บ้าน');
    }
}
