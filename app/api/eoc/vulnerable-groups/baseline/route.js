import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { getPool } from "@/lib/db";
import { handleArchiveDelete, recordChange } from '@/lib/recordArchive';

const pool = getPool();

const COUNT_COLUMNS = new Set([
    'elderly',
    'children',
    'disabled',
    'bedridden',
    'pregnant',
    'chronic_illness',
]);

function toNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

function normalizeVillage(value) {
    return String(value || '').trim() || 'รวม';
}

export async function GET(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');

        connection = await pool.getConnection();

        const whereParts = ['1=1'];
        const params = [];

        if (district && district !== 'all') {
            whereParts.push('district = ?');
            params.push(district);
        }

        if (tambon && tambon !== 'all') {
            whereParts.push('tambon = ?');
            params.push(tambon);
        }

        const [rows] = await connection.execute(`
            SELECT
                id,
                province,
                district,
                tambon,
                village,
                elderly,
                children,
                disabled,
                bedridden,
                pregnant,
                chronic_illness,
                total_cared,
                moved,
                notes,
                needs,
                import_source,
                source_as_of_date,
                created_by,
                created_at,
                updated_at
            FROM vulnerable_group_baselines
            WHERE ${whereParts.join(' AND ')}
            ORDER BY district, tambon, village
        `, params);

        const [summary] = await connection.execute(`
            SELECT
                SUM(elderly) as total_elderly,
                SUM(children) as total_children,
                SUM(disabled) as total_disabled,
                SUM(bedridden) as total_bedridden,
                SUM(pregnant) as total_pregnant,
                SUM(chronic_illness) as total_chronic_illness,
                SUM(elderly + children + disabled + bedridden + pregnant + chronic_illness) as grand_total,
                COUNT(*) as location_count
            FROM vulnerable_group_baselines
            WHERE ${whereParts.join(' AND ')}
        `, params);

        return NextResponse.json({
            success: true,
            data: rows,
            summary: summary[0] || {},
            count: rows.length
        });
    } catch (error) {
        console.error('Error fetching vulnerable group baselines:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงฐานข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

export async function POST(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        const village = normalizeVillage(data.village);
        if (!data.district || !data.tambon) {
            return NextResponse.json(
                { success: false, message: 'กรุณาระบุอำเภอและตำบล' },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        const [result] = await connection.execute(`
            INSERT INTO vulnerable_group_baselines
            (province, district, tambon, village, elderly, children, disabled, bedridden,
             pregnant, chronic_illness, total_cared, moved, notes, needs, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
                elderly = VALUES(elderly),
                children = VALUES(children),
                disabled = VALUES(disabled),
                bedridden = VALUES(bedridden),
                pregnant = VALUES(pregnant),
                chronic_illness = VALUES(chronic_illness),
                total_cared = VALUES(total_cared),
                moved = VALUES(moved),
                notes = VALUES(notes),
                needs = VALUES(needs),
                created_by = VALUES(created_by),
                updated_at = CURRENT_TIMESTAMP
        `, [
            data.province || 'สตูล',
            data.district,
            data.tambon,
            village,
            toNumber(data.elderly),
            toNumber(data.children),
            toNumber(data.disabled),
            toNumber(data.bedridden),
            toNumber(data.pregnant),
            toNumber(data.chronic_illness),
            toNumber(data.total_cared),
            toNumber(data.moved),
            data.notes || null,
            data.needs || null,
            auth.user.username
        ]);

        await recordChange({
            request, user: auth.user, action: result.affectedRows > 1 ? 'data_update' : 'data_create',
            table: 'vulnerable_group_baselines', id: result.insertId,
            description: `บันทึกฐานข้อมูลกลุ่มเปราะบาง: ${[data.village, `ต.${data.tambon}`, `อ.${data.district}`].filter(Boolean).join(" ")}`, newValues: data
        });

        return NextResponse.json({
            success: true,
            data: { id: result.insertId, updated: result.affectedRows > 1 }
        });
    } catch (error) {
        console.error('Error saving vulnerable group baseline:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกฐานข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

export async function PATCH(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        const id = Number(data.id);
        const field = data.field;
        const delta = Number(data.delta);

        if (!id || !COUNT_COLUMNS.has(field) || !Number.isFinite(delta) || delta === 0) {
            return NextResponse.json(
                { success: false, message: 'ข้อมูลการเพิ่ม/ลดไม่ถูกต้อง' },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.execute(`
            UPDATE vulnerable_group_baselines
            SET ${field} = GREATEST(COALESCE(${field}, 0) + ?, 0),
                notes = COALESCE(?, notes),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [delta, data.notes || null, id]);

        const [rows] = await connection.execute(
            'SELECT * FROM vulnerable_group_baselines WHERE id = ?',
            [id]
        );

        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'vulnerable_group_baselines', id,
            description: `ปรับจำนวนกลุ่มเปราะบาง (${field} ${delta > 0 ? '+' : ''}${delta})`, newValues: rows[0] || null
        });

        return NextResponse.json({
            success: true,
            data: rows[0] || null
        });
    } catch (error) {
        console.error('Error adjusting vulnerable group baseline:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการปรับจำนวนกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

export async function PUT(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        const village = normalizeVillage(data.village);
        if (!data.id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();

        await connection.execute(`
            UPDATE vulnerable_group_baselines SET
                district = ?,
                tambon = ?,
                village = ?,
                elderly = ?,
                children = ?,
                disabled = ?,
                bedridden = ?,
                pregnant = ?,
                chronic_illness = ?,
                total_cared = ?,
                moved = ?,
                notes = ?,
                needs = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            data.district,
            data.tambon,
            village,
            toNumber(data.elderly),
            toNumber(data.children),
            toNumber(data.disabled),
            toNumber(data.bedridden),
            toNumber(data.pregnant),
            toNumber(data.chronic_illness),
            toNumber(data.total_cared),
            toNumber(data.moved),
            data.notes || null,
            data.needs || null,
            data.id
        ]);

        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'vulnerable_group_baselines', id: data.id,
            description: `แก้ไขฐานข้อมูลกลุ่มเปราะบาง: ${[data.village, `ต.${data.tambon}`, `อ.${data.district}`].filter(Boolean).join(" ")}`, newValues: data
        });

        return NextResponse.json({ success: true, data: { id: data.id } });
    } catch (error) {
        console.error('Error updating vulnerable group baseline:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขฐานข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

// DELETE - ย้ายไปถังขยะ (กู้คืนได้) พร้อมบันทึกเหตุผล
export async function DELETE(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;
    return handleArchiveDelete(request, auth.user, { table: 'vulnerable_group_baselines' });
}
