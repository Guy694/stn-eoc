import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { readContentViews } from "@/lib/contentViewsServer";

// ยอดเข้าชมประกาศและความรู้ (เมนู "ผู้เข้าชม") — ผู้ดูแลระบบเท่านั้น · GET ?days=7|30|90|365
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const data = await readContentViews({ days: Number(new URL(request.url).searchParams.get("days")) || 30 });
    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Content views error:", error?.message || error);
    return publicInternalError("โหลดยอดเข้าชมไม่สำเร็จ");
  }
}
