import { NextResponse } from "next/server";
import { getConnection, query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { hasConfirmationColumns } from "@/lib/incidentPublishingDb";

// ประชาชนช่วยยืนยันจุดที่เผยแพร่อยู่: kind = normal ("น้ำลดแล้ว/ปกติแล้ว") | still ("ยังท่วมอยู่") | wrong ("ข้อมูลไม่ถูกต้อง")
// ไม่ซ่อน/เปลี่ยนจุดทันที (กันการกดเล่น/กลั่นแกล้ง) — นับให้เจ้าหน้าที่เห็นในคิวตรวจ และใช้บอกความสดของข้อมูล
const KINDS = {
  normal: { column: "normal_reports", at: "normal_reported_at", message: "ขอบคุณครับ เจ้าหน้าที่จะตรวจและอัปเดตแผนที่" },
  still: { column: "still_reports", at: "still_reported_at", message: "ขอบคุณที่ช่วยยืนยันว่ายังท่วมอยู่" },
  wrong: { column: "wrong_reports", at: "wrong_reported_at", message: "ขอบคุณครับ เจ้าหน้าที่จะตรวจข้อมูลจุดนี้อีกครั้ง" }
};

export async function POST(request) {
  const rateLimited = await enforceIpRateLimit(request, "publicFeedback");
  if (rateLimited) return rateLimited;

  try {
    const body = await request.json().catch(() => ({}));
    const id = Number(body.id);
    const kind = KINDS[body.kind] ? body.kind : "normal";
    if (!Number.isInteger(id) || id <= 0) {
      return NextResponse.json({ success: false, message: "ไม่พบจุดนี้" }, { status: 400 });
    }
    if (kind !== "normal" && !(await hasConfirmationColumns(await getConnection()))) {
      return NextResponse.json({ success: false, message: "ยังรับข้อมูลนี้ไม่ได้ (ระบบกำลังปรับปรุง)" }, { status: 409 });
    }
    const { column, at, message } = KINDS[kind];
    const result = await query(
      `UPDATE public_incident_reports
       SET ${column} = ${column} + 1, ${at} = NOW()
       WHERE id = ? AND publish_status = 'published'
         AND report_type IN ('traffic_report', 'problem_point')
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [id]
    );
    if (!result.affectedRows) {
      return NextResponse.json({ success: false, message: "จุดนี้ไม่ได้แสดงบนแผนที่แล้ว" }, { status: 404 });
    }
    return NextResponse.json({ success: true, message, kind });
  } catch (error) {
    console.error("Incident feedback error:", error);
    return publicInternalError("ส่งข้อมูลไม่สำเร็จ");
  }
}
