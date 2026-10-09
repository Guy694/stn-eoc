import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { validateSubscriptionInput } from "@/lib/publicPush";
import { findSubscription, removeSubscription, replaceSubscription, saveSubscription } from "@/lib/publicPushServer";
import { isAllowedPushEndpoint, vapidConfig } from "@/lib/webPush";

// สมัครรับแจ้งเตือนภัย (Web Push) — ไม่ต้องเข้าสู่ระบบ ไม่เก็บข้อมูลส่วนตัว
// GET  ?endpoint= → สถานะ + กุญแจสาธารณะ VAPID
// POST { subscription, scope, districts, tambons } สมัคร/แก้พื้นที่
// PUT  { old_endpoint, subscription } (service worker ย้ายปลายทาง)
// DELETE { endpoint } ยกเลิก
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "no-store" };
const tableMissing = (error) => error?.code === "ER_NO_SUCH_TABLE";
const unavailable = () => NextResponse.json({ success: false, message: "ระบบแจ้งเตือนยังไม่พร้อม (ยังไม่ได้ตั้งค่าเซิร์ฟเวอร์)" }, { status: 503, headers: noStore });

export async function GET(request) {
  const vapid = vapidConfig();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  let subscription = null;
  if (vapid && endpoint && isAllowedPushEndpoint(endpoint)) subscription = await findSubscription(endpoint).catch(() => null);
  return NextResponse.json({ success: true, enabled: Boolean(vapid), public_key: vapid?.publicKey || null, subscription }, { headers: noStore });
}

async function handleWrite(request, handler) {
  try {
    if (!vapidConfig()) return unavailable();
    const limited = await enforceIpRateLimit(request, "publicPush");
    if (limited) return limited;
    const body = await request.json().catch(() => ({}));
    return await handler(body);
  } catch (error) {
    if (tableMissing(error)) return unavailable();
    console.error("Public push API error:", error?.message || error);
    return publicInternalError("บันทึกการแจ้งเตือนไม่สำเร็จ");
  }
}

export async function POST(request) {
  return handleWrite(request, async (body) => {
    const checked = validateSubscriptionInput(body, { isAllowedEndpoint: isAllowedPushEndpoint });
    if (checked.error) return NextResponse.json({ success: false, message: checked.error }, { status: 400, headers: noStore });
    await saveSubscription(checked.value, request.headers.get("user-agent"));
    return NextResponse.json({ success: true, message: "รับแจ้งเตือนแล้ว" }, { headers: noStore });
  });
}

export async function PUT(request) {
  return handleWrite(request, async (body) => {
    const checked = validateSubscriptionInput({ subscription: body.subscription }, { isAllowedEndpoint: isAllowedPushEndpoint });
    if (checked.error) return NextResponse.json({ success: false, message: checked.error }, { status: 400, headers: noStore });
    const old = typeof body.old_endpoint === "string" && isAllowedPushEndpoint(body.old_endpoint) ? body.old_endpoint : null;
    await replaceSubscription(old, checked.value, request.headers.get("user-agent"));
    return NextResponse.json({ success: true }, { headers: noStore });
  });
}

export async function DELETE(request) {
  return handleWrite(request, async (body) => {
    const endpoint = typeof body.endpoint === "string" ? body.endpoint : "";
    if (!isAllowedPushEndpoint(endpoint)) return NextResponse.json({ success: false, message: "ปลายทางไม่ถูกต้อง" }, { status: 400, headers: noStore });
    await removeSubscription(endpoint);
    return NextResponse.json({ success: true, message: "ยกเลิกการแจ้งเตือนแล้ว" }, { headers: noStore });
  });
}
