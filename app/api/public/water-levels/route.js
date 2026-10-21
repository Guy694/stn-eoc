import { NextResponse } from "next/server";
import { getSatunWaterLevels } from "@/lib/thaiWaterClient";
import { THAIWATER_SOURCE, THAIWATER_URL, summarizeStations } from "@/lib/thaiWater";

// ระดับน้ำ/ระดับตลิ่งของสถานีในจังหวัดสตูล จาก ThaiWater (ผ่านเซิร์ฟเวอร์เรา เพื่อแคชและไม่ให้เบราว์เซอร์ยิงต้นทางตรง)
// ?history=1 → เพิ่มระดับน้ำรายชั่วโมง 24 ชม.ล่าสุดที่ระบบบันทึกไว้ (กราฟเล็กในการ์ดหน้าแรก)
export async function GET(request) {
  try {
    const { stations, fetchedAt, stale } = await getSatunWaterLevels();
    const withHistory = new URL(request.url).searchParams.get("history") === "1";
    const history = withHistory
      ? await import("@/lib/hydroHistoryServer").then(({ loadWaterSparklines }) => loadWaterSparklines(stations, 24)).catch(() => ({}))
      : undefined;
    return NextResponse.json(
      {
        success: true,
        stations,
        summary: summarizeStations(stations),
        fetchedAt: new Date(fetchedAt).toISOString(),
        stale,
        ...(history ? { history } : {}),
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
