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

const { getAuthSession, requireAuth } = require('@/lib/auth');
const { query } = require('@/lib/db');

function createRequest({ token, authHeader } = {}) {
    return {
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
            ['valid-token']
        );
    });
});
