import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { readVisitorLog, readVisitorPoints } from "@/lib/visitorLogServer";
import { visitorLogRetentionDays } from "@/lib/visitorLog";
import { describeIpChain } from "@/lib/clientIp";

// ประวัติผู้เข้าชม (IP ตำแหน่งโดยประมาณ หน้า ผู้ใช้) — เฉพาะผู้ดูแลระบบ
export async function GET(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const searchParams = new URL(request.url).searchParams;
    // แผนที่ผู้เข้าชม: จุดรวมตามตำแหน่ง (ทุกการเข้าชมในช่วงที่เลือก ไม่จำกัดแค่หน้ารายการ)
    // ตรวจการรับ IP ของคำขอนี้ (ใช้ตั้ง TRUST_PROXY ให้ถูก)
    if (searchParams.get("mode") === "whoami") {
      return NextResponse.json({ success: true, ...describeIpChain(request) });
    }
    if (searchParams.get("mode") === "points") {
      return NextResponse.json({ success: true, ...(await readVisitorPoints(searchParams)) });
    }
    const data = await readVisitorLog(searchParams);
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
