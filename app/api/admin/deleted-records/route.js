import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { ARCHIVABLE_TABLES, ArchiveError, archiveErrorResponse, restoreArchivedRecord } from "@/lib/recordArchive";

// ถังขยะ: ดูรายการที่ถูกลบ และกู้คืน (เฉพาะผู้ดูแลระบบ)
export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const table = searchParams.get("table");
    const includeRestored = searchParams.get("include_restored") === "1";
    const conditions = [];
    const params = [];
    if (table && ARCHIVABLE_TABLES[table]) {
      conditions.push("table_name = ?");
      params.push(table);
    }
    if (!includeRestored) conditions.push("restored_at IS NULL");

    const rows = await query(
      `SELECT id, table_name, record_id, record_label, eoc_session_id, delete_reason,
              deleted_by, deleted_by_name, deleted_at, restored_at, restored_by
       FROM deleted_records
       ${conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""}
       ORDER BY deleted_at DESC
       LIMIT 500`,
      params
    );

    return NextResponse.json({
      success: true,
      data: rows.map((row) => ({ ...row, table_label: ARCHIVABLE_TABLES[row.table_name]?.label || row.table_name })),
      tables: Object.entries(ARCHIVABLE_TABLES).map(([value, definition]) => ({ value, label: definition.label }))
    });
  } catch (error) {
    return archiveErrorResponse(error, "ไม่สามารถโหลดรายการในถังขยะได้");
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;

  try {
    const body = await request.json().catch(() => ({}));
    const archiveId = Number(body?.id);
    if (!Number.isInteger(archiveId) || archiveId <= 0) throw new ArchiveError("ไม่พบรายการที่ต้องการกู้คืน");
    const result = await transaction((execute) => restoreArchivedRecord(execute, { archiveId, user: auth.user, request }));
    return NextResponse.json({ success: true, message: `กู้คืน "${result.label || result.id}" แล้ว`, data: result });
  } catch (error) {
    return archiveErrorResponse(error, "กู้คืนข้อมูลไม่สำเร็จ");
  }
}
