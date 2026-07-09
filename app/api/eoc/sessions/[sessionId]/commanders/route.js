import { NextResponse } from "next/server";
import { query, getConnection } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";

const VALID_ROLES = new Set(["incident_commander", "deputy_incident_commander"]);

async function ensureCommandersTable() {
    await query(`
        CREATE TABLE IF NOT EXISTS eoc_session_commanders (
            id INT NOT NULL AUTO_INCREMENT,
            eoc_session_id BIGINT NOT NULL,
            officer_id INT NOT NULL,
            command_role ENUM('incident_commander', 'deputy_incident_commander') NOT NULL DEFAULT 'deputy_incident_commander',
            notes TEXT NULL,
            sort_order INT NOT NULL DEFAULT 0,
            is_active TINYINT(1) NOT NULL DEFAULT 1,
            assigned_by INT NULL,
            assigned_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_by INT NULL,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            removed_by INT NULL,
            removed_at DATETIME NULL,
            PRIMARY KEY (id),
            KEY idx_eoc_session_commanders_session (eoc_session_id),
            KEY idx_eoc_session_commanders_officer (officer_id),
            KEY idx_eoc_session_commanders_role (command_role, is_active)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `, []);
}

async function getSession(sessionId) {
    const rows = await query(`
        SELECT id, eoc_type, session_number, status, opened_at, closed_at
        FROM eoc_sessions
        WHERE id = ?
    `, [sessionId]);
    return rows[0] || null;
}

async function getCommanders(sessionId) {
    return query(`
        SELECT
            c.id,
            c.eoc_session_id,
            c.officer_id,
            c.command_role,
            c.notes,
            c.sort_order,
            c.assigned_at,
            c.updated_at,
            o.username,
            o.title,
            o.given_name,
            o.family_name,
            CONCAT(COALESCE(o.title, ''), o.given_name, ' ', o.family_name) as full_name,
            o.role as officer_role,
            o.position,
            o.department,
            o.phone,
            o.email
        FROM eoc_session_commanders c
        JOIN officer o ON c.officer_id = o.id
        WHERE c.eoc_session_id = ?
          AND c.is_active = 1
        ORDER BY
            CASE c.command_role
                WHEN 'incident_commander' THEN 1
                WHEN 'deputy_incident_commander' THEN 2
                ELSE 3
            END,
            c.sort_order ASC,
            c.assigned_at ASC
    `, [sessionId]);
}

async function getOfficerOptions() {
    return query(`
        SELECT
            id,
            username,
            title,
            given_name,
            family_name,
            CONCAT(COALESCE(title, ''), given_name, ' ', family_name) as full_name,
            role,
            position,
            department,
            phone,
            email
        FROM officer
        WHERE role <> 'admin'
          AND COALESCE(is_approved, 1) = 1
        ORDER BY
            CASE role
                WHEN 'commander' THEN 1
                WHEN 'MCATT' THEN 2
                WHEN 'SAT' THEN 3
                WHEN 'SeRHT' THEN 4
                WHEN 'staff' THEN 5
                ELSE 6
            END,
            given_name ASC,
            family_name ASC
    `, []);
}

function validatePayload(body, requireId = false) {
    const id = Number(body.id || 0);
    const officerId = Number(body.officer_id || 0);
    const commandRole = body.command_role;
    const sortOrder = Number(body.sort_order || 0);
    const notes = String(body.notes || "").trim();

    if (requireId && !id) {
        return { error: "กรุณาระบุรายการที่ต้องการแก้ไข" };
    }

    if (!officerId) {
        return { error: "กรุณาเลือกเจ้าหน้าที่" };
    }

    if (!VALID_ROLES.has(commandRole)) {
        return { error: "บทบาทไม่ถูกต้อง" };
    }

    return {
        value: {
            id,
            officerId,
            commandRole,
            sortOrder,
            notes
        }
    };
}

async function assertOfficerAllowed(officerId) {
    const officers = await query(
        "SELECT id, role FROM officer WHERE id = ? AND role <> 'admin' AND COALESCE(is_approved, 1) = 1",
        [officerId]
    );
    return officers.length > 0;
}

async function hasActiveIncidentCommander(sessionId, excludeId = 0) {
    const rows = await query(`
        SELECT id
        FROM eoc_session_commanders
        WHERE eoc_session_id = ?
          AND command_role = 'incident_commander'
          AND is_active = 1
          AND id <> ?
        LIMIT 1
    `, [sessionId, excludeId]);
    return rows.length > 0;
}

export async function GET(request, { params }) {
    try {
        const auth = await requireAuth(request, ["admin", "commander", "MCATT", "SAT", "SeRHT", "staff"]);
        if (!auth.success) return auth.response;

        const { sessionId } = await params;
        await ensureCommandersTable();

        const session = await getSession(sessionId);
        if (!session) {
            return NextResponse.json({ success: false, message: "ไม่พบ EOC Session" }, { status: 404 });
        }

        const [commanders, officerOptions] = await Promise.all([
            getCommanders(sessionId),
            getOfficerOptions()
        ]);

        return NextResponse.json({
            success: true,
            session,
            commanders,
            officerOptions
        });
    } catch (error) {
        console.error("Error fetching session commanders:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูลผู้บัญชาการเหตุการณ์");
    }
}

export async function POST(request, { params }) {
    const auth = await requireAuth(request, ["admin", "commander"]);
    if (!auth.success) return auth.response;

    try {
        const { sessionId } = await params;
        const body = await request.json();
        const validation = validatePayload(body);
        if (validation.error) {
            return NextResponse.json({ success: false, message: validation.error }, { status: 400 });
        }

        await ensureCommandersTable();
        const session = await getSession(sessionId);
        if (!session) {
            return NextResponse.json({ success: false, message: "ไม่พบ EOC Session" }, { status: 404 });
        }

        const { officerId, commandRole, sortOrder, notes } = validation.value;
        const officerAllowed = await assertOfficerAllowed(officerId);
        if (!officerAllowed) {
            return NextResponse.json({ success: false, message: "ไม่สามารถเลือกผู้ดูแลระบบเป็น head ของผังได้" }, { status: 400 });
        }

        if (commandRole === "incident_commander" && await hasActiveIncidentCommander(sessionId)) {
            return NextResponse.json({ success: false, message: "มีผู้บัญชาการเหตุการณ์อยู่แล้ว กรุณาแก้ไขรายการเดิมหรือลบก่อน" }, { status: 400 });
        }

        const result = await query(`
            INSERT INTO eoc_session_commanders
                (eoc_session_id, officer_id, command_role, notes, sort_order, assigned_by)
            VALUES (?, ?, ?, ?, ?, ?)
        `, [sessionId, officerId, commandRole, notes || null, sortOrder, auth.user.id]);

        return NextResponse.json({
            success: true,
            message: "เพิ่มข้อมูลผู้บัญชาการเหตุการณ์สำเร็จ",
            id: result.insertId
        }, { status: 201 });
    } catch (error) {
        console.error("Error creating session commander:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการเพิ่มข้อมูลผู้บัญชาการเหตุการณ์");
    }
}

export async function PUT(request, { params }) {
    const auth = await requireAuth(request, ["admin", "commander"]);
    if (!auth.success) return auth.response;

    try {
        const { sessionId } = await params;
        const body = await request.json();
        const validation = validatePayload(body, true);
        if (validation.error) {
            return NextResponse.json({ success: false, message: validation.error }, { status: 400 });
        }

        await ensureCommandersTable();
        const { id, officerId, commandRole, sortOrder, notes } = validation.value;
        const officerAllowed = await assertOfficerAllowed(officerId);
        if (!officerAllowed) {
            return NextResponse.json({ success: false, message: "ไม่สามารถเลือกผู้ดูแลระบบเป็น head ของผังได้" }, { status: 400 });
        }

        if (commandRole === "incident_commander" && await hasActiveIncidentCommander(sessionId, id)) {
            return NextResponse.json({ success: false, message: "มีผู้บัญชาการเหตุการณ์อยู่แล้ว กรุณาแก้ไขรายการเดิมหรือลบก่อน" }, { status: 400 });
        }

        const result = await query(`
            UPDATE eoc_session_commanders
            SET officer_id = ?,
                command_role = ?,
                notes = ?,
                sort_order = ?,
                updated_by = ?,
                updated_at = NOW()
            WHERE id = ?
              AND eoc_session_id = ?
              AND is_active = 1
        `, [officerId, commandRole, notes || null, sortOrder, auth.user.id, id, sessionId]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: "ไม่พบรายการที่ต้องการแก้ไข" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "แก้ไขข้อมูลผู้บัญชาการเหตุการณ์สำเร็จ"
        });
    } catch (error) {
        console.error("Error updating session commander:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการแก้ไขข้อมูลผู้บัญชาการเหตุการณ์");
    }
}

export async function DELETE(request, { params }) {
    const auth = await requireAuth(request, ["admin", "commander"]);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const conn = await pool.getConnection();

    try {
        const { sessionId } = await params;
        const { searchParams } = new URL(request.url);
        const id = Number(searchParams.get("id") || 0);
        if (!id) {
            return NextResponse.json({ success: false, message: "กรุณาระบุรายการที่ต้องการลบ" }, { status: 400 });
        }

        await ensureCommandersTable();
        const [result] = await conn.execute(`
            UPDATE eoc_session_commanders
            SET is_active = 0,
                removed_by = ?,
                removed_at = NOW(),
                updated_by = ?,
                updated_at = NOW()
            WHERE id = ?
              AND eoc_session_id = ?
              AND is_active = 1
        `, [auth.user.id, auth.user.id, id, sessionId]);

        if (result.affectedRows === 0) {
            return NextResponse.json({ success: false, message: "ไม่พบรายการที่ต้องการลบ" }, { status: 404 });
        }

        return NextResponse.json({
            success: true,
            message: "ลบข้อมูลผู้บัญชาการเหตุการณ์สำเร็จ"
        });
    } catch (error) {
        console.error("Error deleting session commander:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการลบข้อมูลผู้บัญชาการเหตุการณ์");
    } finally {
        conn.release();
    }
}
