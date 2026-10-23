// ระบุ IP ของผู้เรียกใช้งานอย่างปลอดภัย
//
// header `X-Forwarded-For` ถูกปลอมได้โดยผู้ใช้ ถ้าแอปไม่ได้อยู่หลัง reverse proxy ที่เขียนทับค่านี้
// จึงเชื่อ header นี้เฉพาะเมื่อกำหนด TRUST_PROXY เท่านั้น:
//   TRUST_PROXY=1  -> อยู่หลัง proxy 1 ชั้น (เช่น nginx) ใช้ค่าขวาสุดของ X-Forwarded-For
//   TRUST_PROXY=2  -> อยู่หลัง proxy 2 ชั้น (เช่น load balancer + nginx) ใช้ค่าลำดับที่ 2 จากขวา
//   ไม่กำหนด/0     -> ไม่เชื่อ header ใด ๆ (ใช้ X-Real-IP ถ้ามี ซึ่ง nginx ตั้งค่าเอง)

function getTrustedHopCount(env = process.env) {
    const value = Number.parseInt(env.TRUST_PROXY || '0', 10);
    return Number.isInteger(value) && value > 0 ? value : 0;
}

function normalizeIp(value) {
    if (!value) return null;
    const trimmed = String(value).trim();
    if (!trimmed || trimmed.length > 64) return null;
    return trimmed.replace(/^::ffff:/, '');
}

export function getClientIp(request, env = process.env) {
    const headers = request?.headers;
    if (!headers?.get) return 'unknown';

    const hops = getTrustedHopCount(env);
    if (hops > 0) {
        const chain = (headers.get('x-forwarded-for') || '')
            .split(',')
            .map((part) => part.trim())
            .filter(Boolean);
        if (chain.length > 0) {
            // proxy ตัวสุดท้ายต่อท้าย IP ที่เห็นจริงไว้ขวาสุด ค่าทางซ้ายกว่านั้นผู้ใช้ปลอมได้
            const candidate = chain[Math.max(0, chain.length - hops)];
            const ip = normalizeIp(candidate);
            if (ip) return ip;
        }
    }

    return normalizeIp(headers.get('x-real-ip')) || 'unknown';
}

export function getUserAgent(request) {
    return (request?.headers?.get?.('user-agent') || 'unknown').slice(0, 500);
}

/**
 * ตรวจว่าระบบอ่าน IP อย่างไร (หน้าผู้เข้าชมของแอดมิน) — ช่วยตั้ง TRUST_PROXY ให้ตรงกับจำนวน proxy
 * ไม่มีข้อมูลลับ: แสดงเฉพาะ IP ใน header ของคำขอนี้
 */
export function describeIpChain(request, env = process.env) {
    const headers = request?.headers;
    const chain = (headers?.get?.('x-forwarded-for') || '').split(',').map((part) => part.trim()).filter(Boolean);
    const hops = getTrustedHopCount(env);
    const chosen = getClientIp(request, env);
    return {
        trustProxy: hops,
        forwardedFor: chain,
        realIp: normalizeIp(headers?.get?.('x-real-ip')) || null,
        cfConnectingIp: normalizeIp(headers?.get?.('cf-connecting-ip')) || null,
        chosen,
        // ถ้าตั้ง TRUST_PROXY = n จะได้ IP ไหน (ให้แอดมินเทียบกับ IP จริงของตัวเอง)
        options: chain.map((_, index) => ({ trustProxy: index + 1, ip: normalizeIp(chain[chain.length - 1 - index]) }))
    };
}
