import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { recordChange } from "@/lib/recordArchive";
import { getProviderIdConfig, getProviderIdConfigError } from "@/lib/providerId";

export const dynamic = "force-dynamic";

const mask = (value) => (value ? `${String(value).slice(0, 4)}••••${String(value).slice(-2)}` : null);

// สถานะการเชื่อมบัญชี Provider ID ของเจ้าหน้าที่ที่เข้าสู่ระบบอยู่
export async function GET(request) {
  const auth = await requireAuth(request);
  if (!auth.success) return auth.response;
  const enabled = !getProviderIdConfigError(getProviderIdConfig(request));
  try {
    const rows = await query(
      `SELECT provider_account_id, provider_id, provider_hcode, provider_org, provider_linked_at FROM officer WHERE id = ?`,
      [auth.user.id]
    );
    const row = rows[0] || {};
    return NextResponse.json({
      success: true,
      enabled,
      linked: Boolean(row.provider_account_id),
      provider_id: mask(row.provider_id),
      organization: row.provider_org || null,
      hcode: row.provider_hcode || null,
      linked_at: row.provider_linked_at || null
    });
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") return NextResponse.json({ success: true, enabled: false, linked: false, migration_required: true });
    console.error("Provider ID link status error:", error);
    return publicInternalError("โหลดสถานะ Provider ID ไม่สำเร็จ");
  }
}

// ยกเลิกการเชื่อมบัญชี
export async function DELETE(request) {
  const auth = await requireAuth(request);
  if (!auth.success) return auth.response;
  try {
    await query(
      `UPDATE officer SET provider_account_id = NULL, provider_cid_hmac = NULL, provider_id = NULL, provider_hcode = NULL, provider_org = NULL, provider_linked_at = NULL WHERE id = ?`,
      [auth.user.id]
    );
    await recordChange({ request, user: auth.user, action: "data_update", table: "officer", id: auth.user.id, description: "ยกเลิกการเชื่อมบัญชี Provider ID" });
    return NextResponse.json({ success: true, message: "ยกเลิกการเชื่อม Provider ID แล้ว" });
  } catch (error) {
    console.error("Provider ID unlink error:", error);
    return publicInternalError("ยกเลิกการเชื่อมไม่สำเร็จ");
  }
}
