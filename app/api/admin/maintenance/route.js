import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { getMaintenanceState, saveMaintenanceState } from "@/lib/maintenance";
import { validateMaintenanceInput } from "@/lib/maintenanceRules";
import { recordChange } from "@/lib/recordArchive";

// โหมดปิดปรับปรุงระบบ — เฉพาะผู้ดูแลระบบ
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    return NextResponse.json({ success: true, data: await getMaintenanceState({ fresh: true }) });
  } catch (error) {
    console.error("Maintenance GET error:", error?.message || error);
    return publicInternalError("อ่านสถานะการปิดปรับปรุงไม่สำเร็จ");
  }
}

export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const checked = validateMaintenanceInput(body);
    if (checked.error) return NextResponse.json({ success: false, message: checked.error }, { status: 400 });
    const before = await getMaintenanceState({ fresh: true });
    const data = await saveMaintenanceState(checked.value, auth.user);
    const changed = before.enabled !== data.enabled;
    await recordChange({
      request,
      user: auth.user,
      action: "data_update",
      table: "system_settings",
      id: "maintenance",
      description: changed ? (data.enabled ? "เปิดโหมดปิดปรับปรุงระบบ" : "ปิดโหมดปิดปรับปรุง เปิดระบบให้ใช้งานตามปกติ") : "แก้ไขข้อความ/เวลาของโหมดปิดปรับปรุงระบบ",
      oldValues: before,
      newValues: data
    });
    return NextResponse.json({
      success: true,
      data,
      message: data.enabled ? "ปิดปรับปรุงระบบแล้ว ผู้ใช้ทั่วไปจะเห็นหน้าแจ้งปิดปรับปรุงภายใน 10 วินาที" : "เปิดระบบให้ใช้งานตามปกติแล้ว"
    });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261009_system_settings.sql" }, { status: 503 });
    }
    console.error("Maintenance PUT error:", error?.message || error);
    return publicInternalError("บันทึกการตั้งค่าไม่สำเร็จ");
  }
}
