import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { resolveEventSession } from "@/lib/eocBriefData";
import { recordChange } from "@/lib/recordArchive";
import { buildSheetExport } from "@/lib/sheetExport";
import { loadSheetExportData } from "@/lib/sheetExportData";
import { buildXlsx } from "@/lib/xlsxWriter";

// ส่งออก Excel รูปแบบเดียวกับชีต "รายงานเตรียมความพร้อมรับมืออุทกภัย" ของ สสจ.สตูล
// ?eoc=flood&session_id=&date=YYYY-MM-DD (ไม่ระบุ = วันนี้)
export const dynamic = "force-dynamic";
const bangkokToday = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 10);

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc") || "flood";
    if (eocType !== "flood") return NextResponse.json({ success: false, message: "ส่งออกรูปแบบชีตได้เฉพาะเหตุการณ์อุทกภัย" }, { status: 400 });
    const session = await resolveEventSession({ eocType, sessionId: params.get("session_id") });
    if (!session) return NextResponse.json({ success: false, message: "ยังไม่มีเหตุการณ์อุทกภัย" }, { status: 404 });
    const requested = params.get("date");
    const date = /^\d{4}-\d{2}-\d{2}$/.test(requested || "") && requested <= bangkokToday() ? requested : bangkokToday();

    const data = await loadSheetExportData(session, date);
    const buffer = buildXlsx(buildSheetExport(data));
    await recordChange({
      request, user: auth.user, action: "other", table: "eoc_sessions", id: session.id, sessionId: session.id,
      description: `ส่งออก Excel รูปแบบชีต สสจ. (อุทกภัย ครั้งที่ ${session.session_number} วันที่ ${date})`
    });
    const filename = `EOC-flood-${session.session_number}-${date}.xlsx`;
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(`รายงานอุทกภัย-ครั้งที่${session.session_number}-${date}.xlsx`)}`,
        "Cache-Control": "no-store"
      }
    });
  } catch (error) {
    console.error("Sheet export error:", error);
    return publicInternalError("ไม่สามารถสร้างไฟล์ Excel ได้");
  }
}
