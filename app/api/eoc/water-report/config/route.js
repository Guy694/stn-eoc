import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getReportConfig, saveReportConfig } from "@/lib/waterReportExtrasServer";

// ค่าตั้งค่าของรายงานระดับน้ำ: สถานีตัวแทนลุ่มน้ำ ระดับเฝ้าระวัง พื้นที่เฝ้าระวังสำคัญ และผู้ออกรายงาน (ใช้ร่วมกันทั้งทีม)
export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  return NextResponse.json({ success: true, config: await getReportConfig() });
}

export async function PUT(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ success: false, message: "รูปแบบข้อมูลไม่ถูกต้อง" }, { status: 400 });
  }
  try {
    const config = await saveReportConfig(body?.config || body, auth.user);
    return NextResponse.json({ success: true, config });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ success: false, message: "ยังไม่มีตาราง system_settings (รัน npm run db:migrate)" }, { status: 503 });
    }
    console.error("Water report config error:", error);
    return publicInternalError("บันทึกค่าตั้งค่ารายงานไม่สำเร็จ");
  }
}
