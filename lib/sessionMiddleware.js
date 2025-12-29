// Middleware helper สำหรับอัพเดท session activity
import mysql from "mysql2/promise";

const pool = mysql.createPool({
    host: process.env.DB_HOST || 'localhost',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'stneoc',
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

/**
 * อัพเดท last_activity ของ session
 * เรียกใช้ใน API ที่ต้องการรักษา session ให้ active
 */
export async function updateSessionActivity(sessionToken) {
    if (!sessionToken) return false;

    try {
        const connection = await pool.getConnection();

        try {
            await connection.execute(
                'UPDATE user_sessions SET last_activity = NOW() WHERE session_token = ? AND is_active = 1',
                [sessionToken]
            );
            return true;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error updating session activity:', error);
        return false;
    }
}

/**
 * ตรวจสอบและอัพเดท session จาก request
 * ใช้กับ API routes ที่ต้องการ authentication
 */
export async function validateAndUpdateSession(request) {
    try {
        // ลองดึง sessionToken จาก body, headers, หรือ cookies
        let sessionToken = null;

        // 1. จาก body (POST/PUT requests)
        const contentType = request.headers.get('content-type');
        if (contentType?.includes('application/json')) {
            try {
                const body = await request.json();
                sessionToken = body.sessionToken;
            } catch (e) {
                // ถ้า body ไม่ใช่ JSON หรืออ่านไม่ได้
            }
        }

        // 2. จาก Authorization header
        if (!sessionToken) {
            const authHeader = request.headers.get('authorization');
            if (authHeader?.startsWith('Bearer ')) {
                sessionToken = authHeader.substring(7);
            }
        }

        // 3. จาก cookies
        if (!sessionToken) {
            const cookieHeader = request.headers.get('cookie');
            if (cookieHeader) {
                const cookies = Object.fromEntries(
                    cookieHeader.split('; ').map(c => {
                        const [key, ...v] = c.split('=');
                        return [key, v.join('=')];
                    })
                );
                sessionToken = cookies.session_token;
            }
        }

        if (!sessionToken) {
            return { success: false, error: 'No session token found' };
        }

        // ตรวจสอบ session
        const connection = await pool.getConnection();

        try {
            const [sessions] = await connection.execute(
                `SELECT s.*, TIMESTAMPDIFF(MINUTE, s.last_activity, NOW()) as idle_minutes
                 FROM user_sessions s
                 WHERE s.session_token = ? 
                 AND s.expires_at > NOW() 
                 AND s.is_active = 1`,
                [sessionToken]
            );

            if (sessions.length === 0) {
                return { success: false, error: 'Session not found or expired' };
            }

            const session = sessions[0];

            // ตรวจสอบ idle timeout (10 นาที)
            if (session.idle_minutes >= 10) {
                // ปิด session
                await connection.execute(
                    'UPDATE user_sessions SET is_active = 0 WHERE session_token = ?',
                    [sessionToken]
                );

                return { success: false, error: 'Session expired due to inactivity', idleTimeout: true };
            }

            // อัพเดท last_activity
            await connection.execute(
                'UPDATE user_sessions SET last_activity = NOW() WHERE session_token = ?',
                [sessionToken]
            );

            return {
                success: true,
                session: {
                    userId: session.user_id,
                    username: session.username,
                    role: session.role
                }
            };
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error in validateAndUpdateSession:', error);
        return { success: false, error: 'Internal server error' };
    }
}

/**
 * Middleware wrapper สำหรับ protected API routes
 * ใช้แบบนี้:
 * 
 * export async function GET(request) {
 *     const auth = await withSessionUpdate(request);
 *     if (!auth.success) {
 *         return NextResponse.json({ error: auth.error }, { status: 401 });
 *     }
 *     
 *     // Your API logic here
 *     // ใช้ auth.session.userId, auth.session.username ได้
 * }
 */
export async function withSessionUpdate(request) {
    return await validateAndUpdateSession(request);
}

export default {
    updateSessionActivity,
    validateAndUpdateSession,
    withSessionUpdate
};
