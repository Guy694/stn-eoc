import { NextResponse } from "next/server";
import { getDpmCanalStations, loadDpmSparklines } from "@/lib/dpmCanalsServer";
import { DDPM_CCTV_CREDIT, DDPM_CCTV_ORIGIN } from "@/lib/ddpmCctv";

// ระดับน้ำสถานี ปภ. ในสตูล พร้อมสถานะตามเกณฑ์ของ ปภ. (หน้าแรก "น้ำในคลองตอนนี้" และป๊อปอัปกล้อง CCTV)
// ?history=1 → เพิ่มระดับน้ำรายชั่วโมง 24 ชม.ล่าสุด
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const { stations, fetchedAt, stale } = await getDpmCanalStations();
    const history = new URL(request.url).searchParams.get("history") === "1" ? await loadDpmSparklines(24).catch(() => ({})) : undefined;
    return NextResponse.json(
      { success: true, stations, fetchedAt: new Date(fetchedAt).toISOString(), stale, ...(history ? { history } : {}), source: DDPM_CCTV_CREDIT, sourceUrl: DDPM_CCTV_ORIGIN },
      { headers: { "Cache-Control": "public, max-age=120, stale-while-revalidate=300" } }
    );
  } catch (error) {
    console.error("DPM water API error:", error?.message || error);
    return NextResponse.json({ success: false, message: "ยังดึงข้อมูลระดับน้ำจาก ปภ. ไม่ได้ในขณะนี้", source: DDPM_CCTV_CREDIT }, { status: 503 });
  }
}
