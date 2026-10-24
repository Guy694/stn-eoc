import { NextResponse } from "next/server";
import { getWeatherWatchPayload } from "@/lib/weatherWatch";
import { homeView } from "@/lib/weatherWatchView";


export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const payload = await getWeatherWatchPayload({ date });
    // ?view=warnings: เฉพาะประกาศเตือนขณะนี้ (หน้าประกาศและความรู้) — ไม่ต้องส่งข้อมูลรายอำเภอทั้งก้อน
    if (searchParams.get("view") === "warnings") {
      return NextResponse.json(
        { success: true, weather_warnings: payload.weather_warnings || [], generated_at: payload.generated_at || null },
        { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=240" } }
      );
    }

    return NextResponse.json(
      { success: true, ...(searchParams.get("view") === "home" ? homeView(payload) : payload) },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=240" } }
    );
  } catch (error) {
    console.error("Weather Watch API error:", error);
    return NextResponse.json(
      { success: false, error: "ยังไม่มีข้อมูลสภาพอากาศจริงจาก provider ในขณะนี้" },
      { status: 503 }
    );
  }
}
