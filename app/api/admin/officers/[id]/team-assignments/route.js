import { NextResponse } from "next/server";
import { getConnection, query } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { appendAuditLog } from "@/lib/auditLog";

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

        const [officers] = await connection.execute(`
            SELECT id, username, title, given_name, family_name, role, is_approved
            FROM officer
            WHERE id = ?
            FOR UPDATE
        `, [id]);
        if (!officers.length) {
            await connection.rollback();
            return NextResponse.json({ success: false, message: "ไม่พบเจ้าหน้าที่" }, { status: 404 });
        }
        const targetOfficer = officers[0];

        const selectedIds = [...selected.keys()];
        if (selectedIds.length) {
            const placeholders = selectedIds.map(() => "?").join(", ");
            const [validTeams] = await connection.execute(`
                SELECT st.id, st.eoc_session_id, s.session_number, s.eoc_type,
                       t.team_code, t.team_name_th
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
            SELECT tm.id, tm.session_team_id, tm.role_in_team,
                   st.eoc_session_id, s.session_number, s.eoc_type,
                   t.team_code, t.team_name_th
            FROM eoc_team_members tm
            JOIN eoc_session_teams st ON st.id = tm.session_team_id
            JOIN eoc_sessions s ON s.id = st.eoc_session_id
            JOIN eoc_teams t ON t.id = st.team_id
            WHERE tm.officer_id = ?
              AND tm.is_active = TRUE
              AND s.status = 'active'
        `, [id]);
        const currentByTeam = new Map(currentAssignments.map((assignment) => [Number(assignment.session_team_id), assignment]));
        const assignmentChanges = [];

        for (const assignment of currentAssignments) {
            const sessionTeamId = Number(assignment.session_team_id);
            if (!selected.has(sessionTeamId)) {
                await connection.execute(`
                    UPDATE eoc_team_members
                    SET is_active = FALSE, removed_at = NOW(), removed_by = ?
                    WHERE id = ?
                `, [auth.user.id, assignment.id]);
                await connection.execute(`
                    UPDATE eoc_session_teams
                    SET team_lead_officer_id = NULL
                    WHERE id = ? AND team_lead_officer_id = ?
                `, [sessionTeamId, id]);
                assignmentChanges.push({
                    action: "data_delete",
                    membershipId: assignment.id,
                    context: assignment,
                    oldRole: assignment.role_in_team,
                    newRole: null,
                });
            }
        }

        for (const [sessionTeamId, roleInTeam] of selected) {
            const existing = currentByTeam.get(sessionTeamId);
            if (existing) {
                if (existing.role_in_team !== roleInTeam) {
                    await connection.execute(
                        "UPDATE eoc_team_members SET role_in_team = ? WHERE id = ?",
                        [roleInTeam, existing.id]
                    );
                    assignmentChanges.push({
                        action: "data_update",
                        membershipId: existing.id,
                        context: existing,
                        oldRole: existing.role_in_team,
                        newRole: roleInTeam,
                    });
                }
            } else {
                const [inactiveMembers] = await connection.execute(`
                    SELECT id
                    FROM eoc_team_members
                    WHERE session_team_id = ? AND officer_id = ?
                    ORDER BY id DESC
                    LIMIT 1
                `, [sessionTeamId, id]);

                let membershipId;
                if (inactiveMembers.length) {
                    await connection.execute(`
                        UPDATE eoc_team_members
                        SET role_in_team = ?, is_active = TRUE, assigned_at = NOW(), removed_at = NULL, assigned_by = ?
                        WHERE id = ?
                    `, [roleInTeam, auth.user.id, inactiveMembers[0].id]);
                    membershipId = inactiveMembers[0].id;
                } else {
                    const [insertResult] = await connection.execute(`
                        INSERT INTO eoc_team_members (session_team_id, officer_id, role_in_team, assigned_by)
                        VALUES (?, ?, ?, ?)
                    `, [sessionTeamId, id, roleInTeam, auth.user.id]);
                    membershipId = insertResult.insertId;
                }
                const [teamContexts] = await connection.execute(`
                    SELECT st.id AS session_team_id, st.eoc_session_id,
                           s.session_number, s.eoc_type,
                           t.team_code, t.team_name_th
                    FROM eoc_session_teams st
                    JOIN eoc_sessions s ON s.id = st.eoc_session_id
                    JOIN eoc_teams t ON t.id = st.team_id
                    WHERE st.id = ?
                    LIMIT 1
                `, [sessionTeamId]);
                assignmentChanges.push({
                    action: "data_create",
                    membershipId,
                    context: teamContexts[0],
                    oldRole: null,
                    newRole: roleInTeam,
                });
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

        const officerName = [
            targetOfficer.title,
            targetOfficer.given_name,
            targetOfficer.family_name,
        ].filter(Boolean).join(" ");
        const actionLabels = {
            data_create: "เพิ่มเข้ากลุ่มภารกิจ",
            data_update: "เปลี่ยนบทบาทในกลุ่มภารกิจ",
            data_delete: "ถอดออกจากกลุ่มภารกิจ",
        };
        for (const change of assignmentChanges) {
            await appendAuditLog(
                (sql, values) => connection.execute(sql, values),
                {
                    request,
                    user: auth.user,
                    action: change.action,
                    targetType: "eoc_team_member",
                    targetId: change.membershipId,
                    sessionId: change.context.eoc_session_id,
                    sessionTeamId: change.context.session_team_id,
                    description: `${actionLabels[change.action]}: ${officerName} · ${change.context.team_code} - ${change.context.team_name_th}`,
                    metadata: {
                        source: "officer_team_assignments",
                        officerId: Number(id),
                        officerName,
                        officerUsername: targetOfficer.username,
                        sessionNumber: change.context.session_number,
                        eocType: change.context.eoc_type,
                        teamCode: change.context.team_code,
                        teamName: change.context.team_name_th,
                    },
                    oldValues: change.oldRole ? { roleInTeam: change.oldRole, isActive: true } : null,
                    newValues: change.newRole ? { roleInTeam: change.newRole, isActive: true } : null,
                }
            );
        }

        await connection.commit();
        return NextResponse.json({
            success: true,
            message: "บันทึกกลุ่มภารกิจ EOC สำเร็จ",
            auditEventsCreated: assignmentChanges.length,
        });
    } catch (error) {
        await connection.rollback();
        console.error("Error updating officer team assignments:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการบันทึกกลุ่มภารกิจ EOC");
    } finally {
        connection.release();
    }
}
