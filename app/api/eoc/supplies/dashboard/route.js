import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { buildSupplyDashboard, findSupplyEvent, loadDailyData, resolveSupplySession } from "@/lib/medicalDailyServer";

// Dashboard วิเคราะห์เวชภัณฑ์ของเหตุการณ์: ยอดคงเหลือ อัตราใช้ พอใช้อีกกี่วัน การส่งรายงาน รายอำเภอ และยอดนับไม่ตรง
export const dynamic = "force-dynamic";

const SUPPORTED = ["flood", "disease"];

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc") || "flood";
    if (!SUPPORTED.includes(eocType)) return NextResponse.json({ success: false, message: "ประเภท EOC ไม่ถูกต้อง" }, { status: 400 });
    const session = await resolveSupplySession(eocType, Number(params.get("session_id")) || null);
    if (!session) return NextResponse.json({ success: true, session: null, dashboard: null });
    const event = await findSupplyEvent(session);
    if (!event) return NextResponse.json({ success: true, session, event: null, dashboard: null });
    const data = await loadDailyData(event.id);
    return NextResponse.json(
      { success: true, session, event, dashboard: buildSupplyDashboard(data, session) },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (error) {
    console.error("Supplies dashboard error:", error?.message || error);
    return publicInternalError("ไม่สามารถโหลด dashboard เวชภัณฑ์ได้");
  }
}
