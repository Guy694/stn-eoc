import { NextResponse } from "next/server";
import { loadHydroTrends } from "@/lib/hydroHistoryServer";

// แนวโน้มฝน ระดับน้ำในคลอง และน้ำทะเลหนุน สำหรับประชาชน (ข้อมูลสถานีสาธารณะ ไม่มีข้อมูลส่วนบุคคล)
// ?days=7|30|90&amphoe= — ผลลัพธ์แคชในเซิร์ฟเวอร์ 5 นาที
export const dynamic = "force-dynamic";

export async function GET(request) {
  try {
    const params = new URL(request.url).searchParams;
    const amphoe = String(params.get("amphoe") || "").slice(0, 40) || null;
    const data = await loadHydroTrends({ days: params.get("days"), amphoe });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "public, max-age=300, stale-while-revalidate=600" } });
  } catch (error) {
    console.error("Public hydro trends error:", error?.message || error);
    return NextResponse.json({ success: false, message: "ยังโหลดข้อมูลแนวโน้มไม่ได้ในขณะนี้" }, { status: 503 });
  }
}
