const originalEnv = { ...process.env };

const { resolveThaiIdCallbackUrl } = require('@/lib/thaiIdConfig');

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