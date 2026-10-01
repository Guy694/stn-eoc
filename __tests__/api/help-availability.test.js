/** @jest-environment node */
jest.mock('@/lib/db', () => ({ query: jest.fn(), getConnection: jest.fn() }));
jest.mock('@/lib/rateLimit', () => ({ enforceIpRateLimit: jest.fn().mockResolvedValue(null) }));

const { query, getConnection } = require('@/lib/db');
const { GET } = require('@/app/api/public/help-availability/route');
const { POST } = require('@/app/api/public/report-incident/route');

function helpForm(extra = {}) {
    const form = new FormData();
    const fields = {
        firstName: 'สมชาย', lastName: 'ใจดี', phone: '0812345678',
        latitude: '6.62', longitude: '100.07', reportType: 'help_request',
        helpCategory: 'medicine', helpReason: 'ต้องการยา', ...extra
    };
    Object.entries(fields).forEach(([key, value]) => form.append(key, value));
    return new Request('http://localhost/stn-eoc/api/public/report-incident', { method: 'POST', body: form });
}

describe('help request availability', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(console, 'error').mockImplementation(() => {});
    });

    test('availability API reports closed when no EOC session is active', async () => {
        query.mockResolvedValue([]);
        const json = await (await GET()).json();
        expect(json).toMatchObject({ success: true, open: false, count: 0 });
    });

    test('availability API reports open when an EOC session is active', async () => {
        query.mockResolvedValue([{ id: 1, eoc_type: 'disease' }]);
        const json = await (await GET()).json();
        expect(json).toMatchObject({ success: true, open: true, count: 1 });
    });

    test('help requests are rejected (403) while no EOC is open, before touching the database', async () => {
        query.mockResolvedValue([]);
        const response = await POST(helpForm());
        expect(response.status).toBe(403);
        expect((await response.json()).code).toBe('EOC_NOT_OPEN');
        expect(getConnection).not.toHaveBeenCalled();
    });

    test('help requests pass the EOC check when a session is active', async () => {
        query.mockResolvedValue([{ id: 1 }]);
        getConnection.mockResolvedValue({ execute: jest.fn().mockResolvedValue([{ insertId: 7 }]) });
        const response = await POST(helpForm());
        expect(response.status).not.toBe(403);
    });
});
