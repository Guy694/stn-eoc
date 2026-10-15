import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { loadWaterReportExtras } from "@/lib/waterReportExtrasServer";

// ข้อมูลหัวข้อ 2–4 ของรายงานระดับน้ำ (ลุ่มน้ำหลัก ฝน คาดการณ์ พื้นที่เฝ้าระวัง) แยกจากข้อมูล ปภ. เพื่อให้ตารางหลักขึ้นก่อน
export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  try {
    const refresh = new URL(request.url).searchParams.get("refresh") === "1";
    return NextResponse.json({ success: true, ...(await loadWaterReportExtras({ refresh })) });
  } catch (error) {
    console.error("Water report extras error:", error);
    return publicInternalError("โหลดข้อมูลลุ่มน้ำและฝนไม่สำเร็จ");
  }
}
