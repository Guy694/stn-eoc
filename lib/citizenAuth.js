import { cookies } from 'next/headers';

const CITIZEN_SESSION_COOKIE = 'citizen_thaiid_session';
const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours

/**
 * Create a citizen session from ThaiID data
 */
export function createCitizenSession(thaiidData) {
    const sessionData = {
        pid: thaiidData.pid,
        firstName: thaiidData.given_name,
        lastName: thaiidData.family_name,
        createdAt: Date.now(),
        expiresAt: Date.now() + (SESSION_MAX_AGE * 1000)
    };

    const cookieStore = cookies();
    cookieStore.set(CITIZEN_SESSION_COOKIE, JSON.stringify(sessionData), {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: SESSION_MAX_AGE,
        path: '/'
    });

    return sessionData;
}

/**
 * Get current citizen session
 */
export function getCitizenSession() {
    try {
        const cookieStore = cookies();
        const sessionCookie = cookieStore.get(CITIZEN_SESSION_COOKIE);

        if (!sessionCookie) {
            return null;
        }

        const session = JSON.parse(sessionCookie.value);

        // Check if session expired
        if (Date.now() > session.expiresAt) {
            clearCitizenSession();
            return null;
        }

        return session;
    } catch (error) {
        console.error('Error getting citizen session:', error);
        return null;
    }
}

/**
 * Clear citizen session
 */
export function clearCitizenSession() {
    const cookieStore = cookies();
    cookieStore.delete(CITIZEN_SESSION_COOKIE);
}

/**
 * Check if citizen is authenticated
 */
export function isCitizenAuthenticated() {
    const session = getCitizenSession();
    return session !== null;
}
