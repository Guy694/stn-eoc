import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query } from "@/lib/db";
import { eventDays, loadSessionMetrics } from "@/lib/eventHistory";

const ROLES = ["admin", "commander"];
const TYPES = new Set(["flood", "disease", "festival-accidents", "drought", "tsunami", "earthquake"]);

async function optionalColumns() {
  const rows = await query(
    `SELECT COLUMN_NAME AS name FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'eoc_sessions'
       AND COLUMN_NAME IN ('open_order_file_path', 'open_order_file_name', 'disease_name')`
  );
  return new Set(rows.map((row) => row.name));
}

// GET - ประวัติเหตุการณ์ทั้งหมด พร้อมตัวเลขสำคัญของแต่ละครั้ง
export async function GET(request) {
  const auth = await requireAuth(request, ROLES);
  if (!auth.success) return auth.response;

  try {
    const params = new URL(request.url).searchParams;
    const type = params.get("type");
    const status = params.get("status");
    const year = Number(params.get("year")) || null;
    const columns = await optionalColumns();

    const where = [];
    const values = [];
    if (type && TYPES.has(type)) { where.push("s.eoc_type = ?"); values.push(type); }
    if (status === "active" || status === "closed") { where.push("s.status = ?"); values.push(status); }
    if (year) { where.push("YEAR(s.opened_at) = ?"); values.push(year); }
    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";

    const sessions = await query(
      `SELECT s.id, s.eoc_type, s.session_number, s.status, s.opened_at, s.closed_at, s.open_reason, s.close_reason,
              ${columns.has("disease_name") ? "s.disease_name" : "NULL AS disease_name"},
              ${columns.has("open_order_file_path") ? "s.open_order_file_path, s.open_order_file_name" : "NULL AS open_order_file_path, NULL AS open_order_file_name"},
              COALESCE(NULLIF(CONCAT_WS(' ', oo.title, oo.given_name, oo.family_name), ''), oo.username) AS opened_by_name,
              COALESCE(NULLIF(CONCAT_WS(' ', co.title, co.given_name, co.family_name), ''), co.username) AS closed_by_name
       FROM eoc_sessions s
       LEFT JOIN officer oo ON oo.id = s.opened_by
       LEFT JOIN officer co ON co.id = s.closed_by
       ${whereSql}
       ORDER BY (s.status = 'active') DESC, s.opened_at DESC
       LIMIT 300`,
      values
    );
    const metrics = await loadSessionMetrics(sessions);
    const years = await query(`SELECT DISTINCT YEAR(opened_at) AS year FROM eoc_sessions WHERE opened_at IS NOT NULL ORDER BY year DESC`);

    return NextResponse.json({
      success: true,
      data: sessions.map((session) => ({ ...session, days: eventDays(session), metrics: metrics[session.id] })),
      years: years.map((row) => Number(row.year)).filter(Boolean)
    });
  } catch (error) {
    console.error("Event history list error:", error);
    return publicInternalError("โหลดประวัติเหตุการณ์ไม่สำเร็จ");
  }
}
