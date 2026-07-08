import { NextResponse } from "next/server";
import { getFloodEocManagementData } from "@/lib/eocFloodManagement";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date") || undefined;
    return NextResponse.json({
      success: true,
      ...getFloodEocManagementData({ date })
    });
  } catch (error) {
    console.error("Flood EOC Management API error:", error);
    return NextResponse.json(
      { success: false, error: "ไม่สามารถโหลดข้อมูล Flood EOC Management ได้" },
      { status: 500 }
    );
  }
}
