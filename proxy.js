import { NextResponse } from "next/server";
import { getMaintenanceState, sessionRole } from "@/lib/maintenance";
import { maintenanceDecision } from "@/lib/maintenanceRules";

// ด่านแรกของทุกคำขอหน้าเว็บ/API (Next.js 16 "proxy" เดิมชื่อ middleware — รันบน Node.js)
//
// 1) โหมดปิดปรับปรุงระบบ (แอดมินเปิด/ปิดจากหน้า ตั้งค่าระบบ): ทุกหน้าแสดงหน้าแจ้งปิดปรับปรุง ทุก API ตอบ 503
//    ยกเว้นหน้าเข้าสู่ระบบ และผู้ดูแลระบบ (หรือเจ้าหน้าที่ทุกคน ถ้าแอดมินอนุญาต)
// 2) หน้าเว็บภายใน: ตรวจเพียงว่ามี cookie session ของเจ้าหน้าที่หรือไม่ เพื่อไม่ให้ผู้ที่ยังไม่เข้าสู่ระบบเห็นโครงหน้า
//    การตรวจสิทธิ์จริง (session หมดอายุ, role, การอนุมัติ, บังคับเปลี่ยนรหัสผ่าน) อยู่ที่ API ซึ่งเป็นขอบเขตความปลอดภัยที่แท้จริง

const PROTECTED_PREFIXES = ["/admin", "/commander", "/eoc", "/analytics", "/resources", "/settings"];
const BLOCK_FOREIGN_COUNTRIES = process.env.BLOCK_FOREIGN_COUNTRIES === "1";

function countryBlockResponse(request) {
    if (!BLOCK_FOREIGN_COUNTRIES) return null;

    // cf-ipcountry is supplied by Cloudflare. Enable this only when traffic is
    // forced through Cloudflare and direct access to the origin is restricted.
    const country = request.headers.get("cf-ipcountry")?.trim().toUpperCase();
    if (country === "TH") return null;

    return new Response("ขออภัย เว็บไซต์นี้เปิดให้บริการเฉพาะผู้ที่เชื่อมต่อจากประเทศไทย", {
        status: 403,
        headers: {
            "Content-Type": "text/plain; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

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

export async function proxy(request) {
    const countryBlocked = countryBlockResponse(request);
    if (countryBlocked) return countryBlocked;

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
    // รวมไฟล์ static ด้วย เพื่อให้การจำกัดประเทศครอบคลุมทั้งเว็บและ API
    // หมายเหตุ: หน้าแรก "/" ต้องระบุแยก — ถ้าให้ regex ".*" จับ "/" ด้วย (ร่วมกับ basePath) Next ตอบหน้าว่าง
    matcher: [
        "/",
        "/((?!_next/static|_next/image).+)",
    ],
};
