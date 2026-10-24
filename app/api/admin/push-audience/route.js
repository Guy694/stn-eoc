import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { pushAudienceStats } from "@/lib/publicPushServer";

// ผู้รับแจ้งเตือนภัย (เมนู "ผู้เข้าชม" › แท็บผู้รับแจ้งเตือน) — ผู้ดูแลระบบเท่านั้น
// GET ?days=7|30|90|365
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const days = Number(new URL(request.url).searchParams.get("days")) || 30;
    const data = await pushAudienceStats({ days });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261010_public_push.sql" }, { status: 503 });
    console.error("Push audience error:", error?.message || error);
    return publicInternalError("โหลดข้อมูลผู้รับแจ้งเตือนไม่สำเร็จ");
  }
}
