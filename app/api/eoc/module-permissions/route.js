import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { loadOwnerOverrides } from "@/lib/eocModuleOwners";

// สิทธิ์รายเมนูที่แอดมินตั้งไว้ (ใช้แสดงป้าย "ดูอย่างเดียว" ในเมนูข้าง) — การตรวจสิทธิ์จริงอยู่ที่ API ของแต่ละเมนู
export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  try {
    return NextResponse.json({ success: true, overrides: await loadOwnerOverrides() });
  } catch (error) {
    console.error("Module permissions GET error:", error);
    return publicInternalError("โหลดสิทธิ์รายเมนูไม่สำเร็จ");
  }
}
