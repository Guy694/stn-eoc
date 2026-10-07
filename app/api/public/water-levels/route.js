import { NextResponse } from "next/server";
import { getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { THAIWATER_SOURCE, THAIWATER_URL, summarizeStations } from "@/lib/thaiWater";

// ระดับน้ำ/ระดับตลิ่งของสถานีในจังหวัดสตูล จาก ThaiWater (ผ่านเซิร์ฟเวอร์เรา เพื่อแคชและไม่ให้เบราว์เซอร์ยิงต้นทางตรง)
export async function GET() {
  try {
    const { stations, fetchedAt, stale } = await getSatunWaterLevels();
    return NextResponse.json(
      {
        success: true,
        stations,
        summary: summarizeStations(stations),
        fetchedAt: new Date(fetchedAt).toISOString(),
        stale,
        source: THAIWATER_SOURCE,
        sourceUrl: THAIWATER_URL
      },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Water level API error:", error);
    return NextResponse.json(
      { success: false, message: "ยังดึงข้อมูลระดับน้ำจาก ThaiWater ไม่ได้ในขณะนี้", source: THAIWATER_SOURCE, sourceUrl: THAIWATER_URL },
      { status: 503 }
    );
  }
}
