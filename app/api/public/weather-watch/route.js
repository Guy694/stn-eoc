import { NextResponse } from "next/server";
import { getWeatherWatchPayload } from "@/lib/weatherWatch";
import { homeView } from "@/lib/weatherWatchView";


export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const payload = await getWeatherWatchPayload({ date });

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
