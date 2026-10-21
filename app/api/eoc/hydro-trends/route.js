import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { loadHydroTrends } from "@/lib/hydroHistoryServer";

// แนวโน้มฝน ระดับน้ำในคลอง และน้ำทะเลหนุน (ข้อมูลที่ระบบเก็บรายชั่วโมง) — ?days=7|30|90&amphoe=
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const data = await loadHydroTrends({ days: params.get("days"), amphoe: params.get("amphoe") || null });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "private, max-age=120" } });
  } catch (error) {
    console.error("Hydro trends error:", error?.message || error);
    return publicInternalError("โหลดข้อมูลแนวโน้มไม่สำเร็จ");
  }
}
