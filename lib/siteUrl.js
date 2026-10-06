export function getSiteUrl() {
    const configured = process.env.NEXT_PUBLIC_BASE_URL || process.env.NEXT_PUBLIC_APP_URL;
    return String(configured || "http://localhost:3000/stn-eoc").replace(/\/$/, "");
}

export function getSiteOrigin() {
    return new URL(getSiteUrl()).origin;
}
