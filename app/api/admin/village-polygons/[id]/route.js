import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

// GET - ดึงข้อมูล polygon หมู่บ้านตาม ID
export async function GET(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { id } = params;

        const polygons = await query(
            'SELECT * FROM satun_village_polygon WHERE id = ?',
            [id]
        );

        if (polygons.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Village polygon not found' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            data: polygons[0]
        });

    } catch (error) {
        console.error('Error fetching village polygon:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูล polygon หมู่บ้าน');
    }
}

// PUT - แก้ไขข้อมูล polygon หมู่บ้าน
export async function PUT(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { id } = params;
        const body = await request.json();
        const { villname, moo, distname, subdistnam, coordinates } = body;

        // Validate required fields
        if (!villname || !distname || !subdistnam) {
            return NextResponse.json(
                { success: false, error: 'Missing required fields (villname, distname, subdistnam)' },
                { status: 400 }
            );
        }

        // Update polygon
        await query(`
            UPDATE satun_village_polygon 
            SET villname = ?, 
                moo = ?,
                distname = ?, 
                subdistnam = ?, 
                coordinates = ?
            WHERE id = ?
        `, [villname, moo || null, distname, subdistnam, coordinates || null, id]);

        // ดึงข้อมูลที่อัปเดต
        const updatedPolygon = await query(
            'SELECT * FROM satun_village_polygon WHERE id = ?',
            [id]
        );

        if (updatedPolygon.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Village polygon not found after update' },
                { status: 404 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Village polygon updated successfully',
            data: updatedPolygon[0]
        });

    } catch (error) {
        console.error('Error updating village polygon:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไข polygon หมู่บ้าน');
    }
}

// DELETE - ลบข้อมูล polygon หมู่บ้าน
export async function DELETE(request, { params }) {
    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { id } = params;

        // ตรวจสอบว่ามีข้อมูลอยู่หรือไม่
        const existing = await query(
            'SELECT id FROM satun_village_polygon WHERE id = ?',
            [id]
        );

        if (existing.length === 0) {
            return NextResponse.json(
                { success: false, error: 'Village polygon not found' },
                { status: 404 }
            );
        }

        // ลบข้อมูล
        await query('DELETE FROM satun_village_polygon WHERE id = ?', [id]);

        return NextResponse.json({
            success: true,
            message: 'Village polygon deleted successfully'
        });

    } catch (error) {
        console.error('Error deleting village polygon:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบ polygon หมู่บ้าน');
    }
}
