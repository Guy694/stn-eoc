import { NextResponse } from "next/server";
import { query } from "@/lib/db";
import { TEAM_ROLE_CODES, TEAM_ROLE_OPTIONS } from "@/lib/eocRoles";

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
    SeRHT: {
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
    SeRHT: "ทีม SeRHT",
    staff: "เจ้าหน้าที่"
};

for (const role of TEAM_ROLE_OPTIONS) {
    roleDisplayNames[role.value] = role.roleDisplayName || `ทีม ${role.value}`;
}

export function getSessionToken(request) {
    const cookieToken = request.cookies?.get("session_token")?.value;
    if (cookieToken) return cookieToken;

    const authHeader = request.headers.get("authorization");
    if (authHeader?.startsWith("Bearer ")) {
        return authHeader.substring(7);
    }

    return null;
}

export function forbiddenResponse(message = "ไม่มีสิทธิ์เข้าถึง") {
    return NextResponse.json({ success: false, message }, { status: 403 });
}

export function unauthorizedResponse(message = "กรุณาเข้าสู่ระบบ") {
    return NextResponse.json({ success: false, message }, { status: 401 });
}

export async function getAuthSession(request) {
    const sessionToken = getSessionToken(request);
    if (!sessionToken) {
        return { success: false, response: unauthorizedResponse("ไม่พบ session token") };
    }

    const sessions = await query(
        `SELECT 
            s.session_token,
            s.user_id,
            s.username,
            s.role,
            s.last_activity,
            TIMESTAMPDIFF(MINUTE, s.last_activity, NOW()) as idle_minutes,
            o.title,
            o.given_name,
            o.family_name,
            o.email,
            o.phone,
            o.department,
            o.position,
            o.is_approved
        FROM user_sessions s
        JOIN officer o ON s.user_id = o.id
        WHERE s.session_token = ?
            AND s.expires_at > NOW()
            AND s.is_active = 1`,
        [sessionToken]
    );

    if (sessions.length === 0) {
        return { success: false, response: unauthorizedResponse("Session หมดอายุหรือไม่ถูกต้อง") };
    }

    const session = sessions[0];
    if (session.idle_minutes >= 10) {
        await query("UPDATE user_sessions SET is_active = 0 WHERE session_token = ?", [sessionToken]);
        return { success: false, response: unauthorizedResponse("Session หมดอายุเนื่องจากไม่มีการใช้งาน") };
    }

    await query("UPDATE user_sessions SET last_activity = NOW() WHERE session_token = ?", [sessionToken]);

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
            role: session.role,
            roleDisplay: roleDisplayNames[session.role] || session.role,
            permissions: rolePermissions[session.role] || rolePermissions.staff,
            department: session.department,
            position: session.position,
            isApproved: session.is_approved
        },
        remainingMinutes: 10 - session.idle_minutes
    };
}

export async function requireAuth(request, allowedRoles = []) {
    const auth = await getAuthSession(request);
    if (!auth.success) return auth;

    const hasStaffEquivalentAccess = allowedRoles.includes("staff") && TEAM_ROLE_CODES.includes(auth.user.role);
    if (allowedRoles.length > 0 && !allowedRoles.includes(auth.user.role) && !hasStaffEquivalentAccess) {
        return { success: false, response: forbiddenResponse() };
    }

    return auth;
}
