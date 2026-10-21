import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { validateBroadcastInput } from "@/lib/publicPush";
import { broadcast, getPushSettings, hidePushLog, pushStats, runPublicPushAlerts, savePushSettings } from "@/lib/publicPushServer";
import { recordChange } from "@/lib/recordArchive";
import { isAllowedPushEndpoint, vapidConfig } from "@/lib/webPush";

// จัดการแจ้งเตือนภัยถึงประชาชน: ดูยอดผู้รับ/ประวัติ (ผู้ดูแลระบบ/ผู้บัญชาการ) เปิดปิดการส่งอัตโนมัติ (ผู้ดูแลระบบ) ส่งข้อความเอง
export const dynamic = "force-dynamic";
const MANAGERS = ["admin", "commander"];
const migrationMessage = () => NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261010_public_push.sql" }, { status: 503 });

export async function GET(request) {
  const auth = await requireAuth(request, MANAGERS);
  if (!auth.success) return auth.response;
  try {
    const [settings, stats] = await Promise.all([getPushSettings(), pushStats().catch((error) => (error?.code === "ER_NO_SUCH_TABLE" ? null : Promise.reject(error)))]);
    return NextResponse.json({ success: true, data: { vapid_ready: Boolean(vapidConfig()), table_ready: stats !== null, settings, stats } }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Admin public push GET error:", error?.message || error);
    return publicInternalError("โหลดข้อมูลการแจ้งเตือนไม่สำเร็จ");
  }
}

export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const before = await getPushSettings();
    const next = {
      auto_enabled: typeof body.auto_enabled === "boolean" ? body.auto_enabled : before.auto_enabled,
      auto_level: body.auto_level === "watch" || body.auto_level === "high" ? body.auto_level : before.auto_level
    };
    const data = await savePushSettings(next, auth.user);
    const description = before.auto_level !== data.auto_level
      ? `เปลี่ยนระดับการส่งเตือนภัยอัตโนมัติเป็น "${data.auto_level === "watch" ? "รวมระดับเฝ้าระวัง" : "เฉพาะเหตุรุนแรง"}"`
      : data.auto_enabled ? "เปิดส่งแจ้งเตือนภัยถึงประชาชนอัตโนมัติ" : "ปิดส่งแจ้งเตือนภัยถึงประชาชนอัตโนมัติ";
    await recordChange({ request, user: auth.user, action: "data_update", table: "system_settings", id: "public_push", description, oldValues: before, newValues: data });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261009_system_settings.sql" }, { status: 503 });
    console.error("Admin public push PUT error:", error?.message || error);
    return publicInternalError("บันทึกการตั้งค่าไม่สำเร็จ");
  }
}

// POST { action: 'broadcast'|'test'|'run', title, body, url, districts, level, endpoint }
export async function POST(request) {
  const auth = await requireAuth(request, MANAGERS);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (body.action === "run") {
      const result = await runPublicPushAlerts({ force: true });
      return NextResponse.json({ success: true, data: result, message: result.skipped === "no_vapid" ? "ยังไม่ได้ตั้งค่า VAPID" : result.sent ? `ส่งเตือนภัย ${result.sent} เรื่อง ถึง ${result.delivered} เครื่อง` : "ไม่มีประกาศเตือนระดับสูงเรื่องใหม่" });
    }
    const checked = validateBroadcastInput(body);
    if (checked.error) return NextResponse.json({ success: false, message: checked.error }, { status: 400 });
    const test = body.action === "test";
    if (test && !isAllowedPushEndpoint(body.endpoint)) return NextResponse.json({ success: false, message: "เครื่องนี้ยังไม่ได้เปิดรับแจ้งเตือน" }, { status: 400 });
    const stats = await broadcast(checked.value, { user: auth.user, testEndpoint: test ? body.endpoint : null });
    if (!test) {
      await recordChange({ request, user: auth.user, action: "data_create", table: "public_push_log", id: "-", description: `ส่งแจ้งเตือนถึง${checked.value.audience === "officers" ? "เจ้าหน้าที่" : "ประชาชน"} "${checked.value.title}" ${stats.delivered}/${stats.recipients} เครื่อง`, newValues: checked.value }).catch(() => {});
    }
    return NextResponse.json({ success: true, data: stats, message: test ? (stats.delivered ? "ส่งทดสอบถึงเครื่องนี้แล้ว" : stats.errors ? `ส่งทดสอบไม่สำเร็จ: ผู้ให้บริการตอบ ${Object.keys(stats.errors).join(", ")}${/BadJwtToken/.test(Object.keys(stats.errors).join(" ")) ? " — ตั้ง VAPID_SUBJECT เป็นอีเมลหรือเว็บจริงของหน่วยงาน" : ""}` : "ส่งทดสอบไม่สำเร็จ (เครื่องนี้ยังไม่ได้สมัคร หรือสมัครด้วยกุญแจเก่า)") : `ส่งแล้ว ${stats.delivered} จาก ${stats.recipients} เครื่อง` });
  } catch (error) {
    if (error?.code === "NO_VAPID") return NextResponse.json({ success: false, message: error.message }, { status: 503 });
    if (error?.code === "ER_NO_SUCH_TABLE") return migrationMessage();
    console.error("Admin public push POST error:", error?.message || error);
    return publicInternalError("ส่งแจ้งเตือนไม่สำเร็จ");
  }
}

// DELETE { ids: [..] } — ลบรายการออกจากประวัติการส่ง (เช่น ข้อความทดสอบ) ไม่แสดงทั้งหน้านี้และหน้าประกาศของประชาชน
// ข้อความที่ส่งถึงมือถือไปแล้วเรียกคืนไม่ได้ ลบได้เฉพาะประวัติ
export async function DELETE(request) {
  const auth = await requireAuth(request, MANAGERS);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body.ids) ? body.ids : [];
    if (!ids.length || ids.length > 100) return NextResponse.json({ success: false, message: "เลือกรายการที่จะลบ (ไม่เกิน 100 รายการ)" }, { status: 400 });
    const rows = await hidePushLog(ids, auth.user);
    if (!rows.length) return NextResponse.json({ success: false, message: "ไม่พบรายการ หรือถูกลบไปแล้ว" }, { status: 404 });
    const names = rows.slice(0, 5).map((row) => `"${row.title}"`).join(", ");
    await recordChange({ request, user: auth.user, action: "data_delete", table: "public_push_log", id: rows.map((row) => row.id).join(","), description: `ลบประวัติการส่งแจ้งเตือน ${rows.length} รายการ: ${names}${rows.length > 5 ? " …" : ""}` }).catch(() => {});
    return NextResponse.json({ success: true, data: { removed: rows.length }, message: `ลบออกจากประวัติแล้ว ${rows.length} รายการ` });
  } catch (error) {
    if (error?.code === "ER_BAD_FIELD_ERROR") return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261021_push_log_hidden.sql" }, { status: 503 });
    if (error?.code === "ER_NO_SUCH_TABLE") return migrationMessage();
    console.error("Admin public push DELETE error:", error?.message || error);
    return publicInternalError("ลบประวัติไม่สำเร็จ");
  }
}
