const { getClientIp } = require('@/lib/clientIp');

function requestWith(headers) {
    return { headers: { get: (name) => headers[name.toLowerCase()] ?? null } };
}

describe('getClientIp', () => {
    test('ignores X-Forwarded-For when no proxy is trusted (header can be spoofed)', () => {
        const request = requestWith({ 'x-forwarded-for': '1.2.3.4', 'x-real-ip': '10.0.0.5' });
        expect(getClientIp(request, {})).toBe('10.0.0.5');
    });

    test('uses the right-most hop appended by a single trusted proxy', () => {
        const request = requestWith({ 'x-forwarded-for': '6.6.6.6, 203.0.113.9' });
        expect(getClientIp(request, { TRUST_PROXY: '1' })).toBe('203.0.113.9');
    });

    test('supports two trusted proxy hops', () => {
        const request = requestWith({ 'x-forwarded-for': 'spoofed, 203.0.113.10, 10.0.0.1' });
        expect(getClientIp(request, { TRUST_PROXY: '2' })).toBe('203.0.113.10');
    });

    test('returns unknown when nothing is available', () => {
        expect(getClientIp(requestWith({}), {})).toBe('unknown');
    });
});
