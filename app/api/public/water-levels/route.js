import { NextResponse } from "next/server";
import { getDpmCanalStations, loadDpmSparklines } from "@/lib/dpmCanalsServer";
import { DDPM_CCTV_CREDIT, DDPM_CCTV_ORIGIN } from "@/lib/ddpmCctv";
import { dpmStationForMap } from "@/lib/dpmCanals";

// เข้ากันได้กับผู้เรียกเดิม แต่ส่งระดับน้ำจากสถานี ปภ.
// ?history=1 → เพิ่มระดับน้ำรายชั่วโมง 24 ชม.ล่าสุดที่ระบบบันทึกไว้ (กราฟเล็กในการ์ดหน้าแรก)
export async function GET(request) {
  try {
    const { stations: rawStations, fetchedAt, stale } = await getDpmCanalStations();
    const stations = rawStations.map(dpmStationForMap);
    const withHistory = new URL(request.url).searchParams.get("history") === "1";
    const history = withHistory
      ? await loadDpmSparklines(24).catch(() => ({}))
      : undefined;
    return NextResponse.json(
      {
        success: true,
        stations,
        summary: { total: stations.length, counts: {}, overflow: stations.filter((station) => station.statusCode >= 4).length, nearBank: stations.filter((station) => station.statusCode >= 2).length },
        fetchedAt: new Date(fetchedAt).toISOString(),
        stale,
        ...(history ? { history } : {}),
        source: DDPM_CCTV_CREDIT,
        sourceUrl: DDPM_CCTV_ORIGIN
      },
      { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } }
    );
  } catch (error) {
    console.error("Water level API error:", error);
    return NextResponse.json(
      { success: false, message: "ยังดึงข้อมูลระดับน้ำจาก ปภ. ไม่ได้ในขณะนี้", source: DDPM_CCTV_CREDIT, sourceUrl: DDPM_CCTV_ORIGIN },
      { status: 503 }
    );
  }
}
