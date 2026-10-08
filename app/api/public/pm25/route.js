import { NextResponse } from "next/server";
import { getPm25Payload } from "@/lib/pm25Client";

// ฝุ่น PM2.5 จังหวัดสตูลและรายอำเภอ (GISTDA) — แคชฝั่งเซิร์ฟเวอร์ 15 นาที
export async function GET() {
  try {
    const payload = await getPm25Payload();
    return NextResponse.json(
      { success: true, ...payload },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("PM2.5 API error:", error?.message || error);
    return NextResponse.json(
      { success: false, error: "ยังดึงข้อมูลฝุ่น PM2.5 จาก GISTDA ไม่ได้ในขณะนี้" },
      { status: 503 }
    );
  }
}
