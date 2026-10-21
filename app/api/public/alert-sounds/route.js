import { NextResponse } from "next/server";
import { getAlertSoundSettings } from "@/lib/alertSoundSettings";

// เสียงแจ้งเตือนที่แอดมินตั้งไว้ (หน้าเว็บทุกหน้าโหลดไปใช้) — ข้อมูลไม่ลับ ไม่ต้องเข้าสู่ระบบ
export const dynamic = "force-dynamic";

export async function GET() {
  const { updated_by_name: _by, ...data } = await getAlertSoundSettings();
  return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "public, max-age=60" } });
}
