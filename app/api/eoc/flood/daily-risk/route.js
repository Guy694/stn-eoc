import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import {
  bangkokTodayKey,
  getFloodDailyData,
  parseDateKey,
  parsePositiveId,
  resolveFloodSessionAccess,
} from "@/lib/eocFloodDaily";

export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;

    const { searchParams } = new URL(request.url);
    const requestedSessionId = searchParams.get("session_id") || searchParams.get("sessionId");
    const requestedDate = searchParams.get("report_date") || searchParams.get("date") || bangkokTodayKey();
    if (requestedSessionId && !parsePositiveId(requestedSessionId)) {
      return NextResponse.json({ success: false, message: "session_id ไม่ถูกต้อง" }, { status: 400 });
    }
    if (!parseDateKey(requestedDate)) {
      return NextResponse.json({ success: false, message: "วันที่รายงานไม่ถูกต้อง" }, { status: 400 });
    }

    const access = await resolveFloodSessionAccess(auth.user, requestedSessionId);
    if (!access.ok) {
      return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    }

    const data = await getFloodDailyData({ sessionId: access.sessionId, reportDate: requestedDate });
    return NextResponse.json({
      ...data,
      permissions: {
        canView: access.canView,
        canOperate: access.canOperate,
        canReport: access.canReport,
      },
    });
  } catch (error) {
    console.error("Flood daily-risk API error:", error);
    if (error.message === "FLOOD_SESSION_NOT_FOUND") {
      return NextResponse.json({ success: false, message: "ไม่พบ EOC Session อุทกภัย" }, { status: 404 });
    }
    return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูลสรุปความเสี่ยงอุทกภัยรายวัน");
  }
}
