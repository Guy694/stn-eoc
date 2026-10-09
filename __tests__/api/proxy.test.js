/** @jest-environment node */
const { NextRequest } = require('next/server');

const mockState = { value: { enabled: false } };
const mockRoles = {};
jest.mock('@/lib/maintenance', () => ({
    getMaintenanceState: jest.fn(async () => mockState.value),
    sessionRole: jest.fn(async (token) => mockRoles[token] || null),
}));

const { proxy } = require('@/proxy');

const nextConfig = { basePath: '/stn-eoc', trailingSlash: true };

function request(path, cookie) {
    return new NextRequest(`http://localhost${path}`, {
        headers: cookie ? { cookie } : {},
        nextConfig,
    });
}

describe('proxy (page guard)', () => {
    beforeEach(() => { mockState.value = { enabled: false }; });

    test('redirects anonymous visitors of internal pages to login with next=', async () => {
        const response = await proxy(request('/stn-eoc/admin/officers/'));
        expect(response.status).toBe(307);
        const location = new URL(response.headers.get('location'));
        expect(location.pathname).toBe('/stn-eoc/login/');
        expect(location.searchParams.get('next')).toBe('/admin/officers/');
    });

    test('lets officers with a session cookie through', async () => {
        const response = await proxy(request('/stn-eoc/eoc/flood/', 'session_token=abc'));
        expect(response.headers.get('location')).toBeNull();
    });

    test('does not touch public pages', async () => {
        const response = await proxy(request('/stn-eoc/public/flood-map/'));
        expect(response.headers.get('location')).toBeNull();
        expect(response.headers.get('x-maintenance')).toBeNull();
    });
});

describe('proxy (maintenance mode)', () => {
    beforeEach(() => {
        mockState.value = { enabled: true, message: 'ปิดปรับปรุง', allow_officers: false };
        mockRoles.admintoken = 'admin';
        mockRoles.stafftoken = 'staff';
    });

    test('public pages show the maintenance page (rewrite, not redirect)', async () => {
        const response = await proxy(request('/stn-eoc/public/flood-map/'));
        expect(response.headers.get('x-maintenance')).toBe('1');
        expect(response.headers.get('x-middleware-rewrite')).toContain('/stn-eoc/maintenance/');
        expect(response.headers.get('location')).toBeNull();
    });

    test('APIs answer 503 JSON', async () => {
        const response = await proxy(request('/stn-eoc/api/public/situation'));
        expect(response.status).toBe(503);
        expect(await response.json()).toMatchObject({ success: false, maintenance: true });
    });

    test('login page and auth APIs stay open so an admin can sign in', async () => {
        expect((await proxy(request('/stn-eoc/login/'))).headers.get('x-maintenance')).toBeNull();
        expect((await proxy(request('/stn-eoc/api/auth/login'))).status).not.toBe(503);
    });

    test('admins pass, other officers are blocked unless allowed', async () => {
        expect((await proxy(request('/stn-eoc/eoc/flood/', 'session_token=admintoken'))).headers.get('x-maintenance')).toBeNull();
        expect((await proxy(request('/stn-eoc/eoc/flood/', 'session_token=stafftoken'))).headers.get('x-maintenance')).toBe('1');
        mockState.value = { ...mockState.value, allow_officers: true };
        expect((await proxy(request('/stn-eoc/eoc/flood/', 'session_token=stafftoken'))).headers.get('x-maintenance')).toBeNull();
    });
});

describe('proxy matcher', () => {
    test('home page "/" is listed on its own (a catch-all regex that matches "/" makes Next serve a blank home page with basePath)', () => {
        const { config } = require('@/proxy');
        expect(config.matcher[0]).toBe('/');
        expect(config.matcher.slice(1).every((pattern) => pattern.endsWith('.+)'))).toBe(true);
    });
});
