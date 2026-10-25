import { NextResponse } from "next/server";
import { getOpenEocSessions } from "@/lib/eocOpen";
import { publicInternalError } from "@/lib/apiResponse";
import { waterReportStatus } from "@/lib/waterReportSetting";
import { getWaterReportSetting } from "@/lib/waterReportSettingServer";

// หน้าเว็บใช้เช็กว่าควรเปิดปุ่ม "ขอความช่วยเหลือ" / "รายงานระดับน้ำ" หรือไม่ (ไม่มีข้อมูลส่วนบุคคล)
export async function GET() {
  try {
    const [sessions, setting] = await Promise.all([getOpenEocSessions(), getWaterReportSetting().catch(() => ({ mode: "auto" }))]);
    // floodOpen = เปิดรับ "รายงานระดับน้ำ": ตาม EOC อุทกภัย หรือตามที่ผู้ดูแลระบบตั้งเปิด/ปิดไว้
    const water = waterReportStatus(setting.mode, sessions);
    return NextResponse.json(
      { success: true, open: sessions.length > 0, floodOpen: water.open, waterClosedBy: water.open ? null : water.reason, count: sessions.length },
      { headers: { "Cache-Control": "public, max-age=30, stale-while-revalidate=60" } }
    );
  } catch (error) {
    console.error("Help availability API error:", error);
    return publicInternalError("ไม่สามารถตรวจสอบสถานะศูนย์ปฏิบัติการได้");
  }
}
