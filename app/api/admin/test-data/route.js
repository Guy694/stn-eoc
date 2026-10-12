import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query, transaction } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { recordChange } from "@/lib/recordArchive";
import { runTestDataCleanup } from "@/lib/testDataCleanup.mjs";

// ข้อมูลทดสอบ (ติดป้าย "[ทดสอบ]"): GET = นับว่ามีอะไรบ้าง, POST { confirm: "ลบข้อมูลทดสอบ" } = ลบจริงในธุรกรรมเดียว
export const dynamic = "force-dynamic";
const CONFIRM_TEXT = "ลบข้อมูลทดสอบ";

export async function GET(request) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const results = await runTestDataCleanup((sql, params) => query(sql, params));
    return NextResponse.json({ success: true, total: results.reduce((sum, row) => sum + row.count, 0), results, confirm_text: CONFIRM_TEXT });
  } catch (error) {
    console.error("Test data count error:", error);
    return publicInternalError("ไม่สามารถนับข้อมูลทดสอบได้");
  }
}

export async function POST(request) {
  try {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;
    const body = await request.json().catch(() => ({}));
    if (String(body.confirm || "").trim() !== CONFIRM_TEXT) {
      return NextResponse.json({ success: false, message: `พิมพ์ "${CONFIRM_TEXT}" เพื่อยืนยัน` }, { status: 400 });
    }
    const results = await transaction(async (_execute, connection) => runTestDataCleanup(async (sql, params) => {
      const [result] = await connection.query(sql, params);
      return result;
    }, { apply: true }));
    const total = results.reduce((sum, row) => sum + row.count, 0);
    await recordChange({
      request, user: auth.user, action: "data_delete", table: "test_data", id: "-",
      description: `ลบข้อมูลทดสอบ [ทดสอบ] ${total} แถว: ${results.filter((row) => row.count).map((row) => `${row.label} ${row.count}`).join(", ") || "-"}`
    });
    return NextResponse.json({ success: true, total, results, message: `ลบข้อมูลทดสอบแล้ว ${total} แถว` });
  } catch (error) {
    console.error("Test data cleanup error:", error);
    return publicInternalError("ลบข้อมูลทดสอบไม่สำเร็จ ไม่มีการลบใด ๆ");
  }
}
