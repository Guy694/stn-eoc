import { NextResponse } from "next/server";
import { getFloodFreqData } from "@/lib/gistdaFloodFreqClient";

// พื้นที่น้ำท่วมซ้ำซาก จ.สตูล (GISTDA, ภาพดาวเทียม พ.ศ. 2554–2567)
// ?min=1 → ทุกพื้นที่ที่เคยท่วม (ค่าเริ่มต้น ~1.6 MB); ?min=2 → เฉพาะท่วมซ้ำตั้งแต่ 2 ปีขึ้นไป (~0.8 MB)
// ?summary=1 → เฉพาะสรุปรายอำเภอ (ไม่ส่งรูปทรง)
export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const min = Math.min(14, Math.max(1, Number.parseInt(searchParams.get("min") || "1", 10) || 1));
  const summaryOnly = searchParams.get("summary") === "1";

  try {
    const data = await getFloodFreqData();
    const features = summaryOnly ? [] : data.geojson.features.filter((feature) => feature.properties.freq >= min);
    return NextResponse.json(
      {
        success: true,
        source: "GISTDA (สทอภ.) — พื้นที่น้ำท่วมจากภาพดาวเทียม พ.ศ. 2554–2567",
        fetched_at: data.fetched_at,
        source_updated_at: data.source_updated_at,
        min_freq: min,
        summary: data.summary,
        ...(summaryOnly ? {} : { geojson: { type: "FeatureCollection", features } })
      },
      { headers: { "Cache-Control": "public, max-age=86400, stale-while-revalidate=604800" } }
    );
  } catch (error) {
    console.error("Flood frequency API error:", error?.message || error);
    const missingKey = error?.code === "missing_api_key";
    return NextResponse.json(
      { success: false, error: missingKey ? "ยังไม่ได้ตั้งค่า GISTDA_API_KEY" : "ยังดึงข้อมูลพื้นที่น้ำท่วมซ้ำซากจาก GISTDA ไม่ได้ในขณะนี้" },
      { status: 503 }
    );
  }
}
