import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getAlertSoundSettings, saveAlertSoundSettings } from "@/lib/alertSoundSettings";
import { SOUND_LEVELS, SOUND_STYLES } from "@/lib/alertSound";
import { recordChange } from "@/lib/recordArchive";

// ตั้งเสียงแจ้งเตือนของทั้งระบบ (ผู้ดูแลระบบ)
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  return NextResponse.json({ success: true, data: await getAlertSoundSettings({ fresh: true }) }, { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const before = await getAlertSoundSettings({ fresh: true });
    const data = await saveAlertSoundSettings({ ...before, ...body }, auth.user);
    const text = Object.keys(SOUND_LEVELS).map((level) => `${SOUND_LEVELS[level].label}: ${SOUND_STYLES[data[level]].label}`).join(", ");
    await recordChange({ request, user: auth.user, action: "data_update", table: "system_settings", id: "alert_sounds", description: `ตั้งเสียงแจ้งเตือน (${text}, ดัง ${Math.round(data.volume * 100)}%, เสียงพูด${data.voice ? "เปิด" : "ปิด"})`, oldValues: before, newValues: data }).catch(() => {});
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration ตาราง system_settings" }, { status: 503 });
    console.error("Alert sounds PUT error:", error?.message || error);
    return publicInternalError("บันทึกเสียงแจ้งเตือนไม่สำเร็จ");
  }
}
