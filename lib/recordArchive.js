import { NextResponse } from "next/server";
import { appendAuditLog } from "@/lib/auditLog";
import { getPool, transaction } from "@/lib/db";

// "ลบแบบกู้คืนได้" สำหรับข้อมูลที่ใช้ตัดสินใจในห้องประชุม
// - เก็บสำเนาทั้งแถวไว้ในตาราง deleted_records (ถังขยะ) พร้อมผู้ลบ เวลา และเหตุผล
// - ลบแถวจากตารางหลัก (ทำให้ query อ่านข้อมูลเดิมทั้งระบบไม่ต้องแก้)
// - บันทึก activity_logs ทุกครั้ง
// - กู้คืนได้ด้วย restoreArchivedRecord() (ใส่กลับด้วย id เดิม)

export const MIN_REASON_LENGTH = 5;

export const ARCHIVABLE_TABLES = {
  eoc_it_tickets: {
    label: "รายงาน IT support",
    sessionColumn: "eoc_session_id",
    describe: (row) => `${row.ticket_no || `#${row.id}`} ${row.title || ""}`.trim()
  },
  shelter_centers: {
    label: "ศูนย์พักพิง",
    describe: (row) => row.sheltername || `#${row.id}`
  },
  vulnerable_group_baselines: {
    label: "ฐานข้อมูลกลุ่มเปราะบาง",
    describe: (row) => [row.village, row.tambon && `ต.${row.tambon}`, row.district && `อ.${row.district}`].filter(Boolean).join(" ")
  },
  vulnerable_groups: {
    label: "กลุ่มเปราะบางในเหตุการณ์",
    sessionColumn: "session_id",
    describe: (row) => [row.village, row.tambon && `ต.${row.tambon}`, row.district && `อ.${row.district}`].filter(Boolean).join(" ")
  },
  public_incident_reports: {
    label: "รายงานจากประชาชน",
    describe: (row) => `${row.first_name || ""} ${row.last_name || ""}`.trim() || `#${row.id}`
  }
};

export class ArchiveError extends Error {
  constructor(message, status = 400) {
    super(message);
    this.status = status;
  }
}

function pad(value) {
  return String(value).padStart(2, "0");
}

// mysql2 คืน DATETIME เป็น Date (เวลาท้องถิ่น) — เก็บกลับเป็นรูปแบบ MySQL เพื่อใส่คืนได้ตรงค่าเดิม
export function toMysqlValue(value) {
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null;
    return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())} ${pad(value.getHours())}:${pad(value.getMinutes())}:${pad(value.getSeconds())}`;
  }
  if (Buffer.isBuffer(value)) return value.toString("utf8");
  if (value !== null && typeof value === "object") return JSON.stringify(value);
  return value;
}

export function serializeRow(row) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, toMysqlValue(value)]));
}

export function normalizeReason(reason) {
  const text = String(reason ?? "").trim().replace(/\s+/g, " ");
  if (text.length < MIN_REASON_LENGTH) {
    throw new ArchiveError(`กรุณาระบุเหตุผลการลบอย่างน้อย ${MIN_REASON_LENGTH} ตัวอักษร`);
  }
  return text.slice(0, 500);
}

function displayName(user) {
  const fullName = [user.givenName, user.familyName].filter(Boolean).join(" ");
  return (fullName || user.username || "").slice(0, 150) || null;
}

function tableDefinition(table) {
  const definition = ARCHIVABLE_TABLES[table];
  if (!definition) throw new ArchiveError("ไม่รองรับการลบข้อมูลประเภทนี้", 500);
  return definition;
}

/**
 * ย้ายข้อมูลหนึ่งแถวเข้าถังขยะแล้วลบออกจากตารางหลัก (ใน transaction เดียว)
 * @param {(sql: string, params: any[]) => Promise<any>} execute
 * @param {{ table: string, id: string|number, reason: string, user: object, request?: Request,
 *          beforeDelete?: (row: object, execute: Function) => Promise<void> }} options
 */
export async function archiveAndDelete(execute, { table, id, reason, user, request, beforeDelete }) {
  const definition = tableDefinition(table);
  const cleanReason = normalizeReason(reason);

  const rows = await execute(`SELECT * FROM \`${table}\` WHERE id = ? FOR UPDATE`, [id]);
  const row = rows[0];
  if (!row) throw new ArchiveError("ไม่พบข้อมูลที่ต้องการลบ (อาจถูกลบไปแล้ว)", 404);

  if (beforeDelete) await beforeDelete(row, execute);

  const label = definition.describe(row);
  const sessionId = definition.sessionColumn ? row[definition.sessionColumn] ?? null : null;
  const snapshot = serializeRow(row);

  const inserted = await execute(
    `INSERT INTO deleted_records
       (table_name, record_id, record_label, record_data, eoc_session_id, delete_reason, deleted_by, deleted_by_name)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [table, String(row.id), label.slice(0, 255), JSON.stringify(snapshot), sessionId, cleanReason, user.id, displayName(user)]
  );
  await execute(`DELETE FROM \`${table}\` WHERE id = ?`, [id]);

  await appendAuditLog(execute, {
    request,
    user,
    action: "data_delete",
    targetType: table,
    targetId: row.id,
    sessionId,
    description: `ลบ${definition.label}: ${label}`,
    oldValues: snapshot,
    reason: cleanReason,
    metadata: { archive_id: inserted.insertId }
  });

  return { archiveId: inserted.insertId, label };
}

/**
 * กู้คืนข้อมูลจากถังขยะ (ใส่กลับด้วย id เดิม เพื่อให้ข้อมูลที่อ้างอิงอยู่ยังเชื่อมกันได้)
 */
export async function restoreArchivedRecord(execute, { archiveId, user, request }) {
  const rows = await execute(`SELECT * FROM deleted_records WHERE id = ? FOR UPDATE`, [archiveId]);
  const archived = rows[0];
  if (!archived) throw new ArchiveError("ไม่พบรายการในถังขยะ", 404);
  if (archived.restored_at) throw new ArchiveError("รายการนี้ถูกกู้คืนไปแล้ว", 409);

  const table = archived.table_name;
  const definition = tableDefinition(table);
  const data = typeof archived.record_data === "string" ? JSON.parse(archived.record_data) : archived.record_data;

  const existing = await execute(`SELECT id FROM \`${table}\` WHERE id = ?`, [data.id]);
  if (existing.length) throw new ArchiveError("มีข้อมูลรหัสเดียวกันอยู่ในระบบแล้ว จึงกู้คืนไม่ได้", 409);

  // ใส่กลับเฉพาะคอลัมน์ที่ยังมีอยู่ในตาราง (กันกรณีโครงสร้างตารางเปลี่ยนหลังลบ) และข้ามคอลัมน์ที่คำนวณอัตโนมัติ
  const columns = await execute(
    `SELECT COLUMN_NAME, EXTRA FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
    [table]
  );
  const writable = new Set(columns.filter((column) => !/GENERATED/i.test(column.EXTRA || "")).map((column) => column.COLUMN_NAME));
  const keys = Object.keys(data).filter((key) => writable.has(key));
  if (!keys.includes("id")) throw new ArchiveError("ข้อมูลในถังขยะไม่สมบูรณ์", 500);

  await execute(
    `INSERT INTO \`${table}\` (${keys.map((key) => `\`${key}\``).join(", ")}) VALUES (${keys.map(() => "?").join(", ")})`,
    keys.map((key) => data[key])
  );
  await execute(`UPDATE deleted_records SET restored_at = NOW(), restored_by = ? WHERE id = ?`, [user.id, archiveId]);

  await appendAuditLog(execute, {
    request,
    user,
    action: "data_update",
    targetType: table,
    targetId: data.id,
    sessionId: archived.eoc_session_id,
    description: `กู้คืน${definition.label}: ${archived.record_label || data.id}`,
    newValues: data,
    metadata: { archive_id: archived.id }
  });

  return { table, id: data.id, label: archived.record_label };
}

/** อ่าน id (query) และเหตุผล (JSON body หรือ query ?reason=) จากคำขอ DELETE */
export async function readDeleteRequest(request) {
  const { searchParams } = new URL(request.url);
  let body = {};
  try {
    body = await request.json();
  } catch {
    body = {};
  }
  return {
    id: searchParams.get("id") || body?.id || null,
    reason: body?.reason ?? searchParams.get("reason") ?? ""
  };
}

export function archiveErrorResponse(error, fallbackMessage) {
  if (error instanceof ArchiveError) {
    return NextResponse.json({ success: false, message: error.message }, { status: error.status });
  }
  if (error?.code === "ER_NO_SUCH_TABLE" && /deleted_records/.test(error.message || "")) {
    return NextResponse.json(
      { success: false, message: "ยังไม่ได้สร้างตารางถังขยะ กรุณาให้ผู้ดูแลระบบรัน npm run db:migrate" },
      { status: 503 }
    );
  }
  console.error(fallbackMessage, error);
  return NextResponse.json({ success: false, message: fallbackMessage }, { status: 500 });
}

/**
 * ตัวช่วยสำหรับ route DELETE: อ่านคำขอ → ลบแบบกู้คืนได้ → ตอบกลับ
 */
export async function handleArchiveDelete(request, user, { table, beforeDelete, successMessage }) {
  try {
    const { id, reason } = await readDeleteRequest(request);
    if (!id) throw new ArchiveError("ไม่พบรหัสข้อมูลที่ต้องการลบ");
    const result = await transaction((execute) => archiveAndDelete(execute, { table, id, reason, user, request, beforeDelete }));
    return NextResponse.json({
      success: true,
      message: successMessage || `ย้าย "${result.label}" ไปถังขยะแล้ว กู้คืนได้จากเมนูถังขยะ`,
      data: result
    });
  } catch (error) {
    return archiveErrorResponse(error, "เกิดข้อผิดพลาดในการลบข้อมูล");
  }
}

/**
 * บันทึกประวัติการเพิ่ม/แก้ไข (ไม่ทำให้การบันทึกข้อมูลหลักล้มเหลวถ้าบันทึกประวัติไม่สำเร็จ)
 */
export async function recordChange({ request, user, action, table, id, description, sessionId = null, oldValues = null, newValues = null }) {
  try {
    await appendAuditLog(async (sql, params) => {
      const [result] = await getPool().execute(sql, params);
      return result;
    }, {
      request,
      user,
      action,
      targetType: table,
      targetId: id ?? "-",
      sessionId,
      description,
      oldValues: oldValues ? serializeRow(oldValues) : null,
      newValues: newValues ? serializeRow(newValues) : null
    });
  } catch (error) {
    console.error("[audit] บันทึกประวัติไม่สำเร็จ:", error.message);
  }
}
