import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { appendAuditLog } from "@/lib/auditLog";
import { parsePositiveInteger, validatePopulationInput } from "@/lib/eocValidation";

export async function PUT(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const id = parsePositiveInteger((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "id ไม่ถูกต้อง" }, { status: 400 });
    const validation = validatePopulationInput(await request.json());
    if (!validation.ok) return NextResponse.json({ success: false, message: validation.message }, { status: 400 });
    const rows = await query(`SELECT * FROM area_population WHERE id = ? AND is_active = 1 LIMIT 1`, [id]);
    if (!rows.length) return NextResponse.json({ success: false, message: "ไม่พบข้อมูลประชากร" }, { status: 404 });
    const data = validation.value;
    const duplicate = await query(`
      SELECT id FROM area_population
      WHERE province_code = ? AND district_name = ? AND population_scope = ?
        AND source_name = ? AND is_active = 1 AND id <> ?
      LIMIT 1
    `, [data.province_code, data.district_name, data.population_scope, data.source_name, id]);
    if (duplicate.length) return NextResponse.json({ success: false, message: "มีข้อมูลประชากรจากแหล่งนี้อยู่แล้ว" }, { status: 409 });
    await transaction(async (execute) => {
      await execute(`
        UPDATE area_population SET
          province_code = ?, district_code = ?, district_name = ?, male_population = ?,
          female_population = ?, population = ?, population_year = ?, population_scope = ?,
          source_name = ?, source_updated_at = ?, notes = ?, updated_by = ?
        WHERE id = ?
      `, [...Object.values(data), auth.user.id, id]);
      await appendAuditLog(execute, {
        request, user: auth.user, action: "data_update", targetType: "area_population",
        targetId: id, description: `แก้ไขประชากร ${data.district_name}`,
        oldValues: rows[0], newValues: data,
      });
    });
    return NextResponse.json({ success: true, data: { ...data, id } });
  } catch (error) {
    console.error("Population master PUT error:", error);
    return publicInternalError("ไม่สามารถแก้ไขข้อมูลประชากรได้");
  }
}

export async function DELETE(request, { params }) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const id = parsePositiveInteger((await params).id);
    if (!id) return NextResponse.json({ success: false, message: "id ไม่ถูกต้อง" }, { status: 400 });
    const rows = await query(`SELECT * FROM area_population WHERE id = ? AND is_active = 1 LIMIT 1`, [id]);
    if (!rows.length) return NextResponse.json({ success: false, message: "ไม่พบข้อมูลประชากร" }, { status: 404 });
    const body = await request.json().catch(() => ({}));
    await transaction(async (execute) => {
      await execute(`UPDATE area_population SET is_active = 0, updated_by = ? WHERE id = ?`, [auth.user.id, id]);
      await appendAuditLog(execute, {
        request, user: auth.user, action: "data_delete", targetType: "area_population",
        targetId: id, description: `เก็บข้อมูลประชากร ${rows[0].district_name} เข้าคลัง`,
        oldValues: rows[0], newValues: { is_active: false }, reason: body.reason || "archive",
      });
    });
    return NextResponse.json({ success: true, message: "เก็บข้อมูลเข้าคลังแล้ว" });
  } catch (error) {
    console.error("Population master DELETE error:", error);
    return publicInternalError("ไม่สามารถเก็บข้อมูลเข้าคลังได้");
  }
}

