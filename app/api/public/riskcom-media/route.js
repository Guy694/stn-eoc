import { NextResponse } from "next/server";
import { buildRiskcomUrl, normalizeRiskcomItem, RISKCOM_CREDIT, RISKCOM_SITE } from "@/lib/riskcomMedia";

// ต้นทางแคช 5 นาทีอยู่แล้ว ฝั่งเราก็แคช 5 นาที ไม่ยิงซ้ำทุกครั้งที่มีคนเปิดหน้า
const REVALIDATE_SECONDS = 300;

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const params = Object.fromEntries(["id", "q", "phase", "category", "page", "limit", "sort"].map((key) => [key, searchParams.get(key) || ""]));
  const source = { name: RISKCOM_CREDIT, url: RISKCOM_SITE };

  try {
    const response = await fetch(buildRiskcomUrl(params), {
      headers: { Accept: "application/json" },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: AbortSignal.timeout(8000)
    });
    if (response.status === 404 && params.id) {
      return NextResponse.json({ success: false, error: "ไม่พบสื่อนี้", source }, { status: 404 });
    }
    if (!response.ok) throw new Error(`riskcom ${response.status}`);
    const json = await response.json();
    const headers = { "Cache-Control": `public, s-maxage=${REVALIDATE_SECONDS}, stale-while-revalidate=600` };

    if (params.id) {
      const item = normalizeRiskcomItem(json?.data || json);
      if (!item) return NextResponse.json({ success: false, error: "ไม่พบสื่อนี้", source }, { status: 404 });
      return NextResponse.json({ success: true, data: item, source }, { headers });
    }

    const data = (Array.isArray(json?.data) ? json.data : []).map(normalizeRiskcomItem).filter(Boolean);
    return NextResponse.json({ success: true, data, pagination: json?.pagination || null, source }, { headers });
  } catch (error) {
    console.error("riskcom media error:", error?.message || error);
    return NextResponse.json({ success: false, data: [], error: "ดึงสื่อจากคลังสื่อ สสจ.สตูล ไม่ได้ในขณะนี้", source }, { status: 502 });
  }
}
