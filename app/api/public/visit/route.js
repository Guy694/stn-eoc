import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { recordVisitorAccess } from "@/lib/visitorLogServer";

// บันทึกการเข้าชมเพื่อความปลอดภัย (IP + ตำแหน่งโดยประมาณ) — เรียกจาก components/VisitBeacon.jsx
// ตอบ 204 เสมอ (ผู้เข้าชมไม่ต้องรู้ผล และไม่ให้ผู้ยิงซ้ำรู้ว่าถูกกรอง)
export async function POST(request) {
  try {
    const limit = await consumeRateLimit("visitLog", getClientIp(request), { store: "memory" });
    if (!limit.allowed) return new NextResponse(null, { status: 204 });
    const body = await request.json().catch(() => ({}));
    await recordVisitorAccess(request, { path: body?.path, referrer: body?.referrer, gps: body?.gps });
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") console.error("Visitor log error:", error?.message || error);
  }
  return new NextResponse(null, { status: 204 });
}
