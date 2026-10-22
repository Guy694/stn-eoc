import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query } from "@/lib/db";
import { normalizeReadinessInput, readinessMeta, summarizeReadiness } from "@/lib/officerReadiness";
import { listReadiness, notifyNeedHelp, readinessHistory, setReadiness } from "@/lib/officerReadinessServer";
import { recordChange } from "@/lib/recordArchive";

// แดชบอร์ดความพร้อมเจ้าหน้าที่ — ดู: แอดมิน/ผู้บัญชาการ · เปลี่ยนสถานะแทน: แอดมิน
const VIEWERS = ["admin", "commander"];
const notInstalled = () => NextResponse.json({ success: false, message: "ยังไม่ได้ติดตั้งตารางสถานะความพร้อม กรุณารัน migration (./scripts/docker-migrate.sh up)" }, { status: 409 });

export async function GET(request) {
  const auth = await requireAuth(request, VIEWERS);
  if (!auth.success) return auth.response;
  try {
    const historyId = Number(new URL(request.url).searchParams.get("history"));
    if (historyId) return NextResponse.json({ success: true, history: await readinessHistory(historyId) });
    const rows = await listReadiness();
    return NextResponse.json({ success: true, rows, summary: summarizeReadiness(rows), canEdit: auth.user.role === "admin" });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return notInstalled();
    console.error("Officer readiness GET error:", error);
    return publicInternalError("โหลดสถานะความพร้อมไม่สำเร็จ");
  }
}

// PUT { officer_ids: [1,2] | officer_id, status, note }
export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const ids = [...new Set((Array.isArray(body.officer_ids) ? body.officer_ids : [body.officer_id]).map(Number).filter((id) => Number.isInteger(id) && id > 0))];
    if (!ids.length || ids.length > 500) return NextResponse.json({ success: false, message: "เลือกเจ้าหน้าที่อย่างน้อย 1 คน" }, { status: 400 });
    const input = normalizeReadinessInput(body);
    if (!input.ok) return NextResponse.json({ success: false, message: input.error }, { status: 400 });
    const { status, note } = input.value;

    const officers = await query(
      `SELECT id, username, title, given_name, family_name, department, phone FROM officer WHERE id IN (${ids.map(() => "?").join(",")}) AND COALESCE(is_approved, 0) = 1`,
      ids
    );
    if (!officers.length) return NextResponse.json({ success: false, message: "ไม่พบเจ้าหน้าที่" }, { status: 404 });
    for (const officer of officers) {
      const { previous } = await setReadiness({ officerId: officer.id, status, note, source: "admin", updatedBy: auth.user.id });
      if (status === "need_help" && previous !== "need_help") notifyNeedHelp(officer, note);
    }
    const label = readinessMeta(status).label;
    await recordChange({
      request, user: auth.user, action: "data_update", table: "officer_readiness", id: officers.map((item) => item.id).join(",").slice(0, 60),
      description: `ปรับสถานะความพร้อมเป็น "${label}" ให้ ${officers.length === 1 ? officers[0].username : `${officers.length} คน`}${note ? ` (${note})` : ""}`
    });
    return NextResponse.json({ success: true, message: `ปรับสถานะเป็น "${label}" แล้ว ${officers.length} คน`, updated: officers.length });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return notInstalled();
    console.error("Officer readiness PUT error:", error);
    return publicInternalError("บันทึกสถานะไม่สำเร็จ");
  }
}
