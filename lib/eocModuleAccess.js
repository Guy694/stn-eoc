// สิทธิ์ต่อเมนูของเหตุการณ์ (ฝั่งเซิร์ฟเวอร์): ทุกคนที่ได้รับมอบหมายในเหตุการณ์ดูได้
// บันทึก/แก้ไขได้เฉพาะกลุ่มภารกิจเจ้าของเมนู (ค่าที่แอดมินตั้ง หรือค่าเริ่มต้นใน lib/eocModulePermissions.js) และแอดมิน/ผู้บัญชาการ
import { NextResponse } from "next/server";
import { getOperationalSessionAccess } from "@/lib/eocOperationalAccess";
import { moduleEditAccess, readOnlyMessage } from "@/lib/eocModulePermissions";
import { ownersFor } from "@/lib/eocModuleOwners";

export async function getModuleAccess(user, sessionId, moduleKey) {
  const access = await getOperationalSessionAccess(user, sessionId);
  if (!access.ok) return access;
  const owners = await ownersFor(access.session.eoc_type, moduleKey);
  const edit = moduleEditAccess({ role: user.role, memberships: access.memberships, sessionActive: access.canOperate, moduleKey, owners });
  const message = readOnlyMessage(moduleKey, edit.reason, owners);
  return {
    ...access,
    canEdit: edit.canEdit,
    reason: edit.reason,
    readOnlyMessage: message,
    permissions: { can_edit: edit.canEdit, read_only_reason: edit.reason, read_only_message: message }
  };
}

// คืน response ปฏิเสธถ้าบันทึกไม่ได้ (ใช้ใน POST/PUT/PATCH) — null = ผ่าน
export async function requireModuleEdit(user, sessionId, moduleKey) {
  if (!sessionId) {
    return { response: NextResponse.json({ success: false, message: "ไม่ระบุเหตุการณ์" }, { status: 400 }) };
  }
  const access = await getModuleAccess(user, sessionId, moduleKey);
  if (!access.ok) return { response: NextResponse.json({ success: false, message: access.message }, { status: access.status }) };
  if (!access.canEdit) {
    return { response: NextResponse.json({ success: false, message: access.readOnlyMessage }, { status: access.reason === "closed" ? 409 : 403 }) };
  }
  return { access };
}

// สำหรับ GET: สิทธิ์ของผู้ใช้ในเมนูนี้ (ไม่ปฏิเสธ — ถ้าไม่ได้รับมอบหมายในเหตุการณ์ให้ถือว่าดูอย่างเดียว)
export async function modulePermissions(user, sessionId, moduleKey) {
  if (!sessionId) return { can_edit: false, read_only_reason: null, read_only_message: null };
  const access = await getModuleAccess(user, sessionId, moduleKey).catch(() => null);
  if (!access?.ok) return { can_edit: false, read_only_reason: "not_assigned", read_only_message: "ดูได้อย่างเดียว — คุณไม่ได้รับมอบหมายในเหตุการณ์นี้" };
  return access.permissions;
}
