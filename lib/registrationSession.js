import crypto from 'crypto';

export const REGISTRATION_SESSION_COOKIE = 'user_session';
const MAX_AGE_SECONDS = 24 * 60 * 60;
const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: MAX_AGE_SECONDS,
  path: '/'
};

function getKey() {
  const secret = process.env.SECRET_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret || secret === 'your_strong_secret_key_here') {
    throw new Error('A strong SECRET_KEY or NEXTAUTH_SECRET is required');
  }
  return crypto.createHash('sha256').update(`registration:${secret}`).digest();
}

export function sealRegistrationSession(data) {
  const payload = { ...data, issuedAt: Date.now(), expiresAt: Date.now() + MAX_AGE_SECONDS * 1000 };
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(payload), 'utf8'), cipher.final()]);
  return [iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function unsealRegistrationSession(value) {
  const [iv, tag, encrypted] = String(value || '').split('.');
  if (!iv || !tag || !encrypted) throw new Error('Invalid registration session');
  const decipher = crypto.createDecipheriv('aes-256-gcm', getKey(), Buffer.from(iv, 'base64url'));
  decipher.setAuthTag(Buffer.from(tag, 'base64url'));
  const payload = JSON.parse(Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64url')),
    decipher.final()
  ]).toString('utf8'));
  if (!payload.expiresAt || Date.now() > payload.expiresAt) throw new Error('Registration session expired');
  return payload;
}

export function setRegistrationSessionCookie(response, data) {
  response.cookies.set(REGISTRATION_SESSION_COOKIE, sealRegistrationSession(data), COOKIE_OPTIONS);
}

export function clearRegistrationSessionCookie(response) {
  response.cookies.set(REGISTRATION_SESSION_COOKIE, '', { ...COOKIE_OPTIONS, maxAge: 0 });
}
