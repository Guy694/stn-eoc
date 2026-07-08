import { NextResponse } from "next/server";
import { getWeatherWatchPayload } from "@/lib/weatherWatch";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;

    return NextResponse.json({
      success: true,
      ...await getWeatherWatchPayload({ date })
    });
  } catch (error) {
    console.error("Weather Watch API error:", error);
    return NextResponse.json(
      { success: false, error: "ยังไม่มีข้อมูลสภาพอากาศจริงจาก provider ในขณะนี้" },
      { status: 503 }
    );
  }
}
