import { NextResponse } from "next/server";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { validateSatisfaction } from "@/lib/satisfaction";
import { saveSatisfaction } from "@/lib/satisfactionServer";

// ประเมินความพึงพอใจระบบ — POST { rating: 1–5, comment?, sources?: [facebook|line|…], sourceOther?, path } · ไม่ต้องเข้าสู่ระบบ ไม่เก็บชื่อ/เบอร์/IP
export const dynamic = "force-dynamic";

export async function POST(request) {
  const limited = await enforceIpRateLimit(request, "satisfaction", { store: "memory" });
  if (limited) return limited;
  try {
    const body = await request.json().catch(() => ({}));
    const checked = validateSatisfaction(body);
    if (checked.error) return NextResponse.json({ success: false, message: checked.error }, { status: 400 });
    await saveSatisfaction(request, { ...checked.value, path: typeof body.path === "string" ? body.path : "/" });
    return NextResponse.json({ success: true, message: "ขอบคุณสำหรับการประเมิน" });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: false, message: "ระบบประเมินยังไม่พร้อม ลองใหม่ภายหลัง" }, { status: 503 });
    console.error("Satisfaction POST error:", error?.message || error);
    return NextResponse.json({ success: false, message: "บันทึกการประเมินไม่สำเร็จ ลองใหม่อีกครั้ง" }, { status: 500 });
  }
}
