import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';
import { getPool } from "@/lib/db";
import { handleArchiveDelete, recordChange } from '@/lib/recordArchive';
import { VULNERABLE_TYPES } from '@/lib/vulnerableEvent';

const TYPE_KEYS = VULNERABLE_TYPES.map((type) => type.key);

const pool = getPool();

async function tableExists(connection, tableName) {
    const [rows] = await connection.execute(
        `SELECT TABLE_NAME
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return rows.length > 0;
}

function appendLocationFilters(whereParts, params, { district, tambon }) {
    if (district && district !== 'all') {
        whereParts.push('district = ?');
        params.push(district);
    }

    if (tambon && tambon !== 'all') {
        whereParts.push('tambon = ?');
        params.push(tambon);
    }
}

async function fetchSessionRows(connection, { sessionId, district, tambon }) {
    const whereParts = ['1=1'];
    const params = [];

    if (sessionId) {
        whereParts.push('session_id = ?');
        params.push(sessionId);
    }

    appendLocationFilters(whereParts, params, { district, tambon });

    const [rows] = await connection.execute(`
        SELECT 
            id,
            session_id,
            province,
            district,
            tambon,
            village,
            ${TYPE_KEYS.join(', ')},
            notes,
            needs,
            created_by,
            created_at,
            updated_at,
            'session' as source_type
        FROM vulnerable_groups
        WHERE ${whereParts.join(' AND ')}
        ORDER BY district, tambon, village
    `, params);

    return rows;
}

async function fetchBaselineRows(connection, { district, tambon }) {
    if (!(await tableExists(connection, 'vulnerable_group_baselines'))) {
        return [];
    }

    const whereParts = ['1=1'];
    const params = [];
    appendLocationFilters(whereParts, params, { district, tambon });

    const [rows] = await connection.execute(`
        SELECT 
            id,
            NULL as session_id,
            province,
            district,
            tambon,
            village,
            ${TYPE_KEYS.join(', ')},
            notes,
            needs,
            created_by,
            created_at,
            updated_at,
            'baseline' as source_type
        FROM vulnerable_group_baselines
        WHERE ${whereParts.join(' AND ')}
        ORDER BY district, tambon, village
    `, params);

    return rows;
}

// GET - ดึงข้อมูลกลุ่มเปราะบาง
export async function GET(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT', 'staff']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const sessionId = searchParams.get('session_id');
        const district = searchParams.get('district');
        const tambon = searchParams.get('tambon');
        const source = searchParams.get('source'); // session, baseline

        connection = await pool.getConnection();

        let sourceType = 'session';
        let rows = [];

        if (source === 'baseline' || source === 'base') {
            rows = await fetchBaselineRows(connection, { district, tambon });
            sourceType = 'baseline';
        } else {
            rows = await fetchSessionRows(connection, { sessionId, district, tambon });

            if (sessionId && rows.length === 0) {
                const baselineRows = await fetchBaselineRows(connection, { district, tambon });
                if (baselineRows.length > 0) {
                    rows = baselineRows;
                    sourceType = 'baseline';
                }
            }
        }

        return NextResponse.json({
            success: true,
            data: rows,
            count: rows.length,
            source: sourceType
        });

    } catch (error) {
        console.error('Error fetching vulnerable groups:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการดึงข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

// POST - บันทึกข้อมูลกลุ่มเปราะบาง
export async function POST(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const data = await request.json();
        connection = await pool.getConnection();

        // ตรวจสอบว่ามีข้อมูลของหมู่บ้านนี้ใน session นี้แล้วหรือยัง
        const [existing] = await connection.execute(`
            SELECT id FROM vulnerable_groups 
            WHERE session_id = ? AND district = ? AND tambon = ? 
            AND COALESCE(village, '') = COALESCE(?, '')
        `, [
            data.session_id,
            data.district,
            data.tambon,
            data.village || ''
        ]);

        if (existing.length > 0) {
            // ถ้ามีแล้ว ให้ UPDATE
            await connection.execute(`
                UPDATE vulnerable_groups SET
                    ${TYPE_KEYS.map((key) => `${key} = ?`).join(', ')},
                    notes = ?,
                    needs = ?,
                    updated_at = CURRENT_TIMESTAMP
                WHERE id = ?
            `, [
                ...TYPE_KEYS.map((key) => Number(data[key]) || 0),
                data.notes || null,
                data.needs || null,
                existing[0].id
            ]);

            await recordChange({
                request, user: auth.user, action: 'data_update', table: 'vulnerable_groups', id: existing[0].id,
                sessionId: data.session_id || null, description: `แก้ไขกลุ่มเปราะบางในเหตุการณ์: ${[data.village, `ต.${data.tambon}`, `อ.${data.district}`].filter(Boolean).join(" ")}`, newValues: data
            });

            return NextResponse.json({
                success: true,
                data: { id: existing[0].id, updated: true }
            });
        } else {
            // ถ้ายังไม่มี ให้ INSERT
            const [result] = await connection.execute(`
                INSERT INTO vulnerable_groups
                (session_id, province, district, tambon, village,
                 ${TYPE_KEYS.join(', ')},
                 notes, needs, created_by)
                VALUES (?, ?, ?, ?, ?, ${TYPE_KEYS.map(() => '?').join(', ')}, ?, ?, ?)
            `, [
                data.session_id,
                data.province || 'สตูล',
                data.district,
                data.tambon,
                data.village || null,
                ...TYPE_KEYS.map((key) => Number(data[key]) || 0),
                data.notes || null,
                data.needs || null,
                auth.user.username
            ]);

            await recordChange({
                request, user: auth.user, action: 'data_create', table: 'vulnerable_groups', id: result.insertId,
                sessionId: data.session_id || null, description: `เพิ่มกลุ่มเปราะบางในเหตุการณ์: ${[data.village, `ต.${data.tambon}`, `อ.${data.district}`].filter(Boolean).join(" ")}`, newValues: data
            });

            return NextResponse.json({
                success: true,
                data: { id: result.insertId }
            });
        }
    } catch (error) {
        console.error('Error saving vulnerable group data:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการบันทึกข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

// PUT - แก้ไขข้อมูล
export async function PUT(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin', 'commander', 'MCATT', 'SAT', 'SeRHT']);
        if (!auth.success) return auth.response;

        const data = await request.json();

        if (!data.id) {
            return NextResponse.json({
                success: false,
                error: 'ID is required'
            }, { status: 400 });
        }

        connection = await pool.getConnection();

        await connection.execute(`
            UPDATE vulnerable_groups SET
                ${TYPE_KEYS.map((key) => `${key} = ?`).join(', ')},
                notes = ?,
                needs = ?,
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `, [
            ...TYPE_KEYS.map((key) => Number(data[key]) || 0),
            data.notes || null,
            data.needs || null,
            data.id
        ]);

        await recordChange({
            request, user: auth.user, action: 'data_update', table: 'vulnerable_groups', id: data.id,
            sessionId: data.session_id || null, description: `แก้ไขกลุ่มเปราะบางในเหตุการณ์: ${[data.village, `ต.${data.tambon}`, `อ.${data.district}`].filter(Boolean).join(" ")}`, newValues: data
        });

        return NextResponse.json({
            success: true,
            data: { id: data.id }
        });

    } catch (error) {
        console.error('Error updating vulnerable group data:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

// DELETE - ย้ายไปถังขยะ (กู้คืนได้) พร้อมบันทึกเหตุผล
export async function DELETE(request) {
    const auth = await requireAuth(request, ['admin']);
    if (!auth.success) return auth.response;
    return handleArchiveDelete(request, auth.user, { table: 'vulnerable_groups' });
}
