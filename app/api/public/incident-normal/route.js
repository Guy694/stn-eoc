import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { enforceIpRateLimit } from "@/lib/rateLimit";

// ประชาชนกด "ตอนนี้ปกติแล้ว" บนจุดที่เผยแพร่อยู่
// ไม่ซ่อนจุดทันที (กันการกดเล่น/กลั่นแกล้ง) แต่นับจำนวนให้เจ้าหน้าที่เห็นในคิวตรวจ
export async function POST(request) {
  const rateLimited = await enforceIpRateLimit(request, "publicFeedback");
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "ไม่พบจุดนี้" }, { status: 400 });
    }
    const result = await query(
      `UPDATE public_incident_reports
       SET normal_reports = normal_reports + 1, normal_reported_at = NOW()
       WHERE id = ? AND publish_status = 'published'
         AND report_type IN ('traffic_report', 'problem_point')
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ success: false, message: "จุดนี้ไม่ได้แสดงบนแผนที่แล้ว" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: "ขอบคุณครับ เจ้าหน้าที่จะตรวจและอัปเดตแผนที่" });
  } catch (error) {
    console.error("Incident normal feedback error:", error);
    return publicInternalError("ส่งข้อมูลไม่สำเร็จ");
  }
}
