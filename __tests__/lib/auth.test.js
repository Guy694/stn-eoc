jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((body, init = {}) => ({
            body,
            status: init.status || 200
        }))
    }
}));

jest.mock('@/lib/db', () => ({
    query: jest.fn()
}));

const { getAuthSession, requireAuth, hashSessionToken } = require('@/lib/auth');
const { query } = require('@/lib/db');

function createRequest({ token, authHeader, path = '/stn-eoc/api/eoc/sessions' } = {}) {
    return {
        url: `http://localhost${path}`,
        cookies: {
            get: jest.fn((name) => (name === 'session_token' && token ? { value: token } : undefined))
        },
        headers: {
            get: jest.fn((name) => {
                if (name.toLowerCase() === 'authorization') return authHeader || null;
                return null;
            })
        }
    };
}

describe('auth helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('rejects requests without a session token', async () => {
        const auth = await getAuthSession(createRequest());

        expect(auth.success).toBe(false);
        expect(auth.response.status).toBe(401);
        expect(query).not.toHaveBeenCalled();
    });

    test('rejects users outside allowed roles', async () => {
        query
            .mockResolvedValueOnce([{
                session_token: 'valid-token',
                user_id: 1,
                username: 'staff1',
                role: 'staff',
                idle_minutes: 1,
                title: 'นาย',
                given_name: 'ทดสอบ',
                family_name: 'ระบบ',
                email: 'staff@example.test',
                phone: '000',
                department: 'EOC',
                position: 'Staff',
                is_approved: 1
            }])
            .mockResolvedValueOnce([]);

        const auth = await requireAuth(createRequest({ token: 'valid-token' }), ['admin']);

        expect(auth.success).toBe(false);
        expect(auth.response.status).toBe(403);
    });

    test('returns the authenticated user for an active cookie session', async () => {
        query
            .mockResolvedValueOnce([{
                session_token: 'valid-token',
                user_id: 7,
                username: 'admin1',
                role: 'admin',
                idle_minutes: 3,
                title: 'นางสาว',
                given_name: 'Admin',
                family_name: 'User',
                email: 'admin@example.test',
                phone: '111',
                department: 'EOC',
                position: 'Admin',
                is_approved: 1
            }])
            .mockResolvedValueOnce([]);

        const auth = await requireAuth(createRequest({ token: 'valid-token' }), ['admin']);

        expect(auth.success).toBe(true);
        expect(auth.user.id).toBe(7);
        expect(auth.user.role).toBe('admin');
        expect(auth.remainingMinutes).toBe(7);
        expect(query).toHaveBeenLastCalledWith(
            'UPDATE user_sessions SET last_activity = NOW() WHERE session_token = ?',
            [hashSessionToken('valid-token')]
        );
    });

    test('treats every registered EOC team role as staff-equivalent access', async () => {
        query
            .mockResolvedValueOnce([{
                session_token: 'valid-token',
                user_id: 23,
                username: 'finance1',
                role: 'FINANCE',
                idle_minutes: 1,
                title: null,
                given_name: 'Finance',
                family_name: 'Officer',
                email: 'finance@example.test',
                phone: null,
                department: 'EOC',
                position: 'Officer',
                is_approved: 1
            }])
            .mockResolvedValueOnce([]);

        const auth = await requireAuth(createRequest({ token: 'valid-token' }), ['staff']);

        expect(auth.success).toBe(true);
        expect(auth.user.role).toBe('FINANCE');
    });

    test('looks sessions up by SHA-256 hash, never by the raw token', async () => {
        query.mockResolvedValueOnce([]);

        await getAuthSession(createRequest({ token: 'raw-token-value' }));

        const [, params] = query.mock.calls[0];
        expect(params).toEqual([hashSessionToken('raw-token-value')]);
        expect(params[0]).toMatch(/^[a-f0-9]{64}$/);
        expect(params[0]).not.toBe('raw-token-value');
    });

    test('rejects sessions of officers that are not approved', async () => {
        query.mockResolvedValueOnce([{
            user_id: 5, username: 'pending1', role: 'staff', idle_minutes: 0, is_approved: 0, must_change_password: 0
        }]);

        const auth = await getAuthSession(createRequest({ token: 'valid-token' }));

        expect(auth.success).toBe(false);
        expect(auth.response.status).toBe(403);
        expect(auth.response.body.code).toBe('ACCOUNT_PENDING_APPROVAL');
    });

    test('blocks normal APIs until a temporary password is changed', async () => {
        query.mockResolvedValue([{
            user_id: 9, username: 'eoc2569_001', role: 'staff', idle_minutes: 0, is_approved: 1, must_change_password: 1
        }]);

        const blocked = await getAuthSession(createRequest({ token: 't', path: '/stn-eoc/api/eoc/sessions/' }));
        expect(blocked.success).toBe(false);
        expect(blocked.response.body.code).toBe('PASSWORD_CHANGE_REQUIRED');

        const allowed = await getAuthSession(createRequest({ token: 't', path: '/stn-eoc/api/auth/change-password' }));
        expect(allowed.success).toBe(true);
        expect(allowed.user.mustChangePassword).toBe(true);

        query.mockReset();
    });

    test('expires idle sessions using the configured idle limit', async () => {
        query.mockResolvedValueOnce([{
            user_id: 3, username: 'idle', role: 'staff', idle_minutes: 10, is_approved: 1
        }]).mockResolvedValueOnce([]);

        const auth = await getAuthSession(createRequest({ token: 'valid-token' }));

        expect(auth.success).toBe(false);
        expect(auth.response.status).toBe(401);
        expect(query).toHaveBeenLastCalledWith(
            'UPDATE user_sessions SET is_active = 0 WHERE session_token = ?',
            [hashSessionToken('valid-token')]
        );
    });
});
