import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { pendingHelpRequests } from "@/lib/helpAlertsServer";

// คำขอความช่วยเหลือที่ยังไม่มีผู้รับเรื่อง — หน้าเว็บเจ้าหน้าที่ดึงทุก 45 วินาทีเพื่อเด้งเตือนพร้อมเสียง
// สิทธิ์เดียวกับหน้า "คำขอจากประชาชน"
const ROLES = ["admin", "commander", "MCATT", "SAT", "SEhRT", "staff"];
export const dynamic = "force-dynamic";

export async function GET(request) {
  const auth = await requireAuth(request, ROLES);
  if (!auth.success) return auth.response;
  try {
    const pending = await pendingHelpRequests({ limit: 30 });
    return NextResponse.json(
      { success: true, pending, latest_id: pending.reduce((max, item) => Math.max(max, item.id), 0), checked_at: new Date().toISOString() },
      { headers: { "Cache-Control": "private, no-store" } }
    );
  } catch (error) {
    console.error("Help alerts API error:", error?.message || error);
    return publicInternalError("โหลดคำขอความช่วยเหลือไม่สำเร็จ");
  }
}
