import { NextResponse } from "next/server";
import { getPublicSituation } from "@/lib/publicSituation";
import { publicInternalError } from "@/lib/apiResponse";

// ข้อมูลสรุปสถานการณ์สำหรับหน้าแรกของประชาชน (ข้อมูลรวมเท่านั้น)
export async function GET() {
  try {
    const situation = await getPublicSituation();
    return NextResponse.json(
      { success: true, ...situation },
      { headers: { "Cache-Control": "public, max-age=60, stale-while-revalidate=120" } }
    );
  } catch (error) {
    console.error("Public situation API error:", error);
    return publicInternalError("ไม่สามารถโหลดข้อมูลสถานการณ์ได้");
  }
}
