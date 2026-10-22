import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { readVisitorLog } from "@/lib/visitorLogServer";
import { visitorLogRetentionDays } from "@/lib/visitorLog";

// ประวัติผู้เข้าชม (IP ตำแหน่งโดยประมาณ หน้า ผู้ใช้) — เฉพาะผู้ดูแลระบบ
export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const data = await readVisitorLog(new URL(request.url).searchParams);
    return NextResponse.json({
      success: true,
      ...data,
      retentionDays: visitorLogRetentionDays(),
      geoLookup: Boolean(process.env.VISITOR_GEO_LOOKUP_URL)
    });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ success: false, message: "ยังไม่ได้ติดตั้งตารางประวัติผู้เข้าชม กรุณารัน migration (./scripts/docker-migrate.sh up)" }, { status: 409 });
    }
    console.error("Visitor log read error:", error);
    return publicInternalError("โหลดประวัติผู้เข้าชมไม่สำเร็จ");
  }
}
