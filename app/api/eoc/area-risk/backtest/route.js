import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { publicInternalError } from "@/lib/apiResponse";
import { clearAreaRiskCache } from "@/lib/areaRiskData";
import { clearFloodBacktestCache, getFloodBacktest } from "@/lib/floodBacktestData";
import { getFloodCalibration, resetFloodCalibration, saveFloodCalibration } from "@/lib/floodCalibration";
import { factorFloorOf, thresholdsOf } from "@/lib/floodForecast";
import { recordChange } from "@/lib/recordArchive";

// ทดสอบย้อนหลังพยากรณ์จุดเสี่ยงน้ำท่วมกับเหตุการณ์จริง (เจ้าหน้าที่ดูได้) + ใช้/ยกเลิกเกณฑ์ที่ปรับเทียบ (ผู้ดูแลระบบ)
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const fresh = new URL(request.url).searchParams.get("fresh") === "1";
    const data = await getFloodBacktest({ fresh });
    const response = NextResponse.json({ success: true, data });
    response.headers.set("Cache-Control", "private, no-store");
    return response;
  } catch (error) {
    console.error("Flood backtest API error:", error?.message || error);
    return publicInternalError("ยังทดสอบย้อนหลังไม่ได้ในขณะนี้ (แหล่งข้อมูลย้อนหลังไม่ตอบ)");
  }
}

export async function POST(request) {
  const auth = await requireAuth(request, ["admin"]);
  if (!auth.success) return auth.response;
  try {
    const body = await request.json().catch(() => ({}));
    const before = await getFloodCalibration({ fresh: true });
    let data;
    if (body.action === "reset") {
      data = await resetFloodCalibration();
    } else if (body.action === "apply") {
      const thresholds = thresholdsOf({ thresholds: body.thresholds });
      if (thresholds.watch !== Number(body.thresholds?.watch) || thresholds.high !== Number(body.thresholds?.high) || thresholds.critical !== Number(body.thresholds?.critical)) {
        return NextResponse.json({ success: false, message: "เกณฑ์ไม่ถูกต้อง (ต้องเรียง เฝ้าระวัง < เสี่ยงสูง < วิกฤต)" }, { status: 400 });
      }
      const factorFloor = factorFloorOf({ factor_floor: body.factor_floor });
      if (body.factor_floor != null && factorFloor !== Number(body.factor_floor)) {
        return NextResponse.json({ success: false, message: "ตัวคูณขั้นต่ำต้องอยู่ระหว่าง 0.3–1.2" }, { status: 400 });
      }
      const backtest = await getFloodBacktest();
      const metrics = body.metrics && typeof body.metrics === "object"
        ? Object.fromEntries(["hits", "misses", "false_alarms", "false_alarms_per_year", "pod", "far", "csi"].map((k) => [k, Number(body.metrics[k]) || 0]))
        : null;
      data = await saveFloodCalibration({ thresholds, factor_floor: factorFloor, metrics, period: backtest?.period || null }, auth.user);
    } else {
      return NextResponse.json({ success: false, message: "action ต้องเป็น apply หรือ reset" }, { status: 400 });
    }
    clearAreaRiskCache();
    clearFloodBacktestCache();
    await recordChange({
      request,
      user: auth.user,
      action: "data_update",
      table: "system_settings",
      id: "flood_forecast_calibration",
      description: body.action === "reset" ? "กลับไปใช้เกณฑ์พยากรณ์น้ำท่วมค่าเริ่มต้น" : `ใช้เกณฑ์พยากรณ์น้ำท่วมที่ปรับเทียบ ${data.thresholds.watch}/${data.thresholds.high}/${data.thresholds.critical} ตัวคูณขั้นต่ำ ${data.factor_floor}`,
      oldValues: before,
      newValues: data
    });
    return NextResponse.json({ success: true, data });
  } catch (error) {
    if (error?.code === "ER_NO_SUCH_TABLE") {
      return NextResponse.json({ success: false, message: "ยังไม่ได้รัน migration 20261009_system_settings.sql" }, { status: 503 });
    }
    console.error("Flood calibration POST error:", error?.message || error);
    return publicInternalError("บันทึกเกณฑ์ไม่สำเร็จ");
  }
}
