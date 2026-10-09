import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { getAreaRiskPayload } from "@/lib/areaRiskData";
import { publicOutlookFor, publicOutlookSummary } from "@/lib/publicFloodOutlook";

// พยากรณ์จุดเสี่ยงน้ำท่วม 7 วัน ฉบับประชาชน
// ?district=&tambon= → ตำบลเดียวพร้อมเหตุผล / ไม่ใส่ → ระดับรายวันทุกตำบล
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const district = (searchParams.get("district") || "").slice(0, 60);
    const tambon = (searchParams.get("tambon") || "").slice(0, 60);
    const payload = await getAreaRiskPayload();
    const forecast = payload?.forecast || null;
    const data = district && tambon ? publicOutlookFor(forecast, district, tambon) : publicOutlookSummary(forecast);
    return NextResponse.json(
      { success: true, generated_at: payload?.generated_at || null, dates: forecast?.dates || [], data },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Public flood outlook error:", error?.message || error);
    return publicInternalError("ยังโหลดพยากรณ์จุดเสี่ยงไม่ได้");
  }
}
