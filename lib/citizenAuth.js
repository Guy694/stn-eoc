import { cookies } from 'next/headers';
import crypto from 'crypto';

const CITIZEN_SESSION_COOKIE = 'citizen_thaiid_session';
const SESSION_MAX_AGE = 24 * 60 * 60; // 24 hours
const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: SESSION_MAX_AGE,
    path: '/'
};

function getSessionKey() {
    const secret = process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error('SECRET_KEY or NEXTAUTH_SECRET is required for citizen sessions');
    }
    return crypto.createHash('sha256').update(secret).digest();
}

function hashPID(pid) {
    const secret = process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET;
    if (!secret) {
        throw new Error('SECRET_KEY or NEXTAUTH_SECRET is required for citizen sessions');
    }
    return crypto.createHmac('sha256', secret).update(pid).digest('hex');
}

function sealSession(sessionData) {
    const iv = crypto.randomBytes(12);
    const cipher = crypto.createCipheriv('aes-256-gcm', getSessionKey(), iv);
    const encrypted = Buffer.concat([
        cipher.update(JSON.stringify(sessionData), 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return [
        iv.toString('base64url'),
        tag.toString('base64url'),
        encrypted.toString('base64url'),
    ].join('.');
}

function unsealSession(value) {
    const [ivPart, tagPart, encryptedPart] = value.split('.');
    if (!ivPart || !tagPart || !encryptedPart) {
        throw new Error('Invalid citizen session format');
    }

    const decipher = crypto.createDecipheriv(
        'aes-256-gcm',
        getSessionKey(),
        Buffer.from(ivPart, 'base64url')
    );
    decipher.setAuthTag(Buffer.from(tagPart, 'base64url'));

    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedPart, 'base64url')),
        decipher.final(),
    ]);

    return JSON.parse(decrypted.toString('utf8'));
}

/**
 * Create a citizen session from ThaiD data
 */
export function createCitizenSession(thaiidData) {
    const sessionData = {
        pidHash: hashPID(thaiidData.pid),
        firstName: thaiidData.given_name,
        lastName: thaiidData.family_name,
        createdAt: Date.now(),
        expiresAt: Date.now() + (SESSION_MAX_AGE * 1000)
    };

    return sessionData;
}

export function setCitizenSessionCookie(response, thaiidData) {
    const sessionData = createCitizenSession(thaiidData);
    response.cookies.set(CITIZEN_SESSION_COOKIE, sealSession(sessionData), COOKIE_OPTIONS);
    return sessionData;
}

export function clearCitizenSessionCookie(response) {
    response.cookies.set(CITIZEN_SESSION_COOKIE, '', {
        ...COOKIE_OPTIONS,
        maxAge: 0
    });
}

/**
 * Get current citizen session
 */
export async function getCitizenSession() {
    try {
        const cookieStore = await cookies();
        const sessionCookie = cookieStore.get(CITIZEN_SESSION_COOKIE);

        if (!sessionCookie) {
            return null;
        }

        const session = unsealSession(sessionCookie.value);

        // Check if session expired
        if (Date.now() > session.expiresAt) {
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
export async function clearCitizenSession() {
    const cookieStore = await cookies();
    cookieStore.delete(CITIZEN_SESSION_COOKIE);
}

/**
 * Check if citizen is authenticated
 */
export async function isCitizenAuthenticated() {
    const session = await getCitizenSession();
    return session !== null;
}
