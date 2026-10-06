import { NextResponse } from "next/server";
import { query } from "@/lib/db";

const EVENT_KEYS = new Set(["page_view", "help_request_opened", "help_request_submitted"]);
const DEVICE_TYPES = new Set(["mobile", "tablet", "desktop", "other"]);
const PUBLIC_PATHS = new Set([
    "/", "/privacy-policy", "/public/agencies", "/public/announcements", "/public/disaster-map",
    "/public/disease-map", "/public/festival-accidents", "/public/festival-accidents/report", "/public/flood-map",
    "/public/help", "/public/help/citizen-guide", "/public/help/faq", "/public/insights", "/public/report-incident",
    "/public/shelters", "/public/weather-watch"
]);

function publicPath(value) {
    const path = String(value || "").trim();
    if (PUBLIC_PATHS.has(path)) return path;
    if (/^\/public\/announcements\/\d+$/.test(path)) return "/public/announcements/[id]";
    return "";
}

export async function POST(request) {
    try {
        const body = await request.json();
        const eventKey = String(body?.eventKey || "");
        const pagePath = publicPath(body?.pagePath);
        const sourcePath = publicPath(body?.sourcePath);
        const deviceType = DEVICE_TYPES.has(body?.deviceType) ? body.deviceType : "other";

        if (!EVENT_KEYS.has(eventKey) || !pagePath) {
            return NextResponse.json({ success: false, message: "ข้อมูลสถิติไม่ถูกต้อง" }, { status: 400 });
        }

        await query(
            `INSERT INTO site_analytics_daily (event_date, event_key, page_path, source_path, device_type, event_count)
             VALUES (CURDATE(), ?, ?, ?, ?, 1)
             ON DUPLICATE KEY UPDATE event_count = event_count + 1`,
            [eventKey, pagePath, sourcePath, deviceType]
        );
        return NextResponse.json({ success: true }, { status: 201 });
    } catch (error) {
        console.error("Record public usage error:", error);
        return NextResponse.json({ success: false, message: "ไม่สามารถบันทึกสถิติการใช้งานได้" }, { status: 500 });
    }
}
