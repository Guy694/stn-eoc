import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getAreaRiskPayload } from "@/lib/areaRiskData";

// วิเคราะห์พื้นที่เสี่ยงน้ำท่วมรายตำบล (เฉพาะเจ้าหน้าที่ — มียอดกลุ่มเปราะบางรายตำบล)
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const payload = await getAreaRiskPayload();
    const response = NextResponse.json({ success: true, ...payload });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Area risk API error:", error?.message || error);
    return publicInternalError("ยังวิเคราะห์พื้นที่เสี่ยงไม่ได้ในขณะนี้");
  }
}
