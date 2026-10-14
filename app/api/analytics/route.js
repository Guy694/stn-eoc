import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import db from "@/lib/db";
import { teamRegistry } from "@/src/features/eoc/registries/team.registry";

const REGISTERED_TEAM_CODES = Object.values(teamRegistry).map((team) => team.legacyCode);

const number = (value) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

const isMissingTable = (error) => error?.code === "ER_NO_SUCH_TABLE";

// ผลลัพธ์เก็บไว้สั้น ๆ ต่อกลุ่มผู้ดู (ผู้บริหาร = ชุดเดียว, ทีม = ต่อคน) ลดการคำนวณซ้ำเมื่อหลายคนเปิดพร้อมกัน
const CACHE_MS = 30 * 1000;
const cache = new Map();

function analyzeTeam(row) {
    const memberCount = number(row.member_count);
    const activityCount = number(row.activity_count_7d);
    const assignedSessions = number(row.assigned_sessions);
    const hasLead = number(row.lead_count) > 0;
    const score = Math.round(
        Math.min(30, assignedSessions * 30)
        + (hasLead ? 15 : 0)
        + Math.min(35, (memberCount / 5) * 35)
        + Math.min(20, (activityCount / 5) * 20)
    );
    const weaknesses = [];

    if (!assignedSessions) weaknesses.push("ยังไม่ได้มอบหมายใน EOC ที่เปิดอยู่");
    if (!hasLead && assignedSessions) weaknesses.push("ยังไม่มีหัวหน้าทีม");
    if (!memberCount) weaknesses.push("ยังไม่มีสมาชิกปฏิบัติงาน");
    else if (memberCount < 3) weaknesses.push("กำลังคนน้อยกว่า 3 คน");
    if (assignedSessions && activityCount === 0) weaknesses.push("ไม่มีกิจกรรมที่บันทึกใน 7 วัน");

    return {
        ...row,
        member_count: memberCount,
        activity_count_7d: activityCount,
        assigned_sessions: assignedSessions,
        lead_count: number(row.lead_count),
        draft_reports: number(row.draft_reports),
        submitted_reports: number(row.submitted_reports),
        verified_reports: number(row.verified_reports),
        approved_reports: number(row.approved_reports),
        returned_reports: number(row.returned_reports),
        readiness_score: score,
        status: score < 40 ? "critical" : score < 70 ? "warning" : "ready",
        weaknesses
    };
}

function buildRecommendations({ kpis, teams, lowStock, diseaseDistricts }) {
    const recommendations = [];
    const criticalTeams = teams.filter((team) => team.status === "critical");
    const risingDistricts = diseaseDistricts.filter((item) => number(item.change_pct) > 20 && number(item.current_cases) > 0);
    const criticalStock = lowStock.filter((item) => item.severity === "critical");

    if (criticalStock.length) {
        recommendations.push({
            priority: "critical",
            title: "เร่งเติมเวชภัณฑ์วิกฤต",
            detail: `มี ${criticalStock.length} รายการเหลือไม่เกิน 10% หรือหมดสต็อก ควรตรวจสอบการโอนระหว่างหน่วยบริการและเปิดคำขอจัดหา`
        });
    } else if (lowStock.length) {
        recommendations.push({
            priority: "warning",
            title: "วางแผนเติมเวชภัณฑ์",
            detail: `มี ${lowStock.length} รายการเหลือต่ำกว่า 20% ของยอดตั้งต้น`
        });
    }

    if (criticalTeams.length) {
        recommendations.push({
            priority: "critical",
            title: "เสริมความพร้อมกลุ่มภารกิจ",
            detail: `${criticalTeams.map((team) => team.team_code).join(", ")} มีคะแนนความพร้อมต่ำ ควรมอบหมายหัวหน้าทีมและกำลังคนเพิ่มเติม`
        });
    }

    if (risingDistricts.length) {
        recommendations.push({
            priority: "warning",
            title: "เฝ้าระวังแนวโน้มโรคเพิ่มขึ้น",
            detail: `${risingDistricts.slice(0, 3).map((item) => item.district_name).join(", ")} มีผู้ป่วย 7 วันล่าสุดเพิ่มเกิน 20% จากสัปดาห์ก่อน`
        });
    }

    if (number(kpis.active_shelters) > 0 && number(kpis.shelter_occupancy) > 0) {
        recommendations.push({
            priority: "info",
            title: "ติดตามศูนย์พักพิงที่เปิดอยู่",
            detail: `มีศูนย์พักพิงเปิด ${number(kpis.active_shelters).toLocaleString("th-TH")} แห่ง รองรับผู้พักพิงปัจจุบัน ${number(kpis.shelter_occupancy).toLocaleString("th-TH")} คน`
        });
    }

    if (!recommendations.length) {
        recommendations.push({
            priority: "info",
            title: "สถานการณ์ยังไม่มีสัญญาณวิกฤตจากข้อมูลที่บันทึก",
            detail: "ควรติดตามความครบถ้วนของข้อมูลทีม เวชภัณฑ์ และรายงานโรคอย่างต่อเนื่อง"
        });
    }

    return recommendations;
}

// คลังเวชภัณฑ์ของเหตุการณ์ที่เปิดอยู่ (ไม่มีให้ใช้บัญชีล่าสุด) — เกณฑ์เดียวกับหน้าคลัง: คงเหลือ / (ยอดตั้งต้น + รับเข้า)
async function loadInventory() {
    const empty = { available: false, lowStock: [], summary: { low_stock_count: 0, critical_stock_count: 0, total_balance: 0, item_count: 0 } };
    try {
        const events = await db.query(
            `SELECT e.id
             FROM medical_inventory_events e
             LEFT JOIN eoc_sessions s ON s.eoc_type = e.eoc_type AND s.session_number = e.session_number AND s.status = 'active'
             ORDER BY (s.id IS NOT NULL) DESC, e.created_at DESC, e.id DESC
             LIMIT 1`,
            []
        );
        if (!events.length) return { ...empty, available: true };
        const eventId = events[0].id;
        const [rows, summaryRows] = await Promise.all([
            db.query(
                `SELECT s.id, s.agency_name, s.item_code, s.item_name, s.unit,
                        COALESCE(s.opening_qty, 0) + COALESCE(s.received_qty, 0) AS opening_qty,
                        COALESCE(s.balance_qty, 0) AS balance_qty,
                        ROUND((COALESCE(s.balance_qty, 0) / NULLIF(COALESCE(s.opening_qty, 0) + COALESCE(s.received_qty, 0), 0)) * 100, 1) AS remain_pct,
                        hf.district_name
                 FROM medical_inventory_stock s
                 LEFT JOIN health_facilities hf ON hf.id = s.health_facility_id
                 WHERE s.inventory_event_id = ?
                   AND s.data_status = 'recorded'
                   AND COALESCE(s.opening_qty, 0) + COALESCE(s.received_qty, 0) > 0
                   AND COALESCE(s.balance_qty, 0) / (COALESCE(s.opening_qty, 0) + COALESCE(s.received_qty, 0)) < 0.2
                 ORDER BY remain_pct ASC, s.balance_qty ASC, s.item_name ASC
                 LIMIT 100`,
                [eventId]
            ),
            db.query(
                `SELECT COUNT(DISTINCT item_code) AS item_count, COALESCE(SUM(balance_qty), 0) AS total_balance
                 FROM medical_inventory_stock WHERE inventory_event_id = ? AND data_status = 'recorded'`,
                [eventId]
            )
        ]);
        const lowStock = rows.map((item) => ({
            ...item,
            opening_qty: number(item.opening_qty),
            balance_qty: number(item.balance_qty),
            remain_pct: number(item.remain_pct),
            severity: number(item.remain_pct) <= 10 ? "critical" : "warning"
        }));
        return {
            available: true,
            lowStock,
            summary: {
                item_count: number(summaryRows[0]?.item_count),
                total_balance: number(summaryRows[0]?.total_balance),
                low_stock_count: lowStock.length,
                critical_stock_count: lowStock.filter((item) => item.severity === "critical").length
            }
        };
    } catch (error) {
        if (isMissingTable(error)) return empty;
        throw error;
    }
}

export async function GET(request) {
    try {
        // `staff` also grants access to every registered EOC team role through requireAuth.
        const auth = await requireAuth(request, ["admin", "commander", "staff"]);
        if (!auth.success) return auth.response;
        const privileged = ["admin", "commander"].includes(auth.user.role);
        const cacheKey = privileged ? "all" : `user:${auth.user.id}`;
        const cached = cache.get(cacheKey);
        if (cached && Date.now() - cached.at < CACHE_MS && new URL(request.url).searchParams.get("refresh") !== "1") {
            return NextResponse.json({ success: true, data: cached.data, cached: true });
        }

        const [sessions, affectedRows, shelterRows, teamRows, diseaseDaily, diseaseDistrictRows, inventory] = await Promise.all([
            db.query(
                `SELECT id, eoc_type, session_number, opened_at, status
                 FROM eoc_sessions
                 WHERE status = 'active'
                 ORDER BY opened_at DESC`,
                []
            ),
            db.query(
                `SELECT COALESCE(SUM(ap.affected), 0) AS affected_people,
                        COALESCE(SUM(ap.injured), 0) AS injured,
                        COALESCE(SUM(ap.deaths), 0) AS deaths
                 FROM affected_persons ap
                 JOIN eoc_sessions es ON es.id = ap.session_id AND es.status = 'active'
                 JOIN (
                    SELECT p.session_id, MAX(p.report_date) AS latest_date
                    FROM affected_persons p
                    JOIN eoc_sessions s2 ON s2.id = p.session_id AND s2.status = 'active'
                    GROUP BY p.session_id
                 ) latest ON latest.session_id = ap.session_id AND latest.latest_date = ap.report_date`,
                []
            ),
            db.query(
                `SELECT COUNT(DISTINCT ssa.shelter_id) AS active_shelters,
                        COALESCE(SUM(ssa.current_occupancy), 0) AS shelter_occupancy
                 FROM shelter_session_activations ssa
                 JOIN eoc_sessions es ON es.id = ssa.session_id AND es.status = 'active'
                 WHERE ssa.is_active = 1`,
                []
            ),
            // รวมยอดแต่ละเรื่องแยกกันก่อนแล้วค่อยต่อกับทีม — เดิม JOIN สมาชิก × กิจกรรม × รายงานพร้อมกัน
            // ทำให้แถวคูณกันเป็นจำนวนมาก (ช้ามากเมื่อ activity_logs ใหญ่)
            db.query(
                `WITH active_st AS (
                    SELECT est.id, est.team_id, est.eoc_session_id, est.team_lead_officer_id
                    FROM eoc_session_teams est
                    JOIN eoc_sessions es ON es.id = est.eoc_session_id AND es.status = 'active'
                    WHERE est.is_active = 1
                 ),
                 assigned AS (
                    SELECT team_id, COUNT(DISTINCT eoc_session_id) AS assigned_sessions,
                           COUNT(DISTINCT team_lead_officer_id) AS lead_count
                    FROM active_st GROUP BY team_id
                 ),
                 members AS (
                    SELECT st.team_id, COUNT(DISTINCT etm.officer_id) AS member_count
                    FROM active_st st
                    JOIN eoc_team_members etm ON etm.session_team_id = st.id AND etm.is_active = 1
                    GROUP BY st.team_id
                 ),
                 activity AS (
                    SELECT st.team_id,
                           COUNT(DISTINCT CASE WHEN al.created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY) THEN al.id END) AS activity_count_7d,
                           MAX(al.created_at) AS last_activity_at
                    FROM active_st st
                    JOIN eoc_team_members etm ON etm.session_team_id = st.id AND etm.is_active = 1
                    JOIN activity_logs al ON al.eoc_session_id = st.eoc_session_id AND al.user_id = etm.officer_id
                    GROUP BY st.team_id
                 ),
                 reports AS (
                    SELECT st.team_id,
                           SUM(r.status = 'draft') AS draft_reports,
                           SUM(r.status = 'submitted') AS submitted_reports,
                           SUM(r.status = 'verified') AS verified_reports,
                           SUM(r.status = 'approved') AS approved_reports,
                           SUM(r.status = 'returned') AS returned_reports
                    FROM active_st st
                    JOIN eoc_team_reports r ON r.session_team_id = st.id
                    GROUP BY st.team_id
                 )
                 SELECT t.id, t.team_code, t.team_name_th, t.team_name_en,
                        COALESCE(a.assigned_sessions, 0) AS assigned_sessions,
                        COALESCE(m.member_count, 0) AS member_count,
                        COALESCE(a.lead_count, 0) AS lead_count,
                        COALESCE(ac.activity_count_7d, 0) AS activity_count_7d,
                        COALESCE(r.draft_reports, 0) AS draft_reports,
                        COALESCE(r.submitted_reports, 0) AS submitted_reports,
                        COALESCE(r.verified_reports, 0) AS verified_reports,
                        COALESCE(r.approved_reports, 0) AS approved_reports,
                        COALESCE(r.returned_reports, 0) AS returned_reports,
                        ac.last_activity_at
                 FROM eoc_teams t
                 LEFT JOIN assigned a ON a.team_id = t.id
                 LEFT JOIN members m ON m.team_id = t.id
                 LEFT JOIN activity ac ON ac.team_id = t.id
                 LEFT JOIN reports r ON r.team_id = t.id
                 WHERE t.is_active = 1
                   AND t.team_code IN (${REGISTERED_TEAM_CODES.map(() => "?").join(",")})
                   AND (? = 1 OR EXISTS (
                     SELECT 1
                     FROM active_st access_st
                     JOIN eoc_team_members access_member
                       ON access_member.session_team_id = access_st.id
                      AND access_member.is_active = 1
                     WHERE access_st.team_id = t.id
                       AND access_member.officer_id = ?
                   ))
                 ORDER BY FIELD(t.team_code, ${REGISTERED_TEAM_CODES.map(() => "?").join(",")})`,
                [...REGISTERED_TEAM_CODES, privileged ? 1 : 0, auth.user.id, ...REGISTERED_TEAM_CODES]
            ),
            db.query(
                `SELECT DATE_FORMAT(report_date, '%Y-%m-%d') AS report_date,
                        COALESCE(SUM(patient_count), 0) AS patient_count
                 FROM disease_reports
                 WHERE report_date >= DATE_SUB((SELECT MAX(report_date) FROM disease_reports), INTERVAL 29 DAY)
                 GROUP BY report_date
                 ORDER BY report_date ASC`,
                []
            ),
            db.query(
                `SELECT COALESCE(NULLIF(hf.district_name, ''), 'ไม่ระบุอำเภอ') AS district_name,
                        SUM(CASE WHEN dr.report_date >= DATE_SUB(latest.max_date, INTERVAL 6 DAY) THEN dr.patient_count ELSE 0 END) AS current_cases,
                        SUM(CASE WHEN dr.report_date BETWEEN DATE_SUB(latest.max_date, INTERVAL 13 DAY) AND DATE_SUB(latest.max_date, INTERVAL 7 DAY) THEN dr.patient_count ELSE 0 END) AS previous_cases
                 FROM disease_reports dr
                 LEFT JOIN health_facilities hf ON hf.id = dr.health_facility_id
                 CROSS JOIN (SELECT MAX(report_date) AS max_date FROM disease_reports) latest
                 WHERE dr.report_date >= DATE_SUB(latest.max_date, INTERVAL 13 DAY)
                 GROUP BY COALESCE(NULLIF(hf.district_name, ''), 'ไม่ระบุอำเภอ')
                 ORDER BY current_cases DESC, district_name ASC`,
                []
            ),
            loadInventory()
        ]);

        const { available: hasInventory, lowStock, summary: inventorySummary } = inventory;
        const teams = teamRows.map(analyzeTeam);
        const diseaseDistricts = diseaseDistrictRows.map((item) => {
            const current = number(item.current_cases);
            const previous = number(item.previous_cases);
            return {
                district_name: item.district_name,
                current_cases: current,
                previous_cases: previous,
                change_pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : current > 0 ? 100 : 0
            };
        });
        const kpis = {
            active_sessions: sessions.length,
            affected_people: number(affectedRows[0]?.affected_people),
            injured: number(affectedRows[0]?.injured),
            deaths: number(affectedRows[0]?.deaths),
            active_shelters: number(shelterRows[0]?.active_shelters),
            shelter_occupancy: number(shelterRows[0]?.shelter_occupancy),
            low_stock_count: inventorySummary.low_stock_count,
            critical_teams: teams.filter((team) => team.status === "critical").length
        };

        const data = {
            generated_at: new Date().toISOString(),
            kpis,
            active_sessions: sessions,
            teams,
            inventory: { available: hasInventory, summary: inventorySummary, low_stock: lowStock },
            disease: { daily_trend: diseaseDaily, districts: diseaseDistricts },
            recommendations: buildRecommendations({ kpis, teams, lowStock, diseaseDistricts })
        };
        cache.set(cacheKey, { at: Date.now(), data });
        if (cache.size > 200) cache.delete(cache.keys().next().value);
        return NextResponse.json({ success: true, data });
    } catch (error) {
        console.error("Analytics API error:", error);
        return NextResponse.json(
            { success: false, message: "ไม่สามารถโหลดข้อมูลวิเคราะห์ได้" },
            { status: 500 }
        );
    }
}
