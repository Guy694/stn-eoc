/**
 * @jest-environment node
 *
 * ลบรายการเวชภัณฑ์ที่เลือก / ลบทั้งหมด (ฐานข้อมูลและสิทธิ์เป็น mock)
 */
const mockQuery = jest.fn();
const mockExecute = jest.fn();
const mockArchive = jest.fn();

jest.mock('@/lib/db', () => ({
    query: (...args) => mockQuery(...args),
    transaction: async (fn) => fn((...args) => mockExecute(...args)),
}));
jest.mock('@/lib/auth', () => ({
    OFFICER_ROLES: ['staff'],
    requireAuth: async () => ({ success: true, user: { id: 7, username: 'staff1' } }),
}));
jest.mock('@/lib/eocModuleAccess', () => ({
    modulePermissions: async () => ({ can_edit: true }),
    requireModuleEdit: async () => ({ access: {} }),
}));
jest.mock('@/lib/eocAlertRunner', () => ({ triggerEventAlerts: jest.fn() }));
jest.mock('@/lib/recordArchive', () => {
    const actual = jest.requireActual('@/lib/recordArchive');
    return { ...actual, archiveAndDelete: (...args) => mockArchive(...args), recordChange: jest.fn() };
});

function deleteRequest(body) {
    const { NextRequest } = require('next/server');
    return new NextRequest('http://localhost/stn-eoc/api/eoc/supplies?eoc=flood', {
        method: 'DELETE',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
    });
}

describe('DELETE /api/eoc/supplies', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockQuery.mockImplementation(async (sql) => {
            if (sql.includes('FROM eoc_sessions')) return [{ id: 5, eoc_type: 'flood', session_number: 1, status: 'active' }];
            if (sql.includes('FROM medical_inventory_events')) return [{ id: 9 }];
            if (sql.includes('SELECT id FROM medical_inventory_stock')) return [{ id: 1 }, { id: 2 }, { id: 3 }];
            return [];
        });
        // เฉพาะ id 1-3 เป็นของเหตุการณ์นี้
        mockExecute.mockImplementation(async (sql, params) => (sql.includes('SELECT id FROM medical_inventory_stock') ? ([1, 2, 3].includes(params[0]) ? [{ id: params[0] }] : []) : { affectedRows: 1 }));
        mockArchive.mockImplementation(async (execute, options) => {
            if (options.beforeDelete) await options.beforeDelete({ id: options.id }, execute);
            return { archiveId: 1, label: 'x' };
        });
    });

    test('ต้องระบุเหตุผลอย่างน้อย 5 ตัวอักษร', async () => {
        const { DELETE } = require('@/app/api/eoc/supplies/route');
        const response = await DELETE(deleteRequest({ ids: [1], reason: 'ผิด' }));
        expect(response.status).toBe(400);
        expect(mockArchive).not.toHaveBeenCalled();
    });

    test('ลบเฉพาะที่เลือก ข้ามรายการที่ไม่ใช่ของเหตุการณ์นี้ และลบรายงานประจำวันด้วย', async () => {
        const { DELETE } = require('@/app/api/eoc/supplies/route');
        const response = await DELETE(deleteRequest({ ids: [1, 3, 99, 3], reason: 'นำเข้าผิดชุด' }));
        const body = await response.json();
        expect(response.status).toBe(200);
        expect(body.deleted).toBe(2);
        expect(mockArchive).toHaveBeenCalledTimes(2);
        expect(mockArchive.mock.calls[0][1]).toMatchObject({ table: 'medical_inventory_stock', id: 1, reason: 'นำเข้าผิดชุด' });
        expect(mockExecute.mock.calls.some(([sql, params]) => sql.includes('DELETE FROM medical_inventory_daily_reports') && params[0] === 3)).toBe(true);
    });

    test('ลบทั้งหมดของบัญชี', async () => {
        const { DELETE } = require('@/app/api/eoc/supplies/route');
        const response = await DELETE(deleteRequest({ all: true, reason: 'เริ่มนำเข้าใหม่ทั้งชุด' }));
        const body = await response.json();
        expect(body.deleted).toBe(3);
        expect(mockArchive).toHaveBeenCalledTimes(3);
    });

    test('ไม่ส่งรายการและไม่ใช่ลบทั้งหมด → 400', async () => {
        const { DELETE } = require('@/app/api/eoc/supplies/route');
        const response = await DELETE(deleteRequest({ ids: [], reason: 'ทดสอบเหตุผล' }));
        expect(response.status).toBe(400);
    });
});
