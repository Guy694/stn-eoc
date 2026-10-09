import { NextResponse } from "next/server";
import { getSeaLevelPayload } from "@/lib/seaLevelClient";

// ระดับน้ำทะเลและสถานะน้ำทะเลหนุนหน้า จ.สตูล (พยากรณ์ Open-Meteo Marine + ค่าวัดจริงสถานี IOC ลังกาวี) — แคชฝั่งเซิร์ฟเวอร์ 10 นาที
export async function GET() {
  try {
    const payload = await getSeaLevelPayload();
    return NextResponse.json(
      { success: true, source: "พยากรณ์: Open-Meteo Marine (Météo-France SMOC) • ค่าวัดจริง: IOC Sea Level Station Monitoring Facility (VLIZ/UNESCO-IOC) CC-BY 4.0", ...payload },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Sea level API error:", error?.message || error);
    return NextResponse.json({ success: false, error: "ยังดึงข้อมูลระดับน้ำทะเลไม่ได้ในขณะนี้" }, { status: 503 });
  }
}
