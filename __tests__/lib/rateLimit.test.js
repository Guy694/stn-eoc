jest.mock('next/server', () => ({
    NextResponse: {
        json: jest.fn((body, init = {}) => ({ body, status: init.status || 200, headers: init.headers || {} }))
    }
}));

jest.mock('@/lib/db', () => ({ query: jest.fn() }));

const { consumeRateLimit, resetInMemoryRateLimits, tooManyRequestsResponse } = require('@/lib/rateLimit');
const { query } = require('@/lib/db');

describe('rate limit', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetInMemoryRateLimits();
    });

    test('memory store blocks after the limit and reports retry time', async () => {
        const options = { limit: 2, windowSeconds: 60, store: 'memory', now: 1_000_000 };
        expect((await consumeRateLimit('t', 'ip1', options)).allowed).toBe(true);
        expect((await consumeRateLimit('t', 'ip1', options)).allowed).toBe(true);
        const third = await consumeRateLimit('t', 'ip1', options);
        expect(third.allowed).toBe(false);
        expect(third.retryAfterSeconds).toBeGreaterThan(0);
        expect((await consumeRateLimit('t', 'ip2', options)).allowed).toBe(true);
    });

    test('memory window resets after it expires', async () => {
        const base = { limit: 1, windowSeconds: 60, store: 'memory' };
        await consumeRateLimit('t', 'ip', { ...base, now: 0 });
        expect((await consumeRateLimit('t', 'ip', { ...base, now: 1000 })).allowed).toBe(false);
        expect((await consumeRateLimit('t', 'ip', { ...base, now: 61_000 })).allowed).toBe(true);
    });

    test('uses the shared database counter when available', async () => {
        query.mockResolvedValueOnce({}).mockResolvedValueOnce([{ hits: 6 }]);
        const result = await consumeRateLimit('publicReport', '203.0.113.1', { now: 0 });
        expect(query.mock.calls[0][0]).toContain('INSERT INTO rate_limit_hits');
        expect(result.allowed).toBe(false);
    });

    test('falls back to memory when the table does not exist yet', async () => {
        const error = Object.assign(new Error('no table'), { code: 'ER_NO_SUCH_TABLE' });
        query.mockRejectedValue(error);
        const result = await consumeRateLimit('publicReport', '203.0.113.2', { now: 0 });
        expect(result.allowed).toBe(true);
    });

    test('429 response carries Retry-After', () => {
        const response = tooManyRequestsResponse({ retryAfterSeconds: 42 });
        expect(response.status).toBe(429);
        expect(response.headers['Retry-After']).toBe('42');
    });
});
