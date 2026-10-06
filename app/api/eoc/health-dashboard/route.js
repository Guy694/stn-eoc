import { NextResponse } from "next/server";
import { OFFICER_ROLES, requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";
import { buildHealthDashboard, dateKey } from "@/lib/healthDashboard";

// ภาพรวมโรคและสุขภาพของเหตุการณ์ (ผู้ป่วยในชุมชน + ในศูนย์พักพิง)
async function safe(promise) {
  try {
    return await promise;
  } catch (error) {
    if (error.code === "ER_NO_SUCH_TABLE" || error.code === "ER_BAD_FIELD_ERROR") return [];
    throw error;
  }
}

export async function GET(request) {
  try {
    const auth = await requireAuth(request, OFFICER_ROLES);
    if (!auth.success) return auth.response;
    const params = new URL(request.url).searchParams;
    const eocType = params.get("eoc") || "flood";
    const sessionId = params.get("session_id");
    const sessions = await query(
      sessionId
        ? `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE id = ? LIMIT 1`
        : `SELECT id, eoc_type, session_number, status, opened_at, closed_at FROM eoc_sessions WHERE eoc_type = ? ORDER BY (status = 'active') DESC, opened_at DESC LIMIT 1`,
      [sessionId || eocType]
    );
    if (!sessions.length) return NextResponse.json({ success: true, session: null, message: "ยังไม่เคยเปิดเหตุการณ์" });
    const session = sessions[0];

    const [community, shelter, population] = await Promise.all([
      safe(query(
        `SELECT DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date, district_name AS district, tambon_name AS tambon,
                village_name AS village, disease_name AS disease, SUM(patient_count) AS cases
         FROM disease_reports WHERE session_id = ?
         GROUP BY report_date, district_name, tambon_name, village_name, disease_name`,
        [session.id]
      )),
      safe(query(
        `SELECT DATE_FORMAT(r.report_date, '%Y-%m-%d') AS report_date, sc.district_name AS district, sc.sheltername AS shelter,
                r.disease_type AS disease, r.new_cases AS cases, r.hospitalized, r.deaths, r.severity
         FROM shelter_disease_reports r LEFT JOIN shelter_centers sc ON sc.id = r.shelter_id
         WHERE r.session_id = ?`,
        [session.id]
      )),
      safe(query(
        `SELECT district_name AS district, MAX(population) AS population FROM area_population
         WHERE population_scope = 'all' GROUP BY district_name`
      ))
    ]);

    const today = dateKey(new Date());
    return NextResponse.json({
      success: true,
      session,
      generated_at: new Date().toISOString(),
      ...buildHealthDashboard({ session, community, shelter, population }, today)
    });
  } catch (error) {
    console.error("Health dashboard error:", error);
    return publicInternalError("ไม่สามารถโหลดภาพรวมโรคและสุขภาพได้");
  }
}
