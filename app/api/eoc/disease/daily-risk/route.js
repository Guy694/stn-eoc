import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function parseSessionId(value) {
    const id = Number(value);
    return Number.isInteger(id) && id > 0 ? id : null;
}

async function resolveDiseaseSession(user, requestedSessionId) {
    const requestedId = parseSessionId(requestedSessionId);
    const privileged = ["admin", "commander"].includes(user.role);
    const params = [];
    let membershipJoin = "";
    let where = "s.eoc_type = 'disease'";

    if (!privileged) {
        membershipJoin = `
            JOIN eoc_session_teams st ON st.eoc_session_id = s.id AND st.is_active = TRUE
            JOIN eoc_team_members tm
              ON tm.session_team_id = st.id
             AND tm.officer_id = ?
             AND tm.is_active = TRUE`;
        params.push(user.id);
    }
    if (requestedId) {
        where += " AND s.id = ?";
        params.push(requestedId);
    }

    const rows = await query(`
        SELECT DISTINCT s.id, s.session_number, s.status, s.opened_at, s.closed_at,
               s.disease_id, s.disease_name
        FROM eoc_sessions s
        ${membershipJoin}
        WHERE ${where}
        ORDER BY CASE WHEN s.status = 'active' THEN 0 ELSE 1 END,
                 s.opened_at DESC, s.id DESC
        LIMIT 1
    `, params);
    return rows[0] || null;
}

async function getFacilityTypeExpression() {
    const columns = await query(`
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
          AND TABLE_NAME = 'health_facilities'
          AND COLUMN_NAME IN ('facility_type', 'typecode')
    `);
    const names = new Set(columns.map((column) => column.COLUMN_NAME));
    if (names.has("facility_type")) return "hf.facility_type as facility_type";
    if (names.has("typecode")) return "hf.typecode as facility_type";
    return "NULL as facility_type";
}

function severity(patientCount) {
    if (Number(patientCount || 0) >= 50) return "high";
    if (Number(patientCount || 0) >= 20) return "medium";
    return "low";
}

export async function GET(request) {
    try {
        const auth = await requireAuth(request);
        if (!auth.success) return auth.response;

        const { searchParams } = new URL(request.url);
        const requestedSessionId = searchParams.get("session_id");
        const requestedDate = searchParams.get("date");
        if (requestedSessionId && !parseSessionId(requestedSessionId)) {
            return NextResponse.json({ success: false, message: "session_id ไม่ถูกต้อง" }, { status: 400 });
        }
        if (requestedDate && !DATE_PATTERN.test(requestedDate)) {
            return NextResponse.json({ success: false, message: "วันที่รายงานไม่ถูกต้อง" }, { status: 400 });
        }

        const session = await resolveDiseaseSession(auth.user, requestedSessionId);
        if (!session) {
            return NextResponse.json({ success: false, message: "ไม่พบ EOC Session โรคระบาดที่เข้าถึงได้" }, { status: 404 });
        }

        const availableDateRows = await query(`
            SELECT DISTINCT DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date
            FROM disease_reports
            WHERE session_id = ? AND report_date IS NOT NULL
            ORDER BY report_date DESC
        `, [session.id]);
        const availableDates = availableDateRows.map((row) => row.report_date);
        const date = requestedDate || availableDates[0] || null;

        if (!date) {
            return NextResponse.json({
                success: true,
                date: null,
                session_id: session.id,
                session,
                available_dates: [],
                totalStats: {},
                diseaseSummary: [],
                districtSummary: [],
                details: [],
                meta: {
                    source_type: "database",
                    source_name: "disease_reports",
                    record_count: 0,
                    data_quality_warning: "ยังไม่มีข้อมูลสำหรับ Session ที่เลือก"
                }
            });
        }

        const facilityTypeSelect = await getFacilityTypeExpression();
        const [diseaseSummary, districtSummary, details, totalStats] = await Promise.all([
            query(`
                SELECT dr.disease_name, COUNT(*) AS report_count,
                       SUM(dr.patient_count) AS total_patients,
                       COUNT(DISTINCT COALESCE(
                           CONCAT('hf:', dr.health_facility_id),
                           CONCAT('v:', dr.village_polygon_id),
                           CONCAT('area:', dr.district_name, '|', dr.tambon_name, '|', dr.moo)
                       )) AS facilities_count,
                       MAX(dr.report_date) AS last_report
                FROM disease_reports dr
                WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
                GROUP BY dr.disease_name
                ORDER BY total_patients DESC
            `, [session.id, date]),
            query(`
                SELECT COALESCE(dr.district_name, hf.district_name) AS district,
                       COUNT(DISTINCT dr.disease_name) AS diseases_count,
                       COUNT(DISTINCT COALESCE(
                           CONCAT('hf:', dr.health_facility_id),
                           CONCAT('v:', dr.village_polygon_id),
                           CONCAT('area:', dr.district_name, '|', dr.tambon_name, '|', dr.moo)
                       )) AS facilities_count,
                       SUM(dr.patient_count) AS total_patients,
                       COUNT(*) AS report_count
                FROM disease_reports dr
                LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
                WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
                GROUP BY COALESCE(dr.district_name, hf.district_name)
                ORDER BY total_patients DESC
            `, [session.id, date]),
            query(`
                SELECT dr.id, dr.disease_name, dr.patient_count, dr.notes, dr.report_date,
                       COALESCE(hf.name, dr.village_name, 'พื้นที่ระดับหมู่บ้าน') AS facility_name,
                       COALESCE(dr.district_name, hf.district_name) AS district_name,
                       dr.tambon_name, dr.moo, dr.village_name, ${facilityTypeSelect}
                FROM disease_reports dr
                LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
                WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
                ORDER BY dr.patient_count DESC, district_name, dr.tambon_name,
                         CAST(dr.moo AS UNSIGNED), facility_name
            `, [session.id, date]),
            query(`
                SELECT COUNT(DISTINCT COALESCE(dr.district_name, hf.district_name)) AS affected_districts,
                       COUNT(DISTINCT COALESCE(
                           CONCAT('hf:', dr.health_facility_id),
                           CONCAT('v:', dr.village_polygon_id),
                           CONCAT('area:', dr.district_name, '|', dr.tambon_name, '|', dr.moo)
                       )) AS affected_facilities,
                       COUNT(DISTINCT dr.disease_name) AS diseases_count,
                       COALESCE(SUM(dr.patient_count), 0) AS total_patients,
                       COUNT(*) AS total_reports
                FROM disease_reports dr
                LEFT JOIN health_facilities hf ON dr.health_facility_id = hf.id
                WHERE dr.session_id = ? AND DATE(dr.report_date) = ?
            `, [session.id, date])
        ]);

        return NextResponse.json({
            success: true,
            date,
            session_id: session.id,
            session,
            activeSession: session,
            available_dates: availableDates,
            totalStats: totalStats[0] || {},
            diseaseSummary: diseaseSummary.map((row) => ({ ...row, severity: severity(row.total_patients) })),
            districtSummary,
            details,
            meta: {
                source_type: "database",
                source_name: "disease_reports",
                session_id: session.id,
                report_date: date,
                record_count: details.length,
                generated_at: new Date().toISOString(),
                data_quality_warning: details.length ? null : "ยังไม่มีข้อมูลสำหรับ Session และวันที่ที่เลือก"
            }
        });
    } catch (error) {
        console.error("Disease daily risk error:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงข้อมูลสรุปสถานการณ์โรครายวัน");
    }
}
