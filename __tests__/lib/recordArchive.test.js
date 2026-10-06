/** @jest-environment node */
jest.mock('@/lib/db', () => ({ getPool: jest.fn(), transaction: jest.fn(), query: jest.fn() }));

const {
    ArchiveError, archiveAndDelete, normalizeReason, restoreArchivedRecord, serializeRow, toMysqlValue
} = require('@/lib/recordArchive');

const user = { id: 7, username: 'admin', givenName: 'สมหญิง', familyName: 'ใจดี' };

function fakeDb(tables) {
    const calls = [];
    const execute = jest.fn(async (sql, params = []) => {
        calls.push([sql.replace(/\s+/g, ' ').trim(), params]);
        if (/^SELECT \* FROM `(\w+)` WHERE id = \? FOR UPDATE/.test(sql.trim())) {
            const table = sql.match(/`(\w+)`/)[1];
            return (tables[table] || []).filter((row) => String(row.id) === String(params[0]));
        }
        if (/^SELECT \* FROM deleted_records/.test(sql.trim())) return tables.deleted_records.filter((row) => row.id === params[0]);
        if (/^SELECT id FROM `(\w+)`/.test(sql.trim())) {
            const table = sql.match(/`(\w+)`/)[1];
            return (tables[table] || []).filter((row) => String(row.id) === String(params[0]));
        }
        if (/INFORMATION_SCHEMA\.COLUMNS/.test(sql)) return tables.columns.map((COLUMN_NAME) => ({ COLUMN_NAME, EXTRA: '' }));
        if (/^INSERT INTO deleted_records/.test(sql.trim())) return { insertId: 99 };
        return { affectedRows: 1 };
    });
    return { execute, calls };
}

describe('recordArchive', () => {
    test('requires a meaningful reason', () => {
        expect(() => normalizeReason('  ')).toThrow(ArchiveError);
        expect(() => normalizeReason('abc')).toThrow(/อย่างน้อย/);
        expect(normalizeReason('  บันทึก   ซ้ำ ')).toBe('บันทึก ซ้ำ');
    });

    test('formats dates the way MySQL accepts them', () => {
        expect(toMysqlValue(new Date(2026, 0, 5, 8, 3, 9))).toBe('2026-01-05 08:03:09');
        expect(serializeRow({ a: null, b: { x: 1 } })).toEqual({ a: null, b: '{"x":1}' });
    });

    test('archives the full row, deletes it and writes an audit entry', async () => {
        const row = { id: 3, sheltername: 'รร.บ้านควน', created_at: new Date(2026, 0, 1, 10, 0, 0) };
        const { execute, calls } = fakeDb({ shelter_centers: [row] });
        const result = await archiveAndDelete(execute, { table: 'shelter_centers', id: 3, reason: 'บันทึกซ้ำกับรายการอื่น', user });

        expect(result).toEqual({ archiveId: 99, label: 'รร.บ้านควน' });
        const archiveInsert = calls.find(([sql]) => sql.startsWith('INSERT INTO deleted_records'));
        expect(JSON.parse(archiveInsert[1][3])).toMatchObject({ id: 3, created_at: '2026-01-01 10:00:00' });
        expect(archiveInsert[1]).toEqual(expect.arrayContaining(['shelter_centers', '3', 'บันทึกซ้ำกับรายการอื่น', 7, 'สมหญิง ใจดี']));
        expect(calls.some(([sql]) => sql === 'DELETE FROM `shelter_centers` WHERE id = ?')).toBe(true);
        expect(calls.some(([sql, params]) => sql.startsWith('INSERT INTO activity_logs') && params.includes('data_delete'))).toBe(true);
    });

    test('a beforeDelete guard can stop the delete', async () => {
        const { execute, calls } = fakeDb({ shelter_centers: [{ id: 1, sheltername: 'A' }] });
        await expect(archiveAndDelete(execute, {
            table: 'shelter_centers', id: 1, reason: 'ไม่ใช้แล้วครับ', user,
            beforeDelete: async () => { throw new ArchiveError('มีประวัติ', 409); }
        })).rejects.toThrow('มีประวัติ');
        expect(calls.some(([sql]) => sql.startsWith('DELETE'))).toBe(false);
    });

    test('rejects unknown tables and missing rows', async () => {
        const { execute } = fakeDb({ shelter_centers: [] });
        await expect(archiveAndDelete(execute, { table: 'officer', id: 1, reason: 'เหตุผลยาวพอ', user })).rejects.toThrow(ArchiveError);
        await expect(archiveAndDelete(execute, { table: 'shelter_centers', id: 5, reason: 'เหตุผลยาวพอ', user })).rejects.toMatchObject({ status: 404 });
    });

    test('restores with the original id, only into columns that still exist', async () => {
        const { execute, calls } = fakeDb({
            shelter_centers: [],
            columns: ['id', 'sheltername'],
            deleted_records: [{ id: 99, table_name: 'shelter_centers', record_label: 'A', restored_at: null, record_data: JSON.stringify({ id: 3, sheltername: 'A', dropped_column: 'x' }) }]
        });
        const result = await restoreArchivedRecord(execute, { archiveId: 99, user });
        expect(result).toMatchObject({ table: 'shelter_centers', id: 3 });
        const insert = calls.find(([sql]) => sql.startsWith('INSERT INTO `shelter_centers`'));
        expect(insert[0]).toContain('(`id`, `sheltername`)');
        expect(insert[1]).toEqual([3, 'A']);
        expect(calls.some(([sql]) => sql.startsWith('UPDATE deleted_records SET restored_at'))).toBe(true);
    });

    test('refuses to restore twice or over an existing id', async () => {
        const restored = fakeDb({ deleted_records: [{ id: 1, table_name: 'shelter_centers', restored_at: new Date(), record_data: '{"id":3}' }] });
        await expect(restoreArchivedRecord(restored.execute, { archiveId: 1, user })).rejects.toMatchObject({ status: 409 });
        const clash = fakeDb({ shelter_centers: [{ id: 3 }], deleted_records: [{ id: 2, table_name: 'shelter_centers', restored_at: null, record_data: '{"id":3}' }] });
        await expect(restoreArchivedRecord(clash.execute, { archiveId: 2, user })).rejects.toMatchObject({ status: 409 });
    });
});
