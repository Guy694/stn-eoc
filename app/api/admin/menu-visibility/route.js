import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { transaction } from "@/lib/db";
import { recordChange } from "@/lib/recordArchive";
import { invalidateHiddenMenus, loadHiddenMenus } from "@/lib/eocModuleOwners";
import { PROTECTED_MENU_KEYS, buildMenuCatalog, catalogKeys } from "@/lib/menuVisibility";

// เปิด/ปิดเมนูหลังบ้าน (เฉพาะแอดมิน) — ซ่อนจากเมนูข้างของทุกบทบาท
const bad = (message, status = 400) => NextResponse.json({ success: false, message }, { status });

export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const hidden = await loadHiddenMenus();
    return NextResponse.json({ success: true, catalog: buildMenuCatalog(), hidden });
  } catch (error) {
    console.error("Menu visibility GET error:", error);
    return publicInternalError("โหลดการเปิด/ปิดเมนูไม่สำเร็จ");
  }
}

// PUT { hidden: ["flood:records", "path:/admin/trash"] } — แทนที่รายการเมนูที่ปิดทั้งหมด
export async function PUT(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    if (!Array.isArray(body.hidden)) return bad("รูปแบบข้อมูลไม่ถูกต้อง");
    const valid = catalogKeys();
    const hidden = [...new Set(body.hidden.map(String))];
    if (hidden.some((key) => !valid.has(key))) return bad("พบเมนูที่ไม่มีในระบบ");
    if (hidden.some((key) => PROTECTED_MENU_KEYS.includes(key))) return bad("ปิดเมนูตั้งค่าระบบไม่ได้ เพราะจะเข้ามาเปิดเมนูกลับไม่ได้");

    await transaction(async (execute) => {
      await execute("DELETE FROM eoc_menu_hidden", []);
      for (const key of hidden) await execute("INSERT INTO eoc_menu_hidden (menu_key, hidden_by) VALUES (?, ?)", [key, auth.user.id]);
    });
    invalidateHiddenMenus();
    await recordChange({
      request, user: auth.user, action: "data_update", table: "eoc_menu_hidden", id: "all",
      description: hidden.length ? `ปิดเมนูหลังบ้าน ${hidden.length} เมนู` : "เปิดเมนูหลังบ้านทุกเมนู"
    });
    return NextResponse.json({ success: true, message: hidden.length ? `บันทึกแล้ว ปิดเมนู ${hidden.length} เมนู` : "บันทึกแล้ว เปิดเมนูทุกเมนู", hidden });
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE") return bad("ยังไม่ได้ติดตั้งตารางเปิด/ปิดเมนู กรุณารัน migration (./scripts/docker-migrate.sh up)", 503);
    console.error("Menu visibility PUT error:", error);
    return publicInternalError("บันทึกการเปิด/ปิดเมนูไม่สำเร็จ");
  }
}
