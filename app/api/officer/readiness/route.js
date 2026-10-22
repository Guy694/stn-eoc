import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { normalizeReadinessInput, readinessMeta } from "@/lib/officerReadiness";
import { getReadiness, notifyNeedHelp, setReadiness } from "@/lib/officerReadinessServer";
import { recordChange } from "@/lib/recordArchive";

// สถานะความพร้อมของตัวเอง (เมนู "สถานะของฉัน")
const notInstalled = () => NextResponse.json({ success: false, message: "ยังไม่ได้ติดตั้งตารางสถานะความพร้อม กรุณารัน migration (./scripts/docker-migrate.sh up)" }, { status: 409 });

export async function GET(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  try {
    return NextResponse.json({ success: true, data: await getReadiness(auth.user.id) });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return notInstalled();
    console.error("Readiness GET error:", error);
    return publicInternalError("โหลดสถานะไม่สำเร็จ");
  }
}

export async function PUT(request) {
  const auth = await requireAuth(request, OFFICER_ROLES);
  if (!auth.success) return auth.response;
  try {
    const input = normalizeReadinessInput(await request.json().catch(() => ({})));
    if (!input.ok) return NextResponse.json({ success: false, message: input.error }, { status: 400 });
    const { status, note } = input.value;
    const { previous } = await setReadiness({ officerId: auth.user.id, status, note, source: "self", updatedBy: auth.user.id });
    if (status === "need_help" && previous !== "need_help") notifyNeedHelp({ ...auth.user, given_name: auth.user.givenName, family_name: auth.user.familyName }, note);
    await recordChange({
      request, user: auth.user, action: "data_update", table: "officer_readiness", id: auth.user.id,
      description: `รายงานสถานะความพร้อม: ${readinessMeta(status).label}${note ? ` (${note})` : ""}`
    });
    return NextResponse.json({ success: true, message: `บันทึกสถานะ "${readinessMeta(status).label}" แล้ว`, data: await getReadiness(auth.user.id) });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return notInstalled();
    console.error("Readiness PUT error:", error);
    return publicInternalError("บันทึกสถานะไม่สำเร็จ");
  }
}
