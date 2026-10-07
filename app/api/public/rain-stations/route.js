import { NextResponse } from "next/server";
import { getSatunRainfall } from "@/lib/thaiWaterClient";
import { THAIWATER_SOURCE } from "@/lib/thaiWater";

// ฝนวัดจริงรายสถานีในจังหวัดสตูล จาก ThaiWater (ผ่านเซิร์ฟเวอร์เรา แคช 10 นาที)
export async function GET() {
  try {
    const { stations, fetchedAt, stale } = await getSatunRainfall();
    return NextResponse.json(
      { success: true, stations, fetchedAt: new Date(fetchedAt).toISOString(), stale, source: THAIWATER_SOURCE, sourceUrl: "https://www.thaiwater.net/weather/rain" },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Rain stations API error:", error);
    return NextResponse.json({ success: false, message: "ยังดึงข้อมูลฝนจาก ThaiWater ไม่ได้ในขณะนี้", source: THAIWATER_SOURCE }, { status: 503 });
  }
}
