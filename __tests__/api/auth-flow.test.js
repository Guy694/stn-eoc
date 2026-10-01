/**
 * @jest-environment node
 *
 * ทดสอบ flow เข้าสู่ระบบ/เปลี่ยนรหัสผ่านที่ระดับ route handler (ฐานข้อมูลเป็น mock)
 */
const crypto = require('crypto');

const mockExecute = jest.fn();
const mockQuery = jest.fn();

jest.mock('@/lib/db', () => ({
    query: (...args) => mockQuery(...args),
    getPool: () => ({
        getConnection: async () => ({ execute: mockExecute, release: jest.fn() }),
        execute: mockExecute,
    }),
}));
jest.mock('@/lib/telegram', () => ({ notifySecurityEvent: jest.fn() }));

const bcrypt = require('bcryptjs');
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function jsonRequest(path, body, { cookie } = {}) {
    const headers = { 'content-type': 'application/json', 'user-agent': 'jest' };
    if (cookie) headers.cookie = cookie;
    const { NextRequest } = require('next/server');
    return new NextRequest(`http://localhost/stn-eoc${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
    });
}

describe('POST /api/auth/login', () => {
    let officer;

    beforeAll(async () => {
        officer = {
            id: 42, username: 'eoc2569_001', password_hash: await bcrypt.hash('Temp-Pass-2569', 4),
            title: 'นาย', given_name: 'ทดสอบ', family_name: 'ระบบ', email: null, phone: null,
            role: 'staff', is_approved: 1, failed_login_attempts: 0, account_locked_until: null,
            must_change_password: 1,
        };
    });

    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockImplementation(async (sql) => (sql.includes('SELECT hits') ? [{ hits: 1 }] : {}));
        mockExecute.mockImplementation(async (sql) => {
            if (sql.includes('FROM login_attempts')) return [[{ count: 0 }]];
            if (sql.includes('FROM officer WHERE username')) return [[officer]];
            return [{ affectedRows: 1 }];
        });
    });

    test('stores only the hash of the session token and flags forced password change', async () => {
        const { POST } = require('@/app/api/auth/login/route');
        const response = await POST(jsonRequest('/api/auth/login', { username: 'eoc2569_001', password: 'Temp-Pass-2569' }));
        const body = await response.json();

        expect(response.status).toBe(200);
        expect(body.user.mustChangePassword).toBe(true);

        const cookieToken = response.cookies.get('session_token').value;
        expect(cookieToken).toMatch(/^[a-f0-9]{64}$/);

        const insert = mockExecute.mock.calls.find(([sql]) => sql.includes('INSERT INTO user_sessions'));
        expect(insert[1][0]).toBe(sha256(cookieToken));
        expect(insert[1][0]).not.toBe(cookieToken);
    });

    test('rejects a wrong password without creating a session', async () => {
        const { POST } = require('@/app/api/auth/login/route');
        const response = await POST(jsonRequest('/api/auth/login', { username: 'eoc2569_001', password: '1234' }));

        expect(response.status).toBe(401);
        expect(mockExecute.mock.calls.some(([sql]) => sql.includes('INSERT INTO user_sessions'))).toBe(false);
    });

    test('returns 429 when the IP exceeds the login rate limit', async () => {
        mockQuery.mockImplementation(async (sql) => (sql.includes('SELECT hits') ? [{ hits: 999 }] : {}));
        const { POST } = require('@/app/api/auth/login/route');
        const response = await POST(jsonRequest('/api/auth/login', { username: 'x', password: 'y' }));

        expect(response.status).toBe(429);
        expect(response.headers.get('retry-after')).toBeTruthy();
    });
});

describe('POST /api/auth/change-password', () => {
    const token = 'a'.repeat(64);
    let sessionRow;

    beforeEach(async () => {
        jest.clearAllMocks();
        sessionRow = {
            user_id: 42, username: 'eoc2569_001', role: 'staff', idle_minutes: 0,
            is_approved: 1, must_change_password: 1,
        };
        const currentHash = await bcrypt.hash('Temp-Pass-2569', 4);
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes('FROM user_sessions s')) return [sessionRow];
            if (sql.includes('SELECT password_hash FROM officer')) return [{ password_hash: currentHash }];
            return { affectedRows: 1 };
        });
    });

    test('rejects a weak new password', async () => {
        const { POST } = require('@/app/api/auth/change-password/route');
        const response = await POST(jsonRequest('/api/auth/change-password',
            { currentPassword: 'Temp-Pass-2569', newPassword: '123456' }, { cookie: `session_token=${token}` }));

        expect(response.status).toBe(400);
    });

    test('clears the forced-change flag and revokes other sessions', async () => {
        const { POST } = require('@/app/api/auth/change-password/route');
        const response = await POST(jsonRequest('/api/auth/change-password',
            { currentPassword: 'Temp-Pass-2569', newPassword: 'Satun-Flood-2569' }, { cookie: `session_token=${token}` }));

        expect(response.status).toBe(200);
        const update = mockQuery.mock.calls.find(([sql]) => sql.includes('UPDATE officer'));
        expect(update[0]).toContain('must_change_password = 0');
        const revoke = mockQuery.mock.calls.find(([sql]) => sql.includes('UPDATE user_sessions SET is_active = 0 WHERE user_id'));
        expect(revoke[1]).toEqual([42, sha256(token)]);
    });

    test('other APIs stay blocked while a password change is required', async () => {
        const { requireAuth } = require('@/lib/auth');
        const { NextRequest } = require('next/server');
        const request = new NextRequest('http://localhost/stn-eoc/api/eoc/sessions/', {
            headers: { cookie: `session_token=${token}` },
        });
        const auth = await requireAuth(request);

        expect(auth.success).toBe(false);
        expect(auth.response.status).toBe(403);
        expect((await auth.response.json()).code).toBe('PASSWORD_CHANGE_REQUIRED');
    });
});
