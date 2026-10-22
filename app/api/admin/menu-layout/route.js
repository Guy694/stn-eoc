import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { query, transaction } from "@/lib/db";
import { recordChange } from "@/lib/recordArchive";
import { invalidateMenuLayout, loadMenuLayout, loadOwnerOverrides } from "@/lib/eocModuleOwners";
import { EVENT_MODULES, eventMenuItems } from "@/src/config/navigation/admin-navigation";
import { normalizeLayoutInput } from "@/lib/menuLayout";

// จัดกลุ่มและลำดับเมนูของเหตุการณ์ในเมนูข้าง (เฉพาะแอดมิน)
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const [overrides, layout] = await Promise.all([loadOwnerOverrides(), loadMenuLayout()]);
    const types = Object.entries(EVENT_MODULES).map(([eocType, definition]) => {
      const defaults = definition.items({});
      return {
        eocType,
        label: definition.label,
        customized: defaults.some((item) => Object.prototype.hasOwnProperty.call(layout, `${eocType}:${item.key}`)),
        defaults: defaults.map((item) => ({ key: item.key, group: item.group || "" })),
        items: eventMenuItems(eocType, { overrides, layout }).map((item) => ({
          key: item.key, name: item.name, group: item.group || "", ownerLabel: item.ownerLabel, description: item.description || ""
        }))
      };
    });
    return NextResponse.json({ success: true, types });
  } catch (error) {
    console.error("Menu layout GET error:", error);
    return publicInternalError("โหลดการจัดกลุ่มเมนูไม่สำเร็จ");
  }
}

// PUT { eoc_type, items: [{ key, group }] } — ลำดับในอาร์เรย์ = ลำดับในเมนู
export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const definition = EVENT_MODULES[body.eoc_type];
    if (!definition) return bad("ไม่พบประเภทเหตุการณ์");
    const keys = definition.items({}).map((item) => item.key);
    const input = normalizeLayoutInput(body.items, keys);
    if (!input.ok) return bad(input.error);
    // เมนูที่ไม่ได้ส่งมา ต่อท้ายตามลำดับเดิม (กันเมนูหาย)
    const missing = keys.filter((key) => !input.value.some((item) => item.key === key));
    const rows = [...input.value, ...missing.map((key, index) => ({ key, group: null, order: input.value.length + index }))];

    await transaction(async (execute) => {
      await execute("DELETE FROM eoc_menu_layout WHERE eoc_type = ?", [body.eoc_type]);
      for (const row of rows) {
        await execute(
          "INSERT INTO eoc_menu_layout (eoc_type, module_key, group_name, sort_order, updated_by) VALUES (?, ?, ?, ?, ?)",
          [body.eoc_type, row.key, row.group, row.order, auth.user.id]
        );
      }
    });
    invalidateMenuLayout();
    const groups = [...new Set(input.value.map((item) => item.group).filter(Boolean))];
    await recordChange({
      request, user: auth.user, action: "data_update", table: "eoc_menu_layout", id: body.eoc_type,
      description: `จัดกลุ่มเมนู${definition.label}: ${groups.length ? groups.join(" / ") : "ไม่แบ่งกลุ่ม"}`
    });
    return NextResponse.json({ success: true, message: `บันทึกการจัดกลุ่มเมนู${definition.label}แล้ว` });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return bad("ยังไม่ได้ติดตั้งตารางจัดกลุ่มเมนู กรุณารัน migration (./scripts/docker-migrate.sh up)", 409);
    console.error("Menu layout PUT error:", error);
    return publicInternalError("บันทึกการจัดกลุ่มเมนูไม่สำเร็จ");
  }
}

// DELETE ?eoc_type= — คืนค่าเริ่มต้น
export async function DELETE(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const eocType = new URL(request.url).searchParams.get("eoc_type");
    const definition = EVENT_MODULES[eocType];
    if (!definition) return bad("ไม่พบประเภทเหตุการณ์");
    await query("DELETE FROM eoc_menu_layout WHERE eoc_type = ?", [eocType]);
    invalidateMenuLayout();
    await recordChange({ request, user: auth.user, action: "data_update", table: "eoc_menu_layout", id: eocType, description: `คืนค่าเริ่มต้นการจัดกลุ่มเมนู${definition.label}` });
    return NextResponse.json({ success: true, message: `คืนค่าเริ่มต้นเมนู${definition.label}แล้ว` });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return NextResponse.json({ success: true, message: "ใช้ค่าเริ่มต้นอยู่แล้ว" });
    console.error("Menu layout DELETE error:", error);
    return publicInternalError("คืนค่าเริ่มต้นไม่สำเร็จ");
  }
}
