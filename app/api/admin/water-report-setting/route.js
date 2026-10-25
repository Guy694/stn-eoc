import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { recordChange } from "@/lib/recordArchive";
import { getOpenEocSessions } from "@/lib/eocOpen";
import { WATER_REPORT_MODES, waterReportStatus } from "@/lib/waterReportSetting";
import { getWaterReportSetting, saveWaterReportSetting } from "@/lib/waterReportSettingServer";

// เปิด/ปิดเมนู "รายงานระดับน้ำ" ของประชาชน — ผู้ดูแลระบบเท่านั้น
export const dynamic = "force-dynamic";

async function snapshot() {
  const [setting, sessions] = await Promise.all([getWaterReportSetting({ fresh: true }), getOpenEocSessions().catch(() => [])]);
  return { ...setting, status: waterReportStatus(setting.mode, sessions), flood_eoc_open: sessions.some((s) => s.eoc_type === "flood") };
}

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    return NextResponse.json({ success: true, data: await snapshot() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Water report setting GET error:", error?.message || error);
    return publicInternalError("อ่านการตั้งค่าไม่สำเร็จ");
  }
}

export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (!Object.hasOwn(WATER_REPORT_MODES, body?.mode)) return NextResponse.json({ success: false, message: "รูปแบบการเปิดเมนูไม่ถูกต้อง" }, { status: 400 });
    const before = await getWaterReportSetting({ fresh: true });
    await saveWaterReportSetting(body.mode, auth.user);
    await recordChange({
      request, user: auth.user, action: "data_update", table: "system_settings", id: "public_water_report",
      description: `ตั้งเมนูรายงานระดับน้ำของประชาชนเป็น "${WATER_REPORT_MODES[body.mode].label}"`, oldValues: before, newValues: { mode: body.mode }
    });
    return NextResponse.json({ success: true, data: await snapshot(), message: `ตั้งเมนูรายงานระดับน้ำเป็น "${WATER_REPORT_MODES[body.mode].label}" แล้ว หน้าประชาชนเปลี่ยนภายใน 1 นาที` });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261009_system_settings.sql" }, { status: 503 });
    console.error("Water report setting PUT error:", error?.message || error);
    return publicInternalError("บันทึกการตั้งค่าไม่สำเร็จ");
  }
}
