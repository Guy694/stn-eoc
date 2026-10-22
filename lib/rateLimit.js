import { NextResponse } from 'next/server';
import { query } from '@/lib/db';
import { getClientIp } from '@/lib/clientIp';

// Rate limit แบบ fixed window
// - เก็บตัวนับในตาราง `rate_limit_hits` (migrations/20260930_security_hardening.sql)
//   จึงไม่รีเซ็ตเมื่อ restart และใช้ร่วมกันได้หลาย instance
// - ถ้าตารางยังไม่ถูกสร้างหรือฐานข้อมูลมีปัญหา จะถอยไปใช้ตัวนับในหน่วยความจำแทน
//   เพื่อไม่ให้ฟอร์มขอความช่วยเหลือของประชาชนใช้งานไม่ได้

export const RATE_LIMITS = {
    publicReport: { limit: 5, windowSeconds: 15 * 60 },       // แจ้งเหตุ/ขอความช่วยเหลือ
    publicFeedback: { limit: 10, windowSeconds: 60 * 60 },    // กด "ตอนนี้ปกติแล้ว" บนแผนที่
    publicAccidentReport: { limit: 10, windowSeconds: 15 * 60 },
    chatbotPublic: { limit: 15, windowSeconds: 5 * 60 },
    chatbotAnalytics: { limit: 20, windowSeconds: 5 * 60 },
    routeAdvice: { limit: 30, windowSeconds: 5 * 60 },
    placeSearch: { limit: 60, windowSeconds: 5 * 60 },        // ค้นหาสถานที่ในหน้ารายงานระดับน้ำ
    publicTrack: { limit: 20, windowSeconds: 15 * 60 },       // ติดตามคำขอ (กันการเดาเลขติดตาม)
    publicPush: { limit: 20, windowSeconds: 15 * 60 },        // สมัคร/เปลี่ยน/ยกเลิกรับแจ้งเตือนภัย
    // ตัวนับสถิติ/ยอดเข้าชม: กันการยิงซ้ำปั่นตัวเลขและภาระเขียนฐานข้อมูล (ใช้ store: 'memory' เพราะไม่ต้องแม่นข้าม instance)
    publicUsage: { limit: 120, windowSeconds: 5 * 60 },
    siteView: { limit: 30, windowSeconds: 60 * 60 },
    visitLog: { limit: 120, windowSeconds: 5 * 60 },           // บันทึกผู้เข้าชม (IP/ตำแหน่ง) ต่อ IP
    announcementView: { limit: 1, windowSeconds: 60 * 60 },   // ต่อ IP ต่อประกาศ
    geoLookup: { limit: 120, windowSeconds: 5 * 60 },          // พิกัด → หมู่บ้าน (บ้านฉันเสี่ยงไหม)
    // สมัครเจ้าหน้าที่: เจ้าหน้าที่ทั้ง รพ./รพ.สต. มักใช้เน็ตเดียวกัน (IP เดียว) และอาจกดส่งซ้ำตอนกรอกผิด จึงเผื่อไว้มาก
    register: { limit: 30, windowSeconds: 15 * 60 },
    importUpload: { limit: 40, windowSeconds: 15 * 60 },       // ตรวจ/นำเข้าไฟล์ Excel (เจ้าหน้าที่)
    login: { limit: 100, windowSeconds: 15 * 60 },              // ต่อ IP (ค่าจริงมาจาก lib/loginPolicy.js — ปรับใน .env ได้)
};

const memoryBuckets = new Map();
let lastSweep = 0;

function consumeInMemory(key, limit, windowSeconds, now) {
    if (now - lastSweep > 60_000) {
        lastSweep = now;
        for (const [bucketKey, bucket] of memoryBuckets) {
            if (bucket.resetAt <= now) memoryBuckets.delete(bucketKey);
        }
    }

    const current = memoryBuckets.get(key);
    if (!current || current.resetAt <= now) {
        memoryBuckets.set(key, { count: 1, resetAt: now + windowSeconds * 1000 });
        return { allowed: true, remaining: limit - 1, retryAfterSeconds: 0 };
    }

    current.count += 1;
    const allowed = current.count <= limit;
    return {
        allowed,
        remaining: Math.max(0, limit - current.count),
        retryAfterSeconds: allowed ? 0 : Math.ceil((current.resetAt - now) / 1000),
    };
}

export function resetInMemoryRateLimits() {
    memoryBuckets.clear();
}

/**
 * @param {string} name     ชื่อกลุ่ม เช่น 'publicReport'
 * @param {string} subject  ตัวระบุผู้เรียก เช่น IP หรือ user id
 */
export async function consumeRateLimit(name, subject, options = {}) {
    const config = { ...(RATE_LIMITS[name] || {}), ...options };
    const limit = config.limit ?? 10;
    const windowSeconds = config.windowSeconds ?? 60;
    const now = options.now ?? Date.now();
    const windowStart = Math.floor(now / 1000 / windowSeconds) * windowSeconds;
    const key = `${name}:${subject || 'unknown'}`.slice(0, 190);

    if (options.store !== 'memory') {
        try {
            await query(
                `INSERT INTO rate_limit_hits (bucket_key, window_start, hits, expires_at)
                 VALUES (?, FROM_UNIXTIME(?), 1, FROM_UNIXTIME(?))
                 ON DUPLICATE KEY UPDATE hits = hits + 1`,
                [key, windowStart, windowStart + windowSeconds]
            );
            const rows = await query(
                'SELECT hits FROM rate_limit_hits WHERE bucket_key = ? AND window_start = FROM_UNIXTIME(?)',
                [key, windowStart]
            );
            const hits = Number(rows?.[0]?.hits || 1);
            const allowed = hits <= limit;

            // ล้างแถวที่หมดอายุแบบสุ่มเป็นครั้งคราว
            if (Math.random() < 0.02) {
                void Promise.resolve()
                    .then(() => query('DELETE FROM rate_limit_hits WHERE expires_at < NOW() LIMIT 1000', []))
                    .catch(() => {});
            }

            return {
                allowed,
                remaining: Math.max(0, limit - hits),
                retryAfterSeconds: allowed ? 0 : Math.max(1, windowStart + windowSeconds - Math.floor(now / 1000)),
            };
        } catch (error) {
            if (error?.code !== 'ER_NO_SUCH_TABLE') {
                console.error('[rateLimit] database store unavailable, using memory store:', error?.code || error?.message);
            }
        }
    }

    return consumeInMemory(key, limit, windowSeconds, now);
}

/** ข้อความบอกเวลาที่ต้องรอ เช่น "ประมาณ 3 นาที" */
export function waitText(seconds) {
    const value = Math.max(1, Math.ceil(Number(seconds) || 60));
    return value < 90 ? `ประมาณ ${value} วินาที` : `ประมาณ ${Math.ceil(value / 60)} นาที`;
}

export function tooManyRequestsResponse(result, message = `ส่งคำขอถี่เกินไป กรุณารอ${waitText(result?.retryAfterSeconds)}แล้วลองใหม่`) {
    return NextResponse.json(
        { success: false, message, error: message },
        {
            status: 429,
            headers: { 'Retry-After': String(result?.retryAfterSeconds || 60) },
        }
    );
}

/**
 * ตรวจ rate limit ตาม IP ของผู้เรียก คืนค่า response 429 ถ้าเกิน หรือ null ถ้ายังไม่เกิน
 */
export async function enforceIpRateLimit(request, name, options) {
    const result = await consumeRateLimit(name, getClientIp(request), options);
    return result.allowed ? null : tooManyRequestsResponse(result);
}
