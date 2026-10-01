// นโยบายรหัสผ่านที่ใช้ร่วมกันทั้งฝั่ง server และหน้าเว็บ

export const PASSWORD_MIN_LENGTH = 10;
export const PASSWORD_MAX_LENGTH = 128;

const COMMON_PASSWORDS = new Set([
    '1234', '12345', '123456', '1234567', '12345678', '123456789', '1234567890',
    'password', 'password1', 'password123', 'qwerty', 'qwerty123', 'admin', 'admin123',
    'admin1234', 'welcome', 'welcome1', 'letmein', 'iloveyou', '11111111', '00000000',
    'abc12345', 'satun', 'satun123', 'satun1234', 'eoc', 'eoc12345', 'eocsatun', 'stneoc',
]);

export const PASSWORD_POLICY_TEXT =
    `รหัสผ่านต้องยาว ${PASSWORD_MIN_LENGTH}–${PASSWORD_MAX_LENGTH} ตัวอักษร มีทั้งตัวอักษรและตัวเลข และต้องไม่ใช่รหัสผ่านที่เดาง่ายหรือซ้ำกับชื่อผู้ใช้`;

/**
 * @returns {string|null} ข้อความภาษาไทยเมื่อไม่ผ่าน หรือ null เมื่อผ่าน
 */
export function validatePassword(password, { username, currentPassword } = {}) {
    if (typeof password !== 'string' || password.length === 0) {
        return 'กรุณากรอกรหัสผ่าน';
    }
    if (password.length < PASSWORD_MIN_LENGTH) {
        return `รหัสผ่านต้องมีอย่างน้อย ${PASSWORD_MIN_LENGTH} ตัวอักษร`;
    }
    if (password.length > PASSWORD_MAX_LENGTH) {
        return `รหัสผ่านต้องไม่เกิน ${PASSWORD_MAX_LENGTH} ตัวอักษร`;
    }
    if (!/[A-Za-z฀-๿]/.test(password) || !/\d/.test(password)) {
        return 'รหัสผ่านต้องมีทั้งตัวอักษรและตัวเลข';
    }
    const lowered = password.toLowerCase();
    if (COMMON_PASSWORDS.has(lowered) || /^(.)\1+$/.test(password)) {
        return 'รหัสผ่านนี้เดาง่ายเกินไป กรุณาตั้งรหัสผ่านใหม่';
    }
    if (username && lowered.includes(String(username).toLowerCase())) {
        return 'รหัสผ่านต้องไม่มีชื่อผู้ใช้อยู่ในนั้น';
    }
    if (currentPassword && password === currentPassword) {
        return 'รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านเดิม';
    }
    return null;
}
