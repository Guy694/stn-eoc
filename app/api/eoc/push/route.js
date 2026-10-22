import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { validateSubscriptionInput } from "@/lib/publicPush";
import { findOfficerSubscription, releaseOfficerSubscription, saveOfficerSubscription } from "@/lib/publicPushServer";
import { isAllowedPushEndpoint, vapidConfig } from "@/lib/webPush";

// เจ้าหน้าที่เปิด/ปิด "แจ้งเตือนคำขอความช่วยเหลือเข้ามือถือ" บนเครื่องที่ใช้อยู่
const ROLES = ["admin", "commander", "MCATT", "SAT", "SEhRT", "staff"];
export const dynamic = "force-dynamic";
const noStore = { "Cache-Control": "private, no-store" };
const notReady = () => NextResponse.json({ success: false, message: "ระบบแจ้งเตือนยังไม่พร้อม (ยังไม่ได้ตั้งค่า VAPID หรือยังไม่ได้รัน migration 20261010_public_push / push_officer)" }, { status: 503, headers: noStore });

export async function GET(request) {
  const auth = await requireAuth(request, ROLES);
  if (!auth.success) return auth.response;
  const vapid = vapidConfig();
  const endpoint = new URL(request.url).searchParams.get("endpoint");
  let subscribed = false;
  if (vapid && endpoint && isAllowedPushEndpoint(endpoint)) subscribed = await findOfficerSubscription(endpoint, auth.user.id).catch(() => false);
  return NextResponse.json({ success: true, enabled: Boolean(vapid), public_key: vapid?.publicKey || null, subscribed }, { headers: noStore });
}

export async function POST(request) {
  const auth = await requireAuth(request, ROLES);
  if (!auth.success) return auth.response;
  if (!vapidConfig()) return notReady();
  try {
    const body = await request.json().catch(() => ({}));
    const checked = validateSubscriptionInput({ subscription: body.subscription }, { isAllowedEndpoint: isAllowedPushEndpoint });
    if (checked.error) return NextResponse.json({ success: false, message: checked.error }, { status: 400, headers: noStore });
    await saveOfficerSubscription(checked.value, auth.user.id, request.headers.get("user-agent"));
    return NextResponse.json({ success: true, message: "เครื่องนี้จะได้รับแจ้งเตือนคำขอความช่วยเหลือแล้ว" }, { headers: noStore });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") return notReady();
    console.error("Officer push POST error:", error?.message || error);
    return publicInternalError("เปิดแจ้งเตือนไม่สำเร็จ");
  }
}

export async function DELETE(request) {
  const auth = await requireAuth(request, ROLES);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (!isAllowedPushEndpoint(body.endpoint)) return NextResponse.json({ success: false, message: "ปลายทางไม่ถูกต้อง" }, { status: 400, headers: noStore });
    await releaseOfficerSubscription(body.endpoint, auth.user.id);
    return NextResponse.json({ success: true, message: "ปิดแจ้งเตือนงานบนเครื่องนี้แล้ว" }, { headers: noStore });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE" || error?.code === "ER_BAD_FIELD_ERROR") return notReady();
    console.error("Officer push DELETE error:", error?.message || error);
    return publicInternalError("ปิดแจ้งเตือนไม่สำเร็จ");
  }
}
