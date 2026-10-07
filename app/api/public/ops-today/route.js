import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { getOpenEocSessions } from "@/lib/eocOpen";

// งานของศูนย์วันนี้ (นับจำนวนอย่างเดียว ไม่มีข้อมูลบุคคล) — แสดงเฉพาะช่วงเปิด EOC
const CACHE_MS = 60 * 1000;
let cache = null;

export async function GET() {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, max-age=60" } });
  }
  try {
    const sessions = await getOpenEocSessions();
    if (sessions.length === 0) {
      cache = { at: Date.now(), body: { success: true, open: false } };
      return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, max-age=60" } });
    }
    const rows = await query(
      `SELECT
         SUM(DATE(reported_at) = CURDATE()) AS received_today,
         SUM(status IN ('pending')) AS waiting,
         SUM(status IN ('reviewing', 'verified')) AS in_progress,
         SUM(status = 'resolved' AND DATE(COALESCE(reviewed_at, updated_at)) = CURDATE()) AS resolved_today,
         MAX(reported_at) AS last_received_at
       FROM public_incident_reports
       WHERE report_type = 'help_request'
         AND reported_at >= DATE_SUB(CURDATE(), INTERVAL 30 DAY)`
    );
    const row = rows[0] || {};
    cache = { at: Date.now(), body: {
      success: true,
      open: true,
      data: {
        received_today: Number(row.received_today || 0),
        waiting: Number(row.waiting || 0),
        in_progress: Number(row.in_progress || 0),
        resolved_today: Number(row.resolved_today || 0),
        last_received_at: row.last_received_at || null
      }
    } };
    return NextResponse.json(cache.body, { headers: { "Cache-Control": "public, max-age=60" } });
  } catch (error) {
    console.error("Ops today API error:", error);
    return publicInternalError("ไม่สามารถดึงสรุปงานของศูนย์ได้");
  }
}
