const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');

const REPORT_PATH = path.join(process.cwd(), 'tmp_eoc_satun_import_report.json');
const SOURCE_FILE = 'ค่ำสั่ง eoc สตูล.pdf';

const chairOverrides = {
  ACTIVE_SURV: { givenName: 'อมรรัตน์', familyName: 'พันธ์คีรี', roleInTeam: 'ประธานกรรมการ' },
  EOC_MGMT: { givenName: 'วรายุส', familyName: 'วรรณวิไล', roleInTeam: 'ประธานกรรมการ' },
};

const skippedLegacyTeams = new Set(['MCAT', 'MEDICAL', 'SHELTER']);

function normalizeName(value) {
  return String(value || '').replace(/\s+/g, '').trim();
}

function selectChair(teamCode, officers) {
  const override = chairOverrides[teamCode];
  if (override) return override;

  return officers.find((officer) => officer.teamCode === teamCode
    && (officer.committeeRole === 'ประธานกรรมการ' || officer.committeeRole === 'ผู้บัญชาการเหตุการณ์'));
}

async function findOfficerByName(connection, givenName, familyName) {
  const [rows] = await connection.execute(
    `SELECT id, username, title, given_name, family_name
     FROM officer
     WHERE REPLACE(COALESCE(given_name, ''), ' ', '') = ?
       AND REPLACE(COALESCE(family_name, ''), ' ', '') = ?
     LIMIT 1`,
    [normalizeName(givenName), normalizeName(familyName)]
  );
  return rows[0] || null;
}

async function getActiveSession(connection, requestedSessionId) {
  if (requestedSessionId) {
    const [rows] = await connection.execute(
      `SELECT id, eoc_type, session_number, status
       FROM eoc_sessions
       WHERE id = ?`,
      [requestedSessionId]
    );
    if (!rows.length) throw new Error(`ไม่พบ EOC session id ${requestedSessionId}`);
    return rows[0];
  }

  const [rows] = await connection.execute(
    `SELECT id, eoc_type, session_number, status
     FROM eoc_sessions
     WHERE status = 'active'
     ORDER BY opened_at DESC
     LIMIT 1`
  );
  if (!rows.length) throw new Error('ไม่พบ active EOC session');
  return rows[0];
}

async function upsertSessionTeam(connection, sessionId, teamId, leadOfficerId, assignedBy) {
  const [existing] = await connection.execute(
    `SELECT id FROM eoc_session_teams
     WHERE eoc_session_id = ? AND team_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [sessionId, teamId]
  );

  if (existing.length) {
    await connection.execute(
      `UPDATE eoc_session_teams
       SET team_lead_officer_id = ?,
           assigned_by = COALESCE(assigned_by, ?),
           notes = ?,
           is_active = 1,
           updated_at = NOW()
       WHERE id = ?`,
      [leadOfficerId, assignedBy, `นำเข้าจาก ${SOURCE_FILE}`, existing[0].id]
    );
    return { id: existing[0].id, action: 'updated' };
  }

  const [result] = await connection.execute(
    `INSERT INTO eoc_session_teams
     (eoc_session_id, team_id, team_lead_officer_id, assigned_by, notes, is_active)
     VALUES (?, ?, ?, ?, ?, 1)`,
    [sessionId, teamId, leadOfficerId, assignedBy, `นำเข้าจาก ${SOURCE_FILE}`]
  );
  return { id: result.insertId, action: 'created' };
}

async function upsertMember(connection, sessionTeamId, officerId, roleInTeam, assignedBy) {
  const [existing] = await connection.execute(
    `SELECT id FROM eoc_team_members
     WHERE session_team_id = ? AND officer_id = ?
     ORDER BY id DESC
     LIMIT 1`,
    [sessionTeamId, officerId]
  );

  if (existing.length) {
    await connection.execute(
      `UPDATE eoc_team_members
       SET role_in_team = ?,
           assigned_by = COALESCE(assigned_by, ?),
           removed_at = NULL,
           removed_by = NULL,
           is_active = 1,
           notes = ?,
           updated_at = NOW()
       WHERE id = ?`,
      [roleInTeam || 'กรรมการ', assignedBy, `นำเข้าจาก ${SOURCE_FILE}`, existing[0].id]
    );
    return { action: 'updated', id: existing[0].id };
  }

  const [result] = await connection.execute(
    `INSERT INTO eoc_team_members
     (session_team_id, officer_id, role_in_team, assigned_by, is_active, notes)
     VALUES (?, ?, ?, ?, 1, ?)`,
    [sessionTeamId, officerId, roleInTeam || 'กรรมการ', assignedBy, `นำเข้าจาก ${SOURCE_FILE}`]
  );
  return { action: 'created', id: result.insertId };
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');
  const sessionArg = process.argv.find((arg) => arg.startsWith('--session-id='));
  const requestedSessionId = sessionArg ? Number(sessionArg.split('=')[1]) : null;

  if (!fs.existsSync(REPORT_PATH)) {
    throw new Error(`ไม่พบรายงานนำเข้า ${REPORT_PATH}`);
  }

  const report = JSON.parse(fs.readFileSync(REPORT_PATH, 'utf8'));
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '123456',
    database: process.env.DB_NAME || 'stneoc',
    port: Number(process.env.DB_PORT || 3306),
    charset: 'utf8mb4',
  });

  const assignmentReport = {
    dryRun,
    sourceFile: SOURCE_FILE,
    session: null,
    teams: [],
    members: [],
    warnings: [],
  };

  try {
    await connection.beginTransaction();

    const session = await getActiveSession(connection, requestedSessionId);
    assignmentReport.session = session;

    const [adminRows] = await connection.execute(
      `SELECT id FROM officer WHERE role = 'admin' ORDER BY id LIMIT 1`
    );
    const assignedBy = adminRows[0]?.id || null;

    for (const team of report.teams) {
      if (skippedLegacyTeams.has(team.code)) continue;

      const [teamRows] = await connection.execute(
        `SELECT id, team_code, team_name_th FROM eoc_teams WHERE team_code = ? LIMIT 1`,
        [team.code]
      );
      if (!teamRows.length) {
        assignmentReport.warnings.push(`ไม่พบทีม ${team.code}`);
        continue;
      }

      const chair = selectChair(team.code, report.officers);
      if (!chair) {
        assignmentReport.warnings.push(`ไม่พบประธานสำหรับทีม ${team.code}`);
        continue;
      }

      const leadOfficer = await findOfficerByName(connection, chair.givenName, chair.familyName);
      if (!leadOfficer) {
        assignmentReport.warnings.push(`ไม่พบผู้ใช้หัวหน้าทีม ${team.code}: ${chair.givenName} ${chair.familyName}`);
        continue;
      }

      const sessionTeam = await upsertSessionTeam(
        connection,
        session.id,
        teamRows[0].id,
        leadOfficer.id,
        assignedBy
      );

      assignmentReport.teams.push({
        action: sessionTeam.action,
        sessionTeamId: sessionTeam.id,
        teamCode: team.code,
        teamName: team.th,
        leadOfficerId: leadOfficer.id,
        leadUsername: leadOfficer.username,
        leadName: `${leadOfficer.title || ''}${leadOfficer.given_name} ${leadOfficer.family_name}`.trim(),
      });

      const teamOfficers = report.officers.filter((officer) => officer.teamCode === team.code);
      const hasChairInTeamList = teamOfficers.some((officer) => normalizeName(officer.givenName) === normalizeName(chair.givenName)
        && normalizeName(officer.familyName) === normalizeName(chair.familyName));

      if (!hasChairInTeamList) {
        teamOfficers.unshift({
          ...chair,
          teamCode: team.code,
          committeeRole: chair.roleInTeam || 'ประธานกรรมการ',
        });
      }

      for (const officer of teamOfficers) {
        const memberOfficer = await findOfficerByName(connection, officer.givenName, officer.familyName);
        if (!memberOfficer) {
          assignmentReport.warnings.push(`ไม่พบผู้ใช้สมาชิก ${team.code}: ${officer.givenName} ${officer.familyName}`);
          continue;
        }

        const memberResult = await upsertMember(
          connection,
          sessionTeam.id,
          memberOfficer.id,
          officer.committeeRole || officer.roleInTeam || 'กรรมการ',
          assignedBy
        );

        assignmentReport.members.push({
          action: memberResult.action,
          teamCode: team.code,
          sessionTeamId: sessionTeam.id,
          officerId: memberOfficer.id,
          username: memberOfficer.username,
          name: `${memberOfficer.title || ''}${memberOfficer.given_name} ${memberOfficer.family_name}`.trim(),
          roleInTeam: officer.committeeRole || officer.roleInTeam || 'กรรมการ',
        });
      }
    }

    if (dryRun) {
      await connection.rollback();
    } else {
      await connection.commit();
    }
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    await connection.end();
  }

  const outPath = path.join(process.cwd(), 'tmp_eoc_satun_session_assignment_report.json');
  fs.writeFileSync(outPath, JSON.stringify(assignmentReport, null, 2), 'utf8');

  console.log(JSON.stringify({
    dryRun,
    session: assignmentReport.session,
    teams: {
      created: assignmentReport.teams.filter((item) => item.action === 'created').length,
      updated: assignmentReport.teams.filter((item) => item.action === 'updated').length,
      total: assignmentReport.teams.length,
    },
    members: {
      created: assignmentReport.members.filter((item) => item.action === 'created').length,
      updated: assignmentReport.members.filter((item) => item.action === 'updated').length,
      total: assignmentReport.members.length,
    },
    warnings: assignmentReport.warnings.length,
    reportPath: outPath,
  }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
