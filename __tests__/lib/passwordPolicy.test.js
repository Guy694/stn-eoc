const { validatePassword, PASSWORD_MIN_LENGTH } = require('@/lib/passwordPolicy');

describe('password policy', () => {
    test.each([
        ['1234', 'สั้นเกินไป'],
        ['abcdefghij', 'ไม่มีตัวเลข'],
        ['1234567890', 'ไม่มีตัวอักษร'],
        ['password123', 'อยู่ในรายการรหัสผ่านยอดนิยม'],
    ])('rejects %s (%s)', (password) => {
        expect(validatePassword(password)).not.toBeNull();
    });

    test('accepts a reasonable password', () => {
        expect(validatePassword('Satun-Flood-2569')).toBeNull();
    });

    test('rejects passwords containing the username', () => {
        expect(validatePassword('eoc2569_001x9', { username: 'eoc2569_001' })).toMatch('ชื่อผู้ใช้');
    });

    test('rejects reusing the current password', () => {
        expect(validatePassword('Abcdef12345', { currentPassword: 'Abcdef12345' })).toMatch('ซ้ำ');
    });

    test('minimum length is at least 10', () => {
        expect(PASSWORD_MIN_LENGTH).toBeGreaterThanOrEqual(10);
    });
});
