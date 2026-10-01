/** @jest-environment node */
const { NextRequest } = require('next/server');
const { proxy } = require('@/proxy');

const nextConfig = { basePath: '/stn-eoc', trailingSlash: true };

function request(path, cookie) {
    return new NextRequest(`http://localhost${path}`, {
        headers: cookie ? { cookie } : {},
        nextConfig,
    });
}

describe('proxy (page guard)', () => {
    test('redirects anonymous visitors of internal pages to login with next=', () => {
        const response = proxy(request('/stn-eoc/admin/officers/'));
        expect(response.status).toBe(307);
        const location = new URL(response.headers.get('location'));
        expect(location.pathname).toBe('/stn-eoc/login/');
        expect(location.searchParams.get('next')).toBe('/admin/officers/');
    });

    test('lets officers with a session cookie through', () => {
        const response = proxy(request('/stn-eoc/eoc/flood/', 'session_token=abc'));
        expect(response.headers.get('location')).toBeNull();
    });

    test('does not touch public pages', () => {
        const response = proxy(request('/stn-eoc/public/flood-map/'));
        expect(response.headers.get('location')).toBeNull();
    });
});
