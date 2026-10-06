import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { loadEventBrief, resolveEventSession } from "@/lib/eocBriefData";
import { buildAgenda } from "@/lib/meetingBrief";

// สรุปสำหรับห้องประชุม: รวมเรื่องเร่งด่วนและตัวเลขหลักของทุกโมดูลในเหตุการณ์
export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc") || "flood";
    const session = await resolveEventSession({ eocType, sessionId: params.get("session_id") });
    if (!session) return NextResponse.json({ success: true, session: null, message: "ยังไม่เคยเปิดเหตุการณ์" });
    const brief = await loadEventBrief(session);
    const { community, shelter, population, ...health } = brief.health;
    void community; void shelter; void population;
    return NextResponse.json({
      success: true,
      session,
      generated_at: new Date().toISOString(),
      agenda: buildAgenda(brief, `/eoc/${eocType}`),
      ...brief,
      health: { totals: health.totals, actions: health.actions, diseases: health.diseases.slice(0, 5), districts: health.districts.slice(0, 6), trend: health.trend.slice(-14) }
    });
  } catch (error) {
    console.error("Meeting brief error:", error);
    return publicInternalError("ไม่สามารถสร้างสรุปสำหรับห้องประชุมได้");
  }
}
