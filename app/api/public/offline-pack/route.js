import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { getOfflinePack } from "@/lib/offlinePackData";

// ชุดข้อมูลสำคัญสำหรับเปิดดูตอนไม่มีอินเทอร์เน็ต (service worker เก็บไว้ในเครื่อง)
// เฉพาะข้อมูลสาธารณะ: เบอร์ฉุกเฉิน ศูนย์พักพิงที่เปิด ประกาศเตือนล่าสุด สถานการณ์รวม
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ success: true, ...(await getOfflinePack()) }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    console.error("Offline pack error:", error?.message || error);
    return publicInternalError("เตรียมข้อมูลออฟไลน์ไม่สำเร็จ");
  }
}
