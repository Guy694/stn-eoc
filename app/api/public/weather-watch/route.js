import { NextResponse } from "next/server";
import { getWeatherWatchPayload } from "@/lib/weatherWatch";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    const source = searchParams.get("source") || "mock";

    if (source !== "mock") {
      return NextResponse.json(
        {
          success: false,
          error: "Weather provider proxy is prepared but not enabled. Configure server-side provider credentials before using live data."
        },
        { status: 501 }
      );
    }

    return NextResponse.json({
      success: true,
      ...getWeatherWatchPayload({ date })
    });
  } catch (error) {
    console.error("Weather Watch API error:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถโหลดข้อมูลสภาพอากาศได้" },
      { status: 500 }
    );
  }
}
