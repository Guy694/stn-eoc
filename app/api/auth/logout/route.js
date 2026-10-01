import { NextResponse } from "next/server";
import { publicInternalError } from "@/lib/apiResponse";
import { clearCitizenSessionCookie } from "@/lib/citizenAuth";
import { clearRegistrationSessionCookie } from "@/lib/registrationSession";
import { clearSessionCookie, getSessionToken, hashSessionToken } from "@/lib/auth";
import { getClientIp, getUserAgent } from "@/lib/clientIp";
import { query } from "@/lib/db";

function loggedOutResponse() {
    const response = NextResponse.json({
        success: true,
        message: 'ออกจากระบบสำเร็จ'
    });
    clearCitizenSessionCookie(response);
    clearRegistrationSessionCookie(response);
    clearSessionCookie(response);
    return response;
}

export async function POST(request) {
    try {
        // รับ token จาก cookie/Authorization เท่านั้น (ไม่รับจาก body เพื่อกันการสั่งปิด session ของผู้อื่นแบบ CSRF)
        const sessionToken = getSessionToken(request);
        if (!sessionToken) {
            return loggedOutResponse();
        }

        const tokenHash = hashSessionToken(sessionToken);
        const sessions = await query(
            'SELECT user_id, username FROM user_sessions WHERE session_token = ?',
            [tokenHash]
        );

        await query('DELETE FROM user_sessions WHERE session_token = ?', [tokenHash]);

        if (sessions.length > 0) {
            await query(
                `INSERT INTO security_logs (event_type, user_id, username, ip_address, user_agent, details, severity)
                 VALUES (?, ?, ?, ?, ?, ?, ?)`,
                ['logout', sessions[0].user_id, sessions[0].username, getClientIp(request), getUserAgent(request), 'User logged out', 'low']
            );
        }

        return loggedOutResponse();
    } catch (error) {
        console.error('Logout error:', error);
        return publicInternalError('เกิดข้อผิดพลาดในการออกจากระบบ');
    }
}
