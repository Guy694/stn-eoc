const originalEnv = { ...process.env };

const { getThaiIdScope, resolveThaiIdCallbackUrl } = require('@/lib/thaiIdConfig');

function createRequest(url = 'https://example.com/stn-eoc/api/auth/thaiid/authorize') {
    return {
        url,
        headers: {
            get: jest.fn((name) => {
                const normalized = name.toLowerCase();
                if (normalized === 'x-forwarded-proto') return 'https';
                if (normalized === 'x-forwarded-host') return 'example.com';
                return null;
            })
        }
    };
}

describe('ThaiID callback URL resolution', () => {
    beforeEach(() => {
        jest.resetModules();
        process.env = { ...originalEnv };
        delete process.env.THAIID_CALLBACK_URL;
        delete process.env.THAIID_REDIRECT_URI;
        delete process.env.CALLBACK;
        delete process.env.NEXT_PUBLIC_BASE_PATH;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('adds the default basePath when CALLBACK points to the legacy callback path', () => {
        process.env.CALLBACK = 'https://ngrok.example.com/api/auth/thaiid/callback';

        const callbackUrl = resolveThaiIdCallbackUrl(createRequest(), '/api/auth/thaiid/callback');

        expect(callbackUrl).toBe('https://ngrok.example.com/stn-eoc/api/auth/thaiid/callback');
    });

    test('keeps an already normalized callback URL unchanged', () => {
        process.env.CALLBACK = 'https://ngrok.example.com/stn-eoc/api/auth/thaiid/callback';

        const callbackUrl = resolveThaiIdCallbackUrl(createRequest(), '/api/auth/thaiid/callback');

        expect(callbackUrl).toBe('https://ngrok.example.com/stn-eoc/api/auth/thaiid/callback');
    });

    test('derives the callback from the configured base URL when only the host is provided', () => {
        process.env.NEXT_PUBLIC_API_URL = 'https://ngrok.example.com';

        const callbackUrl = resolveThaiIdCallbackUrl(createRequest(), '/api/auth/thaiid/callback');

        expect(callbackUrl).toBe('https://ngrok.example.com/stn-eoc/api/auth/thaiid/callback');
    });
});

describe('ThaiID scopes', () => {
    beforeEach(() => {
        process.env = { ...originalEnv };
        delete process.env.THAIID_SCOPE;
        delete process.env.THAIID_OFFICER_SCOPE;
        delete process.env.THAIID_CITIZEN_SCOPE;
    });

    afterAll(() => {
        process.env = originalEnv;
    });

    test('requests PID and name claims for officer authentication by default', () => {
        expect(getThaiIdScope('officer')).toBe('pid given_name family_name');
    });

    test('allows the officer scope to be overridden through the environment', () => {
        process.env.THAIID_OFFICER_SCOPE = 'pid custom_claim';
        expect(getThaiIdScope('officer')).toBe('pid custom_claim');
    });
});
