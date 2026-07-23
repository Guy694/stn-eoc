import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { appendAuditLog } from "@/lib/auditLog";
import { MASTER_DATA_CONFIG, normalizeMasterData } from "@/lib/masterDataConfig";
import { parsePositiveInteger } from "@/lib/eocValidation";

export async function PUT(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const route = await params;
    const id = parsePositiveInteger(route.id);
    const normalized = normalizeMasterData(route.type, await request.json());
    if (!id || !normalized.ok) return NextResponse.json({ success: false, message: normalized.message || "id ไม่ถูกต้อง" }, { status: 400 });
    const { config, values } = normalized;
    const old = await query(`SELECT * FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
    if (!old.length) return NextResponse.json({ success: false, message: "ไม่พบข้อมูล" }, { status: 404 });
    const duplicate = await query(`
      SELECT id FROM ${config.table}
      WHERE ${config.unique.map((field) => `${field} = ?`).join(" AND ")}
        AND id <> ?
      LIMIT 1
    `, [...config.unique.map((field) => values[field]), id]);
    if (duplicate.length) return NextResponse.json({ success: false, message: "พบข้อมูลซ้ำ" }, { status: 409 });
    values.updated_by = auth.user.id;
    await transaction(async (execute) => {
      const fields = Object.keys(values);
      await execute(`UPDATE ${config.table} SET ${fields.map((field) => `${field} = ?`).join(",")} WHERE id = ?`, [...Object.values(values), id]);
      await appendAuditLog(execute, { request, user: auth.user, action: "data_update", targetType: config.table, targetId: id, description: `แก้ไข ${config.label}`, oldValues: old[0], newValues: values });
    });
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Master catalog PUT error:", error);
    return publicInternalError("ไม่สามารถแก้ไข Master Data ได้");
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const route = await params;
    const id = parsePositiveInteger(route.id);
    const config = MASTER_DATA_CONFIG[route.type];
    if (!id || !config) return NextResponse.json({ success: false, message: "ข้อมูลคำขอไม่ถูกต้อง" }, { status: 400 });
    const old = await query(`SELECT * FROM ${config.table} WHERE id = ? LIMIT 1`, [id]);
    if (!old.length) return NextResponse.json({ success: false, message: "ไม่พบข้อมูล" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    await transaction(async (execute) => {
      await execute(`UPDATE ${config.table} SET is_active = 0, updated_by = ? WHERE id = ?`, [auth.user.id, id]);
      await appendAuditLog(execute, { request, user: auth.user, action: "data_delete", targetType: config.table, targetId: id, description: `เก็บ ${config.label} เข้าคลัง`, oldValues: old[0], newValues: { is_active: false }, reason: body.reason || "archive" });
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Master catalog DELETE error:", error);
    return publicInternalError("ไม่สามารถเก็บ Master Data เข้าคลังได้");
  }
}
