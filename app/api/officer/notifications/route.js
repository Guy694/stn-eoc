import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { parsePositiveInteger } from "@/lib/eocValidation";

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { searchParams } = new URL(request.url);
    const unreadOnly = searchParams.get("unread") === "true";
    const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 30, 1), 100);
    const rows = await query(`
      SELECT id, notification_type, title, detail, target_url, eoc_session_id,
             related_type, related_id, is_read, read_at, created_at
      FROM eoc_notifications
      WHERE recipient_user_id = ? ${unreadOnly ? "AND is_read = 0" : ""}
      ORDER BY is_read ASC, created_at DESC
      LIMIT ${limit}
    `, [auth.user.id]);
    const unread = await query(`SELECT COUNT(*) AS total FROM eoc_notifications WHERE recipient_user_id = ? AND is_read = 0`, [auth.user.id]);
    return NextResponse.json({ success: true, data: rows, unread_count: Number(unread[0]?.total || 0) });
  } catch (error) {
    console.error("Notification GET error:", error);
    return publicInternalError("ไม่สามารถโหลดการแจ้งเตือนได้");
  }
}

export async function PATCH(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const body = await request.json();
    if (body.read_all === true) {
      await query(`UPDATE eoc_notifications SET is_read = 1, read_at = NOW() WHERE recipient_user_id = ? AND is_read = 0`, [auth.user.id]);
      return NextResponse.json({ success: true });
    }
    const id = parsePositiveInteger(body.id);
    if (!id) return NextResponse.json({ success: false, message: "id ไม่ถูกต้อง" }, { status: 400 });
    const result = await query(`UPDATE eoc_notifications SET is_read = 1, read_at = NOW() WHERE id = ? AND recipient_user_id = ?`, [id, auth.user.id]);
    if (!result.affectedRows) return NextResponse.json({ success: false, message: "ไม่พบการแจ้งเตือน" }, { status: 404 });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Notification PATCH error:", error);
    return publicInternalError("ไม่สามารถอัปเดตการแจ้งเตือนได้");
  }
}
