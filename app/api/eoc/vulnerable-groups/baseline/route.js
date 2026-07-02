import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';
import { requireAuth } from '@/lib/auth';
import { publicInternalError } from '@/lib/apiResponse';

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    charset: 'utf8mb4',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

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

async function ensureBaselineSchema(connection) {
    await connection.execute(`
        CREATE TABLE IF NOT EXISTS vulnerable_group_baselines (
            id INT AUTO_INCREMENT PRIMARY KEY,
            province VARCHAR(100) NOT NULL DEFAULT 'สตูล',
            district VARCHAR(100) NOT NULL,
            tambon VARCHAR(100) NOT NULL,
            village VARCHAR(100) NULL,
            elderly INT NULL DEFAULT 0,
            children INT NULL DEFAULT 0,
            disabled INT NULL DEFAULT 0,
            bedridden INT NULL DEFAULT 0,
            pregnant INT NULL DEFAULT 0,
            chronic_illness INT NULL DEFAULT 0,
            total_cared INT NULL DEFAULT 0,
            moved INT NULL DEFAULT 0,
            notes TEXT NULL,
            needs TEXT NULL,
            import_source VARCHAR(255) NULL,
            source_url TEXT NULL,
            source_as_of_date DATE NULL,
            created_by VARCHAR(100) NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            UNIQUE KEY unique_baseline_location (province, district, tambon, village),
            INDEX idx_location (district, tambon),
            INDEX idx_source_as_of_date (source_as_of_date)
        )
    `);
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
        await ensureBaselineSchema(connection);

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
        await ensureBaselineSchema(connection);

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
        await ensureBaselineSchema(connection);

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
        await ensureBaselineSchema(connection);

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

        return NextResponse.json({ success: true, data: { id: data.id } });
    } catch (error) {
        console.error('Error updating vulnerable group baseline:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการแก้ไขฐานข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}

export async function DELETE(request) {
    let connection;

    try {
        const auth = await requireAuth(request, ['admin']);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const id = searchParams.get('id');
        if (!id) {
            return NextResponse.json(
                { success: false, message: 'ไม่พบ ID' },
                { status: 400 }
            );
        }

        connection = await pool.getConnection();
        const [result] = await connection.execute(
            'DELETE FROM vulnerable_group_baselines WHERE id = ?',
            [id]
        );

        return NextResponse.json({
            success: true,
            data: { affectedRows: result.affectedRows }
        });
    } catch (error) {
        console.error('Error deleting vulnerable group baseline:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการลบฐานข้อมูลกลุ่มเปราะบาง');
    } finally {
        if (connection) connection.release();
    }
}
