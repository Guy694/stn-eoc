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

const canonicalPath = "/stn-eoc/api/eoc/flood/daily-risk";

// Compatibility adapter. New consumers must use /api/eoc/flood/daily-risk.
export async function GET(request) {
  try {
    const auth = await requireAuth(request);
    if (!auth.success) return auth.response;
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("session_id") || searchParams.get("sessionId");
    const reportDate = searchParams.get("report_date") || searchParams.get("date") || bangkokTodayKey();
    if (sessionId && !parsePositiveId(sessionId)) {
      return NextResponse.json({ success: false, message: "session_id ไม่ถูกต้อง" }, { status: 400 });
    }
    if (!parseDateKey(reportDate)) {
      return NextResponse.json({ success: false, message: "วันที่รายงานไม่ถูกต้อง" }, { status: 400 });
    }
    const access = await resolveFloodSessionAccess(auth.user, sessionId);
    if (!access.ok) {
      return NextResponse.json({ success: false, message: access.message }, { status: access.status });
    }
    const data = await getFloodDailyData({ sessionId: access.sessionId, reportDate });
    const response = NextResponse.json({ ...data, deprecated: true, canonicalPath });
    response.headers.set("Deprecation", "true");
    response.headers.set("Link", `<${canonicalPath}>; rel="successor-version"`);
    return response;
  } catch (error) {
    console.error("Deprecated flood daily-records API error:", error);
    return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูลอุทกภัยรายวัน");
  }
}

function deprecatedMutationResponse() {
  return NextResponse.json(
    {
      success: false,
      message: "Endpoint นี้ยกเลิกการบันทึกแล้ว กรุณาใช้ API flood-records หลัก",
      canonicalPath: "/stn-eoc/api/admin/flood-records",
    },
    { status: 410 },
  );
}

export async function POST() {
  return deprecatedMutationResponse();
}

export async function DELETE() {
  return deprecatedMutationResponse();
}
