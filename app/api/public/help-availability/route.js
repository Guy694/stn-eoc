import { NextResponse } from "next/server";
import { getOpenEocSessions } from "@/lib/eocOpen";
import { publicInternalError } from "@/lib/apiResponse";

// หน้าเว็บใช้เช็กว่าควรเปิดปุ่ม "ขอความช่วยเหลือ" / "รายงานระดับน้ำ" หรือไม่ (ไม่มีข้อมูลส่วนบุคคล)
export async function GET() {
  try {
    const sessions = await getOpenEocSessions();
    return NextResponse.json(
      { success: true, open: sessions.length > 0, floodOpen: sessions.some((session) => session.eoc_type === "flood"), count: sessions.length },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Help availability API error:", error);
    return publicInternalError("ไม่สามารถตรวจสอบสถานะศูนย์ปฏิบัติการได้");
  }
}
