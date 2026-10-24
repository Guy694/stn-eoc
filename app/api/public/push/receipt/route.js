import { NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/rateLimit";
import { getClientIp } from "@/lib/clientIp";
import { validateReceiptInput } from "@/lib/publicPush";
import { recordReceipt } from "@/lib/publicPushServer";
import { isAllowedPushEndpoint } from "@/lib/webPush";

// สัญญาณจาก service worker (public/sw.js): แจ้งเตือนขึ้นบนเครื่องแล้ว (shown) / ผู้ใช้กดเปิด (opened)
// POST { ids: [public_push_log.id], event, endpoint } — รับเฉพาะเครื่องที่สมัครไว้จริง ไม่เก็บ IP
// ตอบ 204 เสมอ (เครื่องผู้รับไม่ต้องรู้ผล และไม่บอกผู้ยิงซ้ำว่าถูกกรอง)
export const dynamic = "force-dynamic";

export async function POST(request) {
  try {
    const limit = await consumeRateLimit("pushReceipt", getClientIp(request), { store: "memory" });
    if (!limit.allowed) return new NextResponse(null, { status: 204 });
    const body = await request.json().catch(() => ({}));
    const checked = validateReceiptInput(body, { isAllowedEndpoint: isAllowedPushEndpoint });
    if (checked.value) await recordReceipt(checked.value);
  } catch (error) {
    if (error?.code !== "ER_NO_SUCH_TABLE") console.error("Push receipt error:", error?.message || error);
  }
  return new NextResponse(null, { status: 204 });
}
