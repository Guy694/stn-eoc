import { NextResponse } from "next/server";
import { transaction } from "@/lib/db";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getTeam } from "@/src/features/eoc/registries/team.registry";

export async function POST(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin", "commander"]);
    if (!auth.success) return auth.response;
    const { sessionId } = await params;
    const body = await request.json();
    const requestedCodes = Array.isArray(body.teamCodes) ? body.teamCodes : [];
    const teams = requestedCodes.map(getTeam);
    if (!teams.length || teams.some((team) => !team)) {
      return NextResponse.json({ success: false, message: "กรุณาระบุกลุ่มภารกิจจากทะเบียนกลางอย่างน้อย 1 กลุ่ม" }, { status: 400 });
    }
    const copyFromSessionId = Number(body.copyFromSessionId) || null;
    const result = await transaction(async (execute) => {
      const sessions = await execute(`SELECT id, status FROM eoc_sessions WHERE id = ? LIMIT 1 FOR UPDATE`, [sessionId]);
      if (!sessions.length) throw Object.assign(new Error("ไม่พบเหตุการณ์"), { status: 404 });
      if (sessions[0].status !== "active") throw Object.assign(new Error("เพิ่มแม่แบบได้เฉพาะเหตุการณ์ที่เปิดอยู่"), { status: 409 });
      const created = [];
      for (const team of teams) {
        const databaseTeams = await execute(`SELECT id FROM eoc_teams WHERE LOWER(team_code) = LOWER(?) AND is_active = 1 LIMIT 1`, [team.legacyCode]);
        if (!databaseTeams.length) throw Object.assign(new Error(`ไม่พบกลุ่ม ${team.legacyCode} ที่ active ในฐานข้อมูล`), { status: 400 });
        const existing = await execute(`SELECT id FROM eoc_session_teams WHERE eoc_session_id = ? AND team_id = ? AND is_active = 1 LIMIT 1`, [sessionId, databaseTeams[0].id]);
        if (existing.length) continue;
        let leadId = null;
        let sourceMembers = [];
        if (copyFromSessionId) {
          const source = await execute(`
            SELECT source_team.team_lead_officer_id
            FROM eoc_session_teams source_team
            JOIN eoc_teams source_definition ON source_definition.id = source_team.team_id
            WHERE source_team.eoc_session_id = ? AND source_team.is_active = 1
              AND LOWER(source_definition.team_code) = LOWER(?)
            LIMIT 1
          `, [copyFromSessionId, team.legacyCode]);
          leadId = source[0]?.team_lead_officer_id || null;
          sourceMembers = await execute(`
            SELECT member.officer_id, member.role_in_team
            FROM eoc_team_members member
            JOIN eoc_session_teams source_team ON source_team.id = member.session_team_id
            JOIN eoc_teams source_definition ON source_definition.id = source_team.team_id
            JOIN officer ON officer.id = member.officer_id
            WHERE source_team.eoc_session_id = ? AND source_team.is_active = 1
              AND member.is_active = 1 AND LOWER(source_definition.team_code) = LOWER(?)
              AND COALESCE(officer.is_approved, 0) = 1
              AND (officer.password_hash IS NOT NULL OR officer.pid_hash IS NOT NULL)
              AND (officer.account_locked_until IS NULL OR officer.account_locked_until <= NOW())
          `, [copyFromSessionId, team.legacyCode]);
          if (leadId && !sourceMembers.some((member) => Number(member.officer_id) === Number(leadId))) leadId = null;
        }
        const inserted = await execute(`
          INSERT INTO eoc_session_teams
            (eoc_session_id, team_id, team_lead_officer_id, assigned_by, notes)
          VALUES (?, ?, ?, ?, ?)
        `, [sessionId, databaseTeams[0].id, leadId, auth.user.id, copyFromSessionId ? `คัดลอกจาก ครั้งที่ ${copyFromSessionId}` : "สร้างจากแม่แบบ"]);
        for (const member of sourceMembers) {
          await execute(`
            INSERT INTO eoc_team_members
              (session_team_id, officer_id, role_in_team, assigned_by)
            VALUES (?, ?, ?, ?)
          `, [inserted.insertId, member.officer_id, member.role_in_team || "สมาชิกทีม", auth.user.id]);
        }
        created.push({ teamCode: team.legacyCode, sessionTeamId: inserted.insertId, copiedMemberCount: sourceMembers.length });
      }
      await execute(`
        INSERT INTO activity_logs
          (user_id, username, action_type, target_type, target_id, eoc_session_id, description, metadata)
        VALUES (?, ?, 'data_create', 'eoc_session_template', ?, ?, ?, ?)
      `, [auth.user.id, auth.user.username, String(sessionId), sessionId, `สร้างกลุ่มภารกิจจากแม่แบบ ${created.length} กลุ่ม`, JSON.stringify({ created, copyFromSessionId })]);
      return created;
    });
    return NextResponse.json({ success: true, message: `เพิ่มกลุ่มจากแม่แบบ ${result.length} กลุ่ม`, data: result }, { status: 201 });
  } catch (error) {
    if (error.status) return NextResponse.json({ success: false, message: error.message }, { status: error.status });
    console.error("Session template error:", error);
    return publicInternalError("ไม่สามารถสร้างกลุ่มภารกิจจากแม่แบบได้");
  }
}
