import { NextResponse } from "next/server";

// ด่านแรกของหน้าเว็บภายใน (Next.js 16 "proxy" เดิมชื่อ middleware)
//
// ตรวจเพียงว่ามี cookie session ของเจ้าหน้าที่หรือไม่ เพื่อไม่ให้ผู้ที่ยังไม่เข้าสู่ระบบโหลดโครงหน้าภายในได้
// การตรวจสิทธิ์จริง (session ยังไม่หมดอายุ, role, การอนุมัติ, บังคับเปลี่ยนรหัสผ่าน) ยังอยู่ที่ API ผ่าน lib/auth.js
// ซึ่งเป็นขอบเขตความปลอดภัยที่แท้จริง

const PROTECTED_PREFIXES = ["/admin", "/commander", "/eoc", "/analytics", "/resources", "/settings"];

function isProtectedPath(pathname) {
    return PROTECTED_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request) {
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
    // รันเฉพาะหน้าภายในเท่านั้น (หน้าแรก หน้าสาธารณะ API และไฟล์ static ไม่ผ่าน proxy)
    matcher: [
        "/admin/:path*",
        "/commander/:path*",
        "/eoc/:path*",
        "/analytics/:path*",
        "/resources/:path*",
        "/settings/:path*",
    ],
};
