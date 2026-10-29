import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { readSatisfaction } from "@/lib/satisfactionServer";

// ผลประเมินความพึงพอใจ (เมนูผู้เข้าชม) — ผู้ดูแลระบบเท่านั้น · GET ?days=&rating=&comments=1
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const params = new URL(request.url).searchParams;
    const data = await readSatisfaction({ days: Number(params.get("days")) || 30, rating: params.get("rating"), commentsOnly: params.get("comments") === "1" });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261028_satisfaction_feedback.sql" }, { status: 503 });
    console.error("Satisfaction GET error:", error?.message || error);
    return publicInternalError("โหลดผลประเมินไม่สำเร็จ");
  }
}
