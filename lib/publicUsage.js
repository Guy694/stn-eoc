"use client";

const LAST_PUBLIC_PATH_KEY = "stn-eoc:last-public-path";

export function isPublicPath(pathname) {
    return pathname === "/" || pathname === "/privacy-policy" || pathname.startsWith("/public/");
}

function deviceType() {
    const width = window.innerWidth;
    if (width < 768) return "mobile";
    if (width < 1024) return "tablet";
    return "desktop";
}

export function trackPublicUsage(eventKey, pathname, { oncePerSession = false } = {}) {
    if (typeof window === "undefined" || !isPublicPath(pathname)) return;

    const sessionKey = `stn-eoc:usage:${eventKey}:${pathname}`;
    try {
        if (oncePerSession && window.sessionStorage.getItem(sessionKey) === "1") return;

        const sourcePath = window.sessionStorage.getItem(LAST_PUBLIC_PATH_KEY) || "";
        if (oncePerSession) window.sessionStorage.setItem(sessionKey, "1");
        window.sessionStorage.setItem(LAST_PUBLIC_PATH_KEY, pathname);

        fetch("/stn-eoc/api/public/usage", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ eventKey, pagePath: pathname, sourcePath, deviceType: deviceType() }),
            keepalive: true
        }).catch(() => undefined);
    } catch {
        // การวัดผลเป็นข้อมูลเสริม หน้า public ต้องทำงานต่อได้เมื่อ browser ปิด storage
    }
}
