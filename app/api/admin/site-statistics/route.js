import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth";
import { query } from "@/lib/db";
import { publicInternalError } from "@/lib/apiResponse";

export async function GET(request) {
    const auth = await requireAuth(request, ["admin"]);
    if (!auth.success) return auth.response;

    try {
        const [totalRows, summaryRows, dailyRows, topPages, devices, helpEvents, helpSources] = await Promise.all([
            query("SELECT metric_value FROM site_statistics WHERE metric_key = 'total_visits' LIMIT 1"),
            query(
                `SELECT
                    COALESCE(SUM(CASE WHEN visit_date = CURDATE() THEN visit_count END), 0) AS today_visits,
                    COALESCE(SUM(CASE WHEN visit_date >= CURDATE() - INTERVAL 6 DAY THEN visit_count END), 0) AS last_7_days
                 FROM site_visit_daily`,
                []
            ),
            query(
                `SELECT DATE_FORMAT(visit_date, '%Y-%m-%d') AS visit_date, visit_count
                 FROM site_visit_daily
                 WHERE visit_date >= CURDATE() - INTERVAL 29 DAY
                 ORDER BY visit_date ASC`,
                []
            ),
            query(
                `SELECT page_path, SUM(event_count) AS visits
                 FROM site_analytics_daily
                 WHERE event_key = 'page_view' AND event_date >= CURDATE() - INTERVAL 29 DAY
                 GROUP BY page_path
                 ORDER BY visits DESC, page_path ASC
                 LIMIT 10`,
                []
            ),
            query(
                `SELECT device_type, SUM(event_count) AS visits
                 FROM site_analytics_daily
                 WHERE event_key = 'page_view' AND event_date >= CURDATE() - INTERVAL 29 DAY
                 GROUP BY device_type
                 ORDER BY visits DESC`,
                []
            ),
            query(
                `SELECT event_key, SUM(event_count) AS total
                 FROM site_analytics_daily
                 WHERE event_key IN ('help_request_opened', 'help_request_submitted')
                   AND event_date >= CURDATE() - INTERVAL 29 DAY
                 GROUP BY event_key`,
                []
            ),
            query(
                `SELECT source_path, SUM(event_count) AS starts
                 FROM site_analytics_daily
                 WHERE event_key = 'help_request_opened' AND source_path <> ''
                   AND event_date >= CURDATE() - INTERVAL 29 DAY
                 GROUP BY source_path
                 ORDER BY starts DESC, source_path ASC
                 LIMIT 10`,
                []
            )
        ]);

        return NextResponse.json({
            success: true,
            data: {
                totalVisits: Number(totalRows[0]?.metric_value || 0),
                todayVisits: Number(summaryRows[0]?.today_visits || 0),
                last7DaysVisits: Number(summaryRows[0]?.last_7_days || 0),
                dailyVisits: dailyRows.map((row) => ({
                    date: row.visit_date,
                    visits: Number(row.visit_count || 0)
                })),
                topPages: topPages.map((row) => ({ path: row.page_path, visits: Number(row.visits || 0) })),
                devices: devices.map((row) => ({ type: row.device_type, visits: Number(row.visits || 0) })),
                helpRequests: {
                    opened: Number(helpEvents.find((row) => row.event_key === "help_request_opened")?.total || 0),
                    submitted: Number(helpEvents.find((row) => row.event_key === "help_request_submitted")?.total || 0),
                    sources: helpSources.map((row) => ({ path: row.source_path, starts: Number(row.starts || 0) }))
                }
            }
        });
    } catch (error) {
        console.error("Get site statistics error:", error);
        return publicInternalError("เกิดข้อผิดพลาดในการดึงสถิติผู้เข้าชมเว็บไซต์");
    }
}
