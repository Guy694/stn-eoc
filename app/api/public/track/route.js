import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { enforceIpRateLimit } from "@/lib/rateLimit";
import { hasTrackingColumns } from "@/lib/incidentTrackingDb";
import {
  CITIZEN_STEPS,
  REPORT_TYPE_LABELS,
  citizenStatus,
  citizenTimeline,
  formatTrackingCode,
  nameVariants
} from "@/lib/helpTracking";

const NOT_FOUND = "ไม่พบเรื่องที่แจ้ง ตรวจชื่อ นามสกุล และเบอร์โทร 4 ตัวท้ายให้ตรงกับตอนแจ้ง";
const LOOKBACK_DAYS = 90;
const MAX_RESULTS = 10;

// ประเภทความช่วยเหลือจากบรรทัดแรกของรายละเอียด (ไม่ส่งข้อความที่ผู้แจ้งเขียนกลับไป)
function helpCategory(description) {
  const match = String(description || "").match(/^ประเภทความช่วยเหลือ:\s*(.+)$/m);
  return match ? match[1].trim() : null;
}

// ค้นด้วยชื่อ + นามสกุล + เบอร์ 4 ตัวท้าย (ต้องตรงครบทั้ง 3 อย่าง)
// POST เพื่อไม่ให้ชื่อและเบอร์ไปอยู่ใน URL/บันทึกของเซิร์ฟเวอร์
export async function POST(request) {
  const limited = await enforceIpRateLimit(request, "publicTrack");
  if (limited) return limited;

  try {
    const body = await request.json().catch(() => ({}));
    const firstNames = nameVariants(body.firstName);
    const lastNames = nameVariants(body.lastName);
    const last4 = String(body.phone4 || "").replace(/\D/g, "");
    if (!firstNames.length || !lastNames.length || last4.length !== 4) {
      return NextResponse.json({ success: false, message: "กรอกชื่อ นามสกุล และเบอร์โทร 4 ตัวท้ายที่ใช้ตอนแจ้ง" }, { status: 400 });
    }

    const pool = await getConnection();
    if (!(await hasTrackingColumns(pool))) {
      return NextResponse.json({ success: false, message: "ระบบติดตามยังไม่พร้อมใช้งาน กรุณาโทร 1784" }, { status: 503 });
    }

    const [rows] = await pool.execute(
      `SELECT id, tracking_code, report_type, description, district, sub_district,
              status, citizen_message, reported_at, reviewed_at
       FROM public_incident_reports
       WHERE TRIM(first_name) IN (${firstNames.map(() => "?").join(",")})
         AND TRIM(last_name) IN (${lastNames.map(() => "?").join(",")})
         AND RIGHT(REPLACE(REPLACE(REPLACE(phone, '-', ''), ' ', ''), '+', ''), 4) = ?
         AND reported_at >= DATE_SUB(NOW(), INTERVAL ${LOOKBACK_DAYS} DAY)
       ORDER BY reported_at DESC
       LIMIT ${MAX_RESULTS}`,
      [...firstNames, ...lastNames, last4]
    );
    if (rows.length === 0) {
      return NextResponse.json({ success: false, message: NOT_FOUND }, { status: 404 });
    }

    const ids = rows.map((row) => row.id);
    const [events] = await pool.execute(
      `SELECT report_id, status, citizen_message, created_at FROM incident_status_events
       WHERE report_id IN (${ids.map(() => "?").join(",")}) ORDER BY created_at, id`,
      ids
    );

    const data = rows.map((report) => {
      const meta = citizenStatus(report.status);
      const own = events.filter((event) => event.report_id === report.id);
      return {
        code: report.tracking_code ? formatTrackingCode(report.tracking_code) : null,
        type: REPORT_TYPE_LABELS[report.report_type] || "รายงาน",
        category: report.report_type === "help_request" ? helpCategory(report.description) : null,
        area: [report.sub_district && `ต.${report.sub_district}`, report.district && `อ.${report.district}`].filter(Boolean).join(" "),
        reported_at: report.reported_at,
        updated_at: report.reviewed_at || report.reported_at,
        status: report.status,
        status_label: meta.label,
        status_detail: meta.detail,
        status_tone: meta.tone,
        step: meta.step,
        steps: CITIZEN_STEPS,
        citizen_message: report.citizen_message || null,
        timeline: own.length ? citizenTimeline(own) : citizenTimeline([{ status: "pending", created_at: report.reported_at }])
      };
    });

    return NextResponse.json({ success: true, data }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("Track report error:", error);
    return publicInternalError("ตรวจสอบสถานะไม่สำเร็จ กรุณาลองใหม่");
  }
}
