import crypto from "crypto";
import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TEAM_ROLE_CODES, TEAM_ROLE_OPTIONS } from "@/lib/eocRoles";

// ---------------------------------------------------------------------------
// สิทธิ์ตามบทบาท (แหล่งเดียวของทั้งระบบ — login, ThaiD callback และ session ใช้ชุดนี้)
// ---------------------------------------------------------------------------

export const rolePermissions = {
    admin: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: true },
        admin: { view: true, create: true, edit: true, delete: true },
        reports: { view: true, create: true, export: true },
        users: { view: true, create: true, edit: true, delete: true }
    },
    commander: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: false },
        admin: { view: true, create: false, edit: false, delete: false },
        reports: { view: true, create: true, export: true },
        users: { view: true, create: false, edit: false, delete: false }
    },
    MCATT: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: false },
        admin: { view: true, create: false, edit: false, delete: false },
        reports: { view: true, create: true, export: true },
        users: { view: true, create: false, edit: false, delete: false }
    },
    SAT: {
        dashboard: true,
        eoc: { view: true, create: true, edit: true, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: true, create: false, export: false },
        users: { view: false, create: false, edit: false, delete: false }
    },
    SEhRT: {
        dashboard: true,
        eoc: { view: true, create: true, edit: false, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: true, create: false, export: false },
        users: { view: false, create: false, edit: false, delete: false }
    },
    staff: {
        dashboard: true,
        eoc: { view: true, create: true, edit: false, delete: false },
        admin: { view: false, create: false, edit: false, delete: false },
        reports: { view: true, create: false, export: false },
        users: { view: false, create: false, edit: false, delete: false }
    },
    citizen: {
        dashboard: true
    }
};

for (const roleCode of TEAM_ROLE_CODES) {
    if (!rolePermissions[roleCode]) {
        rolePermissions[roleCode] = roleCode === "EOC_COMMANDER"
            ? rolePermissions.commander
            : rolePermissions.staff;
    }
}

export const roleDisplayNames = {
    admin: "ผู้ดูแลระบบ",
    commander: "ผู้บัญชาการเหตุการณ์",
    MCATT: "ทีม MCATT",
    SAT: "ทีม SAT",
    SEhRT: "ทีม SEhRT",
    staff: "เจ้าหน้าที่",
    citizen: "ประชาชน"
};

for (const role of TEAM_ROLE_OPTIONS) {
    roleDisplayNames[role.value] = role.roleDisplayName || `ทีม ${role.value}`;
}

/** ชื่อบทบาทเดิมที่เปลี่ยนแล้ว (ใช้ระหว่างที่ฐานข้อมูลยังไม่ได้รัน migration 20261022_rename_sehrt) */
const LEGACY_ROLE_NAMES = { SeRHT: "SEhRT" };
export function normalizeRole(role) {
    return LEGACY_ROLE_NAMES[role] || role;
}

export function getRolePermissions(role) {
    return rolePermissions[role] || rolePermissions.staff;
}

export function getRoleDisplayName(role) {
    return roleDisplayNames[role] || role;
}

// ---------------------------------------------------------------------------
// Session token
// ---------------------------------------------------------------------------

export const SESSION_COOKIE_NAME = "session_token";
export const SESSION_MAX_AGE_SECONDS = 24 * 60 * 60;

/** จำนวนนาทีที่ไม่มีการใช้งานก่อน session หมดอายุ (ตั้งได้ด้วย SESSION_IDLE_MINUTES, ค่าเริ่มต้น 30) */
export function getSessionIdleMinutes(env = process.env) {
    const value = Number.parseInt(env.SESSION_IDLE_MINUTES || "30", 10);
    return Number.isInteger(value) && value >= 5 && value <= 240 ? value : 30;
}

/**
 * ฐานข้อมูลเก็บเฉพาะ SHA-256 ของ token — ถ้าตาราง user_sessions รั่ว ผู้โจมตีก็ยังนำไปใช้เข้าสู่ระบบไม่ได้
 */
export function hashSessionToken(token) {
    return crypto.createHash("sha256").update(String(token)).digest("hex");
}

export function generateSessionToken() {
    return crypto.randomBytes(32).toString("hex");
}

/**
 * สร้าง session ใหม่ของเจ้าหน้าที่ แล้วคืน token ดิบ (ใช้ใส่ cookie เท่านั้น ไม่เก็บลงฐานข้อมูล)
 * @param {(sql: string, params: any[]) => Promise<any>} execute  ฟังก์ชันรัน SQL (เช่น connection.execute)
 */
export async function createUserSession(execute, { officer, ipAddress, userAgent, loginMethod }) {
    const token = generateSessionToken();
    const expiresAt = new Date(Date.now() + SESSION_MAX_AGE_SECONDS * 1000);

    await execute(
        `INSERT INTO user_sessions
            (session_token, user_id, username, title, given_name, family_name, email, phone, role, ip_address, user_agent, expires_at, login_method)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
            hashSessionToken(token),
            officer.id,
            officer.username,
            officer.title ?? null,
            officer.given_name ?? null,
            officer.family_name ?? null,
            officer.email ?? null,
            officer.phone ?? null,
            officer.role,
            ipAddress || "unknown",
            userAgent || "unknown",
            expiresAt,
            loginMethod
        ]
    );

    return { token, expiresAt };
}

export function setSessionCookie(response, token) {
    response.cookies.set(SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: SESSION_MAX_AGE_SECONDS,
        path: "/"
    });
    return response;
}

export function clearSessionCookie(response) {
    response.cookies.set(SESSION_COOKIE_NAME, "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "strict",
        maxAge: 0,
        path: "/"
    });
    return response;
}

/** ปิดทุก session ของผู้ใช้ (ใช้หลังเปลี่ยน/รีเซ็ตรหัสผ่าน) ยกเว้น session ปัจจุบันถ้าระบุ */
export async function revokeUserSessions(userId, { exceptToken } = {}) {
    if (exceptToken) {
        await query(
            "UPDATE user_sessions SET is_active = 0 WHERE user_id = ? AND session_token <> ?",
            [userId, hashSessionToken(exceptToken)]
        );
        return;
    }
    await query("UPDATE user_sessions SET is_active = 0 WHERE user_id = ?", [userId]);
}

export function getSessionToken(request) {
    const cookieToken = request.cookies?.get(SESSION_COOKIE_NAME)?.value;
    if (cookieToken) return cookieToken;

    const authHeader = request.headers?.get?.("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }

    return null;
}

export function forbiddenResponse(message = "ไม่มีสิทธิ์เข้าถึง", extra = {}) {
    return NextResponse.json({ success: false, message, ...extra }, { status: 403 });
}

export function unauthorizedResponse(message = "กรุณาเข้าสู่ระบบ") {
    return NextResponse.json({ success: false, message }, { status: 401 });
}

// endpoint ที่ผู้ใช้ซึ่งยังต้องเปลี่ยนรหัสผ่านเรียกได้
const PASSWORD_CHANGE_ALLOWED_PATHS = [
    "/api/auth/change-password",
    "/api/auth/session",
    "/api/auth/logout",
    "/api/auth/validate"
];

function getRequestPath(request) {
    try {
        const pathname = request.nextUrl?.pathname || new URL(request.url).pathname;
        return pathname.replace(/^\/stn-eoc/, "").replace(/\/+$/, "") || "/";
    } catch {
        return "";
    }
}

export function isPasswordChangeAllowedPath(request) {
    const path = getRequestPath(request);
    return PASSWORD_CHANGE_ALLOWED_PATHS.includes(path);
}

export async function getAuthSession(request, { allowPasswordChangeRequired = false } = {}) {
    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
        return { success: false, response: unauthorizedResponse("ไม่พบโทเคนการเข้าสู่ระบบ") };
    }

    const tokenHash = hashSessionToken(sessionToken);
    const idleLimit = getSessionIdleMinutes();

    // ใช้ role/สถานะอนุมัติจากตาราง officer ปัจจุบันเสมอ
    // (ถ้าผู้ดูแลเปลี่ยน role หรือยกเลิกอนุมัติ จะมีผลทันทีโดยไม่ต้องรอ session หมดอายุ)
    const sessions = await query(
        `SELECT
            s.session_token,
            s.user_id,
            o.username,
            o.role,
            s.last_activity,
            TIMESTAMPDIFF(MINUTE, s.last_activity, NOW()) as idle_minutes,
            o.title,
            o.given_name,
            o.family_name,
            o.email,
            o.phone,
            o.department,
            o.position,
            o.is_approved,
            o.must_change_password,
            o.account_locked_until
        FROM user_sessions s
        JOIN officer o ON s.user_id = o.id
        WHERE s.session_token = ?
            AND s.expires_at > NOW()
            AND s.is_active = 1`,
        [tokenHash]
    );

    if (sessions.length === 0) {
        return { success: false, response: unauthorizedResponse("การเข้าสู่ระบบหมดอายุหรือไม่ถูกต้อง") };
    }

    const session = sessions[0];
    if (session.idle_minutes >= idleLimit) {
        await query("UPDATE user_sessions SET is_active = 0 WHERE session_token = ?", [tokenHash]);
        return { success: false, response: unauthorizedResponse("การเข้าสู่ระบบหมดอายุเนื่องจากไม่มีการใช้งาน") };
    }

    if (Number(session.is_approved) !== 1) {
        return { success: false, response: forbiddenResponse("บัญชียังไม่ได้รับการอนุมัติ", { code: "ACCOUNT_PENDING_APPROVAL" }) };
    }

    if (session.account_locked_until && new Date(session.account_locked_until) > new Date()) {
        return { success: false, response: forbiddenResponse("บัญชีถูกล็อค กรุณาติดต่อผู้ดูแลระบบ", { code: "ACCOUNT_LOCKED" }) };
    }

    const mustChangePassword = Number(session.must_change_password) === 1;
    if (mustChangePassword && !allowPasswordChangeRequired && !isPasswordChangeAllowedPath(request)) {
        return {
            success: false,
            response: forbiddenResponse("กรุณาเปลี่ยนรหัสผ่านก่อนใช้งานระบบ", { code: "PASSWORD_CHANGE_REQUIRED" })
        };
    }

    await query("UPDATE user_sessions SET last_activity = NOW() WHERE session_token = ?", [tokenHash]);

    return {
        success: true,
        token: sessionToken,
        user: {
            id: session.user_id,
            username: session.username,
            title: session.title,
            givenName: session.given_name,
            familyName: session.family_name,
            email: session.email,
            phone: session.phone,
            role: normalizeRole(session.role),
            roleDisplay: getRoleDisplayName(normalizeRole(session.role)),
            permissions: getRolePermissions(normalizeRole(session.role)),
            department: session.department,
            position: session.position,
            isApproved: session.is_approved,
            mustChangePassword
        },
        remainingMinutes: idleLimit - session.idle_minutes
    };
}

export async function requireAuth(request, allowedRoles = [], options = {}) {
    const auth = await getAuthSession(request, options);
    if (!auth.success) return auth;

    const hasStaffEquivalentAccess = allowedRoles.includes("staff") && TEAM_ROLE_CODES.includes(auth.user.role);
    if (allowedRoles.length > 0 && !allowedRoles.includes(auth.user.role) && !hasStaffEquivalentAccess) {
        return { success: false, response: forbiddenResponse() };
    }

    return auth;
}

/** role ที่ถือเป็นเจ้าหน้าที่ปฏิบัติงาน (ใช้กับ endpoint ภายในที่ทุกทีมเห็นได้) */
export const OFFICER_ROLES = ["admin", "commander", "MCATT", "SAT", "SEhRT", "staff"];
