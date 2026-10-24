// ประวัติการเปลี่ยนสิทธิ์/สถานะบัญชีโดยผู้ดูแล (ใช้ในสรุปความปลอดภัยรายสัปดาห์)
// บันทึกไม่ได้ (เช่น ยังไม่ได้ migrate) ไม่ทำให้การแก้ไขบัญชีล้ม
import { query } from "@/lib/db";
import { getClientIp } from "@/lib/clientIp";
export { SECURITY_AUDIT_LABELS } from "@/lib/securityAuditLabels";


/** รายการเหตุที่เกิดจากการแก้ไขบัญชีหนึ่งครั้ง */
export function officerChangeActions(before = {}, body = {}) {
  const actions = [];
  if (body.role && body.role !== before.role) actions.push({ action: "role_change", detail: `${before.role || "-"} → ${body.role}` });
  if (body.is_approved !== undefined) {
    const was = Number(before.is_approved) === 1;
    const now = Number(body.is_approved) === 1;
    if (!was && now) actions.push({ action: "approval_granted", detail: body.role || before.role || null });
    if (was && !now) actions.push({ action: "approval_revoked", detail: null });
  }
  if (body.password) actions.push({ action: "password_reset", detail: null });
  return actions;
}

export async function recordSecurityAudit({ request, actor, action, targetId = null, targetUsername = null, detail = null }) {
  try {
    await query(
      `INSERT INTO security_audit_log (actor_id, actor_username, action, target_id, target_username, detail, ip_address)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [actor?.id ?? null, actor?.username ?? null, action, targetId, targetUsername, detail ? String(detail).slice(0, 500) : null, request ? getClientIp(request) : null]
    );
    return true;
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") console.warn("[security-audit]", error?.message || error);
    return false;
  }
}
