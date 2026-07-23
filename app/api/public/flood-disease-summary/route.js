import { NextResponse } from "next/server";
import { getConnection } from "@/lib/db";

const emptyPayload = {
    session_id: null,
    report_date: null,
    period: null,
    data_source: "database",
    summary: {
        total_reports: 0,
        shelters_with_reports: 0,
        total_new_cases: 0,
        total_recovered: 0,
        total_hospitalized: 0,
        total_deaths: 0,
        latest_report_date: null
    },
    by_disease: [],
    by_shelter: [],
    daily_trend: []
};

function buildEmptyPayload(reportDate = null, sessionId = null) {
    return {
        ...emptyPayload,
        session_id: sessionId,
        report_date: reportDate,
        summary: { ...emptyPayload.summary }
    };
}

async function tableExists(pool, tableName) {
    const [rows] = await pool.query(
        `SELECT COUNT(*) as count
         FROM INFORMATION_SCHEMA.TABLES
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = ?`,
        [tableName]
    );
    return Number(rows[0]?.count || 0) > 0;
}

async function findActiveFloodSession(pool) {
    const [rows] = await pool.query(
        `SELECT id
         FROM eoc_sessions
         WHERE eoc_type = 'flood'
           AND status = 'active'
         ORDER BY opened_at DESC, id DESC
         LIMIT 1`
    );
    return rows[0]?.id || null;
}

function toNumber(value) {
    return Number(value || 0);
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const rawSessionId = searchParams.get("session_id");
        const reportDate = searchParams.get("report_date");
        const sessionId = rawSessionId && !rawSessionId.includes("overview") ? rawSessionId : null;

        const pool = await getConnection();
        const effectiveSessionId = sessionId || await findActiveFloodSession(pool);
        if (!effectiveSessionId) {
            return NextResponse.json({ success: true, data: buildEmptyPayload(reportDate) });
        }
        const hasShelterDiseases = await tableExists(pool, "shelter_disease_reports");
        if (!hasShelterDiseases) {
            return NextResponse.json({
                success: true,
                data: buildEmptyPayload(reportDate, effectiveSessionId)
            });
        }

        const dateFilter = reportDate ? " AND DATE(sdr.report_date) = ?" : "";
        const scopedParams = reportDate ? [effectiveSessionId, reportDate] : [effectiveSessionId];

        const [summaryRows] = await pool.query(
            `SELECT
                COUNT(*) as total_reports,
                COUNT(DISTINCT sdr.shelter_id) as shelters_with_reports,
                SUM(COALESCE(sdr.new_cases, 0)) as total_new_cases,
                SUM(COALESCE(sdr.recovered, 0)) as total_recovered,
                SUM(COALESCE(sdr.hospitalized, 0)) as total_hospitalized,
                SUM(COALESCE(sdr.deaths, 0)) as total_deaths,
                DATE_FORMAT(MAX(sdr.report_date), '%Y-%m-%d') as latest_report_date
             FROM shelter_disease_reports sdr
             WHERE sdr.session_id = ?${dateFilter}`,
            scopedParams
        );

        const [byDisease] = await pool.query(
            `SELECT
                sdr.disease_type as disease_name,
                SUM(COALESCE(sdr.new_cases, 0)) as new_cases,
                SUM(COALESCE(sdr.recovered, 0)) as recovered,
                SUM(COALESCE(sdr.hospitalized, 0)) as hospitalized,
                SUM(COALESCE(sdr.deaths, 0)) as deaths,
                COUNT(DISTINCT sdr.shelter_id) as shelter_count
             FROM shelter_disease_reports sdr
             WHERE sdr.session_id = ?${dateFilter}
             GROUP BY sdr.disease_type
             ORDER BY new_cases DESC, hospitalized DESC, disease_name ASC
             LIMIT 8`,
            scopedParams
        );

        const [byShelter] = await pool.query(
            `SELECT
                COALESCE(sc.sheltername, 'พื้นที่รายงาน') as sheltername,
                sc.district_name,
                sc.tambon,
                SUM(COALESCE(sdr.new_cases, 0)) as new_cases,
                SUM(COALESCE(sdr.hospitalized, 0)) as hospitalized,
                COUNT(DISTINCT sdr.disease_type) as disease_count
             FROM shelter_disease_reports sdr
             LEFT JOIN shelter_centers sc ON sdr.shelter_id = sc.id
             WHERE sdr.session_id = ?${dateFilter}
             GROUP BY sdr.shelter_id, sc.sheltername, sc.district_name, sc.tambon
             ORDER BY new_cases DESC, hospitalized DESC, sheltername ASC
             LIMIT 6`,
            scopedParams
        );

        const trendParams = reportDate
            ? [effectiveSessionId, reportDate, reportDate]
            : [effectiveSessionId];
        const trendFilter = reportDate
            ? "AND DATE(sdr.report_date) BETWEEN DATE_SUB(?, INTERVAL 6 DAY) AND ?"
            : "";
        const [dailyTrendRows] = await pool.query(
            `SELECT
                DATE_FORMAT(DATE(sdr.report_date), '%Y-%m-%d') as report_date,
                SUM(COALESCE(sdr.new_cases, 0)) as new_cases,
                SUM(COALESCE(sdr.hospitalized, 0)) as hospitalized
             FROM shelter_disease_reports sdr
             WHERE sdr.session_id = ?
               ${trendFilter}
             GROUP BY DATE_FORMAT(DATE(sdr.report_date), '%Y-%m-%d')
             ORDER BY report_date ${reportDate ? "ASC" : "DESC"}
             LIMIT 7`,
            trendParams
        );

        const dailyTrend = reportDate ? dailyTrendRows : [...dailyTrendRows].reverse();
        const summary = summaryRows[0] || emptyPayload.summary;
        return NextResponse.json({
            success: true,
            data: {
                session_id: effectiveSessionId,
                report_date: reportDate,
                period: null,
                data_source: "database",
                summary: {
                    total_reports: toNumber(summary.total_reports),
                    shelters_with_reports: toNumber(summary.shelters_with_reports),
                    total_new_cases: toNumber(summary.total_new_cases),
                    total_recovered: toNumber(summary.total_recovered),
                    total_hospitalized: toNumber(summary.total_hospitalized),
                    total_deaths: toNumber(summary.total_deaths),
                    latest_report_date: summary.latest_report_date || null
                },
                by_disease: byDisease.map((row) => ({
                    disease_name: row.disease_name,
                    new_cases: toNumber(row.new_cases),
                    recovered: toNumber(row.recovered),
                    hospitalized: toNumber(row.hospitalized),
                    deaths: toNumber(row.deaths),
                    shelter_count: toNumber(row.shelter_count)
                })),
                by_shelter: byShelter.map((row) => ({
                    sheltername: row.sheltername,
                    district_name: row.district_name,
                    tambon: row.tambon,
                    new_cases: toNumber(row.new_cases),
                    hospitalized: toNumber(row.hospitalized),
                    disease_count: toNumber(row.disease_count)
                })),
                daily_trend: dailyTrend.map((row) => ({
                    report_date: row.report_date,
                    new_cases: toNumber(row.new_cases),
                    hospitalized: toNumber(row.hospitalized)
                }))
            }
        });
    } catch (error) {
        console.error("Public flood disease summary error:", error);
        return NextResponse.json({ success: true, data: buildEmptyPayload() });
    }
}
