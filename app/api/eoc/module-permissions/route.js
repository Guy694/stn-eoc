import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { loadMenuLayout, loadOwnerOverrides } from "@/lib/eocModuleOwners";

// สิทธิ์รายเมนูและการจัดกลุ่มเมนูที่แอดมินตั้งไว้ (ใช้แสดงป้าย "ดูอย่างเดียว" ป้ายทีม และกลุ่มในเมนูข้าง) — การตรวจสิทธิ์จริงอยู่ที่ API ของแต่ละเมนู
export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  try {
    const [overrides, layout] = await Promise.all([loadOwnerOverrides(), loadMenuLayout()]);
    return NextResponse.json({ success: true, overrides, layout });
  } catch (error) {
    console.error("Module permissions GET error:", error);
    return publicInternalError("โหลดสิทธิ์รายเมนูไม่สำเร็จ");
  }
}
