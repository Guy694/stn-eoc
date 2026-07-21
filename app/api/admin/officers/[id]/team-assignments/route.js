import { NextResponse } from "next/server";
import { getConnection, query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";

const TEAM_MEMBER_ROLES = new Set(["หัวหน้าทีม", "รองหัวหน้าทีม", "สมาชิกทีม"]);

export async function GET(request, { params }) {
    try {
        const auth = await requireAuth(request, ["admin"]);
        if (!auth.success) return auth.response;

        const { id } = await params;
        const isNewOfficer = id === "new";
        const officer = isNewOfficer ? [{ id: null }] : await query("SELECT id FROM officer WHERE id = ?", [id]);
        if (!officer.length) {
            return NextResponse.json({ success: false, message: "ไม่พบเจ้าหน้าที่" }, { status: 404 });
        }

        const availableTeams = await query(`
            SELECT
                st.id AS session_team_id,
                s.id AS session_id,
                s.eoc_type,
                s.session_number,
                t.team_code,
                t.team_name_th
            FROM eoc_session_teams st
            JOIN eoc_sessions s ON s.id = st.eoc_session_id
            JOIN eoc_teams t ON t.id = st.team_id
            WHERE s.status = 'active'
              AND st.is_active = TRUE
              AND t.is_active = TRUE
            ORDER BY s.opened_at DESC, t.sort_order ASC
        `);

        const assignments = isNewOfficer ? [] : await query(`
            SELECT session_team_id, role_in_team
            FROM eoc_team_members
            WHERE officer_id = ?
              AND is_active = TRUE
        `, [id]);

        return NextResponse.json({ success: true, availableTeams, assignments });
    } catch (error) {
        console.error("Error fetching officer team assignments:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงกลุ่มภารกิจของเจ้าหน้าที่");
    }
}

export async function PUT(request, { params }) {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;

    const pool = await getConnection();
    const connection = await pool.getConnection();

    try {
        const { id } = await params;
        const { assignments } = await request.json();
        const normalizedAssignments = Array.isArray(assignments) ? assignments : null;

        if (!normalizedAssignments) {
            return NextResponse.json({ success: false, message: "รูปแบบข้อมูลกลุ่มภารกิจไม่ถูกต้อง" }, { status: 400 });
        }

        const selected = new Map();
        for (const assignment of normalizedAssignments) {
            const sessionTeamId = Number(assignment.sessionTeamId);
            const roleInTeam = assignment.roleInTeam;
            if (!Number.isInteger(sessionTeamId) || sessionTeamId <= 0 || !TEAM_MEMBER_ROLES.has(roleInTeam)) {
                return NextResponse.json({ success: false, message: "ข้อมูลกลุ่มภารกิจหรือบทบาทในทีมไม่ถูกต้อง" }, { status: 400 });
            }
            selected.set(sessionTeamId, roleInTeam);
        }

        await connection.beginTransaction();

        const [officers] = await connection.execute("SELECT id FROM officer WHERE id = ? FOR UPDATE", [id]);
        if (!officers.length) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "ไม่พบเจ้าหน้าที่" }, { status: 404 });
        }

        const selectedIds = [...selected.keys()];
        if (selectedIds.length) {
            const placeholders = selectedIds.map(() => "?").join(", ");
            const [validTeams] = await connection.execute(`
                SELECT st.id
                FROM eoc_session_teams st
                JOIN eoc_sessions s ON s.id = st.eoc_session_id
                JOIN eoc_teams t ON t.id = st.team_id
                WHERE st.id IN (${placeholders})
                  AND s.status = 'active'
                  AND st.is_active = TRUE
                  AND t.is_active = TRUE
            `, selectedIds);

            if (validTeams.length !== selectedIds.length) {
                await connection.rollback();
                return NextResponse.json({ success: false, message: "เลือกกลุ่มภารกิจที่ไม่ได้เปิดใช้งานหรืออยู่ใน Session ที่ปิดแล้ว" }, { status: 400 });
            }
        }

        const [currentAssignments] = await connection.execute(`
            SELECT tm.id, tm.session_team_id
            FROM eoc_team_members tm
            JOIN eoc_session_teams st ON st.id = tm.session_team_id
            JOIN eoc_sessions s ON s.id = st.eoc_session_id
            WHERE tm.officer_id = ?
              AND tm.is_active = TRUE
              AND s.status = 'active'
        `, [id]);
        const currentByTeam = new Map(currentAssignments.map((assignment) => [assignment.session_team_id, assignment]));

        for (const assignment of currentAssignments) {
            if (!selected.has(assignment.session_team_id)) {
                await connection.execute(`
                    UPDATE eoc_team_members
                    SET is_active = FALSE, removed_at = NOW()
                    WHERE id = ?
                `, [assignment.id]);
                await connection.execute(`
                    UPDATE eoc_session_teams
                    SET team_lead_officer_id = NULL
                    WHERE id = ? AND team_lead_officer_id = ?
                `, [assignment.session_team_id, id]);
            }
        }

        for (const [sessionTeamId, roleInTeam] of selected) {
            const existing = currentByTeam.get(sessionTeamId);
            if (existing) {
                await connection.execute(
                    "UPDATE eoc_team_members SET role_in_team = ? WHERE id = ?",
                    [roleInTeam, existing.id]
                );
            } else {
                const [inactiveMembers] = await connection.execute(`
                    SELECT id
                    FROM eoc_team_members
                    WHERE session_team_id = ? AND officer_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                `, [sessionTeamId, id]);

                if (inactiveMembers.length) {
                    await connection.execute(`
                        UPDATE eoc_team_members
                        SET role_in_team = ?, is_active = TRUE, assigned_at = NOW(), removed_at = NULL, assigned_by = ?
                        WHERE id = ?
                    `, [roleInTeam, auth.user.id, inactiveMembers[0].id]);
                } else {
                    await connection.execute(`
                        INSERT INTO eoc_team_members (session_team_id, officer_id, role_in_team, assigned_by)
                        VALUES (?, ?, ?, ?)
                    `, [sessionTeamId, id, roleInTeam, auth.user.id]);
                }
            }

            if (roleInTeam === "หัวหน้าทีม") {
                await connection.execute(`
                    UPDATE eoc_team_members
                    SET role_in_team = 'สมาชิกทีม'
                    WHERE session_team_id = ?
                      AND officer_id != ?
                      AND role_in_team = 'หัวหน้าทีม'
                      AND is_active = TRUE
                `, [sessionTeamId, id]);
                await connection.execute(
                    "UPDATE eoc_session_teams SET team_lead_officer_id = ? WHERE id = ?",
                    [id, sessionTeamId]
                );
            } else {
                await connection.execute(`
                    UPDATE eoc_session_teams
                    SET team_lead_officer_id = NULL
                    WHERE id = ? AND team_lead_officer_id = ?
                `, [sessionTeamId, id]);
            }
        }

        await connection.execute(`
            INSERT INTO activity_logs (user_id, username, action_type, target_type, target_id, description, metadata)
            VALUES (?, ?, 'officer_update', 'officer_team_assignments', ?, ?, ?)
        `, [
            auth.user.id,
            auth.user.username,
            id,
            "ปรับกลุ่มภารกิจ EOC ของเจ้าหน้าที่",
            JSON.stringify({ officerId: Number(id), assignments: [...selected.entries()].map(([sessionTeamId, roleInTeam]) => ({ sessionTeamId, roleInTeam })) })
        ]);

        await connection.commit();
        return NextResponse.json({ success: true, message: "บันทึกกลุ่มภารกิจ EOC สำเร็จ" });
    } catch (error) {
        await connection.rollback();
        console.error("Error updating officer team assignments:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการบันทึกกลุ่มภารกิจ EOC");
    } finally {
        connection.release();
    }
}
