import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { appendAuditLog } from "@/lib/auditLog";
import { getOperationalSessionAccess, notifySessionTeam } from "@/lib/eocOperationalAccess";
import { parsePositiveInteger, validateMissionInput } from "@/lib/eocValidation";

export const RESOURCE_CONFIG = {
  missions: {
    table: "missions",
    order: "COALESCE(due_at, created_at) DESC, id DESC",
    required: ["mission_code", "mission_type", "mission_name"],
    fields: [
      "reporting_cycle_id", "report_date", "mission_code", "mission_type", "mission_name",
      "area", "assigned_team", "assigned_team_id", "responsible_agency", "priority", "due_at",
      "status", "progress_percent", "ordered_by", "responsible_person",
      "responsible_officer_id", "evidence_file_asset_id", "remarks",
    ],
  },
  meetings: {
    table: "meeting_notes",
    order: "meeting_date DESC, meeting_time DESC, id DESC",
    required: ["meeting_date", "meeting_time"],
    fields: [
      "reporting_cycle_id", "meeting_date", "meeting_time", "chairperson", "attendees",
      "agenda", "situation_summary", "key_issues", "decisions", "orders",
      "responsible_team", "due_date", "followup_status", "next_meeting_datetime",
      "meeting_status", "attachment",
    ],
    createdBy: true,
  },
  decisions: {
    table: "decision_logs",
    order: "decision_datetime DESC, id DESC",
    required: ["decision_datetime", "issue", "decision"],
    fields: [
      "reporting_cycle_id", "meeting_id", "decision_datetime", "decision_maker", "issue",
      "supporting_data", "decision", "assigned_team", "followup_due", "status",
      "attachment", "linked_mission_id",
    ],
    createdBy: true,
  },
};

function normalizeJsonFields(type, values) {
  if (type !== "meetings") return values;
  return {
    ...values,
    attendees: values.attendees == null ? null : JSON.stringify(values.attendees),
    key_issues: values.key_issues == null ? null : JSON.stringify(values.key_issues),
    decisions: values.decisions == null ? null : JSON.stringify(values.decisions),
  };
}

function pickValues(config, body) {
  return Object.fromEntries(config.fields.filter((field) => body[field] !== undefined).map((field) => [field, body[field]]));
}

function validateResource(type, config, values) {
  if (config.required.some((field) => values[field] === undefined || values[field] === null || String(values[field]).trim() === "")) {
    return "กรุณากรอกข้อมูลที่จำเป็นให้ครบ";
  }
  if (type === "missions") {
    const validation = validateMissionInput(values);
    if (!validation.ok) return validation.message;
  }
  return null;
}

async function insertRecord(execute, config, sessionId, values, userId) {
  const fields = ["session_id", ...Object.keys(values)];
  const params = [sessionId, ...Object.values(values)];
  if (config.createdBy) {
    fields.push("created_by");
    params.push(userId);
  }
  return execute(`INSERT INTO ${config.table} (${fields.join(", ")}) VALUES (${fields.map(() => "?").join(", ")})`, params);
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { searchParams } = new URL(request.url);
    const type = searchParams.get("type");
    const config = RESOURCE_CONFIG[type];
    const sessionId = parsePositiveInteger(searchParams.get("session_id"));
    if (!config || !sessionId) return NextResponse.json({ success: false, message: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    const access = await getOperationalSessionAccess(auth.user, sessionId, "flood");
    if (!access.ok) return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    const page = Math.max(Number(searchParams.get("page")) || 1, 1);
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 50, 1), 100);
    const search = searchParams.get("search")?.trim();
    const status = searchParams.get("status")?.trim();
    const conditions = ["session_id = ?"];
    const params = [sessionId];
    if (status) {
      conditions.push("status = ?");
      params.push(status);
    }
    if (search) {
      const searchFields = type === "missions"
        ? ["mission_code", "mission_name", "area"]
        : type === "meetings" ? ["agenda", "situation_summary", "orders"] : ["issue", "decision"];
      conditions.push(`(${searchFields.map((field) => `${field} LIKE ?`).join(" OR ")})`);
      searchFields.forEach(() => params.push(`%${search}%`));
    }
    const count = await query(`SELECT COUNT(*) AS total FROM ${config.table} WHERE ${conditions.join(" AND ")}`, params);
    const rows = await query(`
      SELECT * FROM ${config.table}
      WHERE ${conditions.join(" AND ")}
      ORDER BY ${config.order}
      LIMIT ${limit} OFFSET ${(page - 1) * limit}
    `, params);
    return NextResponse.json({
      success: true,
      data: rows,
      permissions: { canView: true, canOperate: access.canOperate, canVerify: access.canVerify },
      pagination: { page, limit, total: Number(count[0]?.total || 0) },
      meta: { source_type: "database", source_name: config.table, session_id: sessionId, generated_at: new Date().toISOString() },
    });
  } catch (error) {
    console.error("Operational resource GET error:", error);
    return publicInternalError("ไม่สามารถโหลดข้อมูลได้");
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const body = await request.json();
    const config = RESOURCE_CONFIG[body.type];
    const sessionId = parsePositiveInteger(body.session_id);
    if (!config || !sessionId) return NextResponse.json({ success: false, message: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    const access = await getOperationalSessionAccess(auth.user, sessionId, "flood");
    if (!access.ok) return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    if (!access.canOperate) return NextResponse.json({ success: false, message: "Session ปิดแล้ว งานปฏิบัติการอยู่ในโหมดอ่านอย่างเดียว" }, { status: 403 });
    const values = normalizeJsonFields(body.type, pickValues(config, body));
    const validationError = validateResource(body.type, config, values);
    if (validationError) return NextResponse.json({ success: false, message: validationError }, { status: 400 });

    const created = await transaction(async (execute) => {
      const result = await insertRecord(execute, config, sessionId, values, auth.user.id);
      let decisionId = null;
      let missionId = null;
      if (body.type === "meetings" && body.create_decision) {
        const linked = body.create_decision;
        if (!linked.issue || !linked.decision) throw new Error("INVALID_LINKED_DECISION");
        const decision = await execute(`
          INSERT INTO decision_logs
            (session_id, meeting_id, decision_datetime, decision_maker, issue, supporting_data,
             decision, assigned_team, followup_due, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
        `, [
          sessionId, result.insertId, linked.decision_datetime || `${values.meeting_date} ${values.meeting_time}`,
          linked.decision_maker || values.chairperson || null, linked.issue, linked.supporting_data || null,
          linked.decision, linked.assigned_team || values.responsible_team || null,
          linked.followup_due || values.due_date || null, auth.user.id,
        ]);
        decisionId = decision.insertId;
        if (body.create_mission) {
          const missionValidation = validateMissionInput(body.create_mission);
          if (!missionValidation.ok) throw new Error("INVALID_LINKED_MISSION");
          const mission = await execute(`
            INSERT INTO missions
              (session_id, mission_code, mission_type, mission_name, area, assigned_team,
               assigned_team_id, responsible_agency, priority, due_at, status,
               progress_percent, responsible_person, responsible_officer_id,
               source_meeting_id, source_decision_id, remarks)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `, [
            sessionId, body.create_mission.mission_code, body.create_mission.mission_type,
            body.create_mission.mission_name, body.create_mission.area || null,
            body.create_mission.assigned_team || values.responsible_team || null,
            body.create_mission.assigned_team_id || null, body.create_mission.responsible_agency || null,
            body.create_mission.priority || "ปานกลาง", body.create_mission.due_at || values.due_date || null,
            body.create_mission.status || "assigned", body.create_mission.progress_percent || 0,
            body.create_mission.responsible_person || null, body.create_mission.responsible_officer_id || null,
            result.insertId, decisionId, body.create_mission.remarks || null,
          ]);
          missionId = mission.insertId;
          await execute(`UPDATE decision_logs SET linked_mission_id = ? WHERE id = ?`, [missionId, decisionId]);
        }
      }
      await appendAuditLog(execute, {
        request, user: auth.user, action: "data_create", targetType: config.table,
        targetId: result.insertId, sessionId, sessionTeamId: values.assigned_team_id || null,
        description: `สร้างข้อมูล ${config.table}`,
        newValues: { ...values, linked_decision_id: decisionId, linked_mission_id: missionId },
      });
      const targetUrl = `/eoc/flood/management/${body.type}?sessionId=${sessionId}`;
      await notifySessionTeam(execute, {
        sessionTeamId: values.assigned_team_id || body.create_mission?.assigned_team_id,
        sessionId, type: body.type === "missions" ? "mission_assigned" : `${body.type}_created`,
        title: body.type === "missions" ? `ภารกิจใหม่: ${values.mission_name}` : `มี${body.type === "meetings" ? "การประชุม" : "ข้อสั่งการ"}ใหม่`,
        detail: values.mission_name || values.agenda || values.issue,
        targetUrl, relatedType: config.table, relatedId: result.insertId, excludeUserId: auth.user.id,
      });
      return { id: result.insertId, decision_id: decisionId, mission_id: missionId };
    });
    return NextResponse.json({ success: true, ...created }, { status: 201 });
  } catch (error) {
    if (["INVALID_LINKED_DECISION", "INVALID_LINKED_MISSION"].includes(error.message)) {
      return NextResponse.json({ success: false, message: "ข้อมูล Decision หรือ Mission ที่เชื่อมโยงไม่ครบถ้วน" }, { status: 400 });
    }
    console.error("Operational resource POST error:", error);
    return publicInternalError("ไม่สามารถบันทึกข้อมูลได้");
  }
}
