import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { HII_IMAGE_BASE } from "@/lib/forecastSignals";

// ส่งต่อภาพพยากรณ์ฝนของ สสน. ผ่านโดเมนของระบบ เพื่อให้บันทึกรายงานเป็นรูปได้ (ภาพข้ามโดเมนวาดลง canvas ไม่ได้)
// รับเฉพาะ path ของภาพบน api-v3.thaiwater.net เท่านั้น
const SAFE_PATH = /^[A-Za-z0-9_\-./]{1,300}$/;

export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  const image = new URL(request.url).searchParams.get("image") || "";
  if (!SAFE_PATH.test(image) || image.includes("..")) {
    return NextResponse.json({ success: false, message: "ไม่รองรับภาพนี้" }, { status: 400 });
  }
  try {
    const response = await fetch(`${HII_IMAGE_BASE}${image}`, { cache: "no-store", signal: AbortSignal.timeout(15000), headers: { "User-Agent": "Satun-Geo-EOC/1.0 (+flood report)" } });
    const type = response.headers.get("content-type") || "";
    if (!response.ok || !type.startsWith("image/")) {
      return NextResponse.json({ success: false, message: "ดึงภาพจาก สสน. ไม่ได้" }, { status: 502 });
    }
    return new NextResponse(await response.arrayBuffer(), {
      headers: { "Content-Type": type, "Cache-Control": "private, max-age=3600" }
    });
  } catch {
    return NextResponse.json({ success: false, message: "ดึงภาพจาก สสน. ไม่ได้" }, { status: 502 });
  }
}
