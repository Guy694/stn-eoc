import { NextResponse } from "next/server";
import { getMaintenanceState, sessionRole } from "@/lib/maintenance";
import { maintenanceDecision } from "@/lib/maintenanceRules";
import { isAiBot } from "@/lib/aiBots";

// ด่านแรกของทุกคำขอหน้าเว็บ/API (Next.js 16 "proxy" เดิมชื่อ middleware — รันบน Node.js)
//
// 1) โหมดปิดปรับปรุงระบบ (แอดมินเปิด/ปิดจากหน้า ตั้งค่าระบบ): ทุกหน้าแสดงหน้าแจ้งปิดปรับปรุง ทุก API ตอบ 503
//    ยกเว้นหน้าเข้าสู่ระบบ และผู้ดูแลระบบ (หรือเจ้าหน้าที่ทุกคน ถ้าแอดมินอนุญาต)
// 0) บอท AI (ตาม User-Agent ใน lib/aiBots.js) → 403 ทุกหน้าและ API — robots.txt ยังเปิดให้อ่าน เพื่อให้บอทรู้กติกา
// 2) หน้าเว็บภายใน: ตรวจเพียงว่ามี cookie session ของเจ้าหน้าที่หรือไม่ เพื่อไม่ให้ผู้ที่ยังไม่เข้าสู่ระบบเห็นโครงหน้า
//    การตรวจสิทธิ์จริง (session หมดอายุ, role, การอนุมัติ, บังคับเปลี่ยนรหัสผ่าน) อยู่ที่ API ซึ่งเป็นขอบเขตความปลอดภัยที่แท้จริง

const PROTECTED_PREFIXES = ["/admin", "/commander", "/eoc", "/analytics", "/resources", "/settings"];

function isProtectedPath(pathname) {
    return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

async function maintenanceResponse(request) {
    const state = await getMaintenanceState();
    if (!state.enabled) return null;
    const { pathname } = request.nextUrl;
    const token = request.cookies.get("session_token")?.value;
    const role = token ? await sessionRole(token) : null;
    const decision = maintenanceDecision({ pathname, state, role });
    if (decision === "pass") return null;

    const headers = { "Cache-Control": "no-store", "Retry-After": "600", "X-Maintenance": "1" };
    if (decision === "block-api") {
        return NextResponse.json(
            { success: false, maintenance: true, message: state.message, until: state.until },
            { status: 503, headers }
        );
    }
    const url = request.nextUrl.clone();
    url.pathname = "/maintenance/";
    url.search = "";
    const response = NextResponse.rewrite(url);
    for (const [key, value] of Object.entries(headers)) response.headers.set(key, value);
    return response;
}

function aiBotResponse(request) {
    if (!isAiBot(request.headers.get("user-agent"))) return null;
    const headers = { "Cache-Control": "no-store", "X-Robots-Tag": "noindex, noai, noimageai" };
    if (request.nextUrl.pathname.startsWith("/api/")) {
        return NextResponse.json({ success: false, message: "ไม่อนุญาตให้บอท AI เข้าถึงระบบนี้" }, { status: 403, headers });
    }
    return new NextResponse("ไม่อนุญาตให้บอท AI เข้าถึงเว็บไซต์นี้ (AI agents are not permitted on this site.)", {
        status: 403,
        headers: { ...headers, "Content-Type": "text/plain; charset=utf-8" }
    });
}

export async function proxy(request) {
    const aiBlocked = aiBotResponse(request);
    if (aiBlocked) return aiBlocked;

    const blocked = await maintenanceResponse(request);
    if (blocked) return blocked;

    const { pathname, search } = request.nextUrl;
    if (!isProtectedPath(pathname)) {
        return NextResponse.next();
    }

    if (request.cookies.get("session_token")?.value) {
        return NextResponse.next();
    }

    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login/";
    loginUrl.search = "";
    loginUrl.searchParams.set("next", `${pathname}${search || ""}`);
    return NextResponse.redirect(loginUrl);
}

export const config = {
    // ทุกหน้าและ API ยกเว้นไฟล์ static (รูป, สคริปต์, ฟอนต์) — ตอนระบบเปิดปกติ proxy อ่านค่าจากหน่วยความจำ (แคช 10 วินาที) เท่านั้น
    // หมายเหตุ: หน้าแรก "/" ต้องระบุแยก — ถ้าให้ regex ".*" จับ "/" ด้วย (ร่วมกับ basePath) Next ตอบหน้าว่าง
    matcher: [
        "/",
        "/((?!_next/static|_next/image|favicon\\.ico|img/|uploads/|infographics/|flood-maps/|.*\\.(?:png|jpg|jpeg|gif|svg|webp|avif|ico|css|js|map|txt|xml|json|woff2?|ttf|pdf|geojson)$).+)",
    ],
};
