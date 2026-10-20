import Swal from 'sweetalert2';
import { notify } from '@/lib/notify';
import { hasConfirmHost, requestConfirm } from '@/lib/confirmDialog';

/**
 * แสดง Alert แบบธรรมดา
 * @param {string} message - ข้อความที่ต้องการแสดง
 * @param {string} icon - ประเภทของ alert (success, error, warning, info)
 */
export const showAlert = (message, icon = 'info') => {
    if (icon === 'success') return notify.success(message);
    if (icon === 'error') return notify.error(message);
    if (icon === 'warning') return notify.warning(message);
    return notify.info(message);
};

/**
 * แสดง Success Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showSuccess = (message) => {
    return notify.success(message);
};

/**
 * แสดง Error Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showError = (message) => {
    return notify.error(message);
};

/**
 * แสดง Warning Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showWarning = (message) => {
    return notify.warning(message);
};

/**
 * แสดง Confirmation Dialog
 * @param {string} title - หัวข้อ
 * @param {string} message - ข้อความที่ต้องการแสดง
 * @param {string} confirmText - ข้อความปุ่มยืนยัน
 * @param {string} cancelText - ข้อความปุ่มยกเลิก
 * @returns {Promise<boolean>} - คืนค่า true ถ้ายืนยัน, false ถ้ายกเลิก
 */
export const showConfirm = async (title, message, confirmText = 'ยืนยัน', cancelText = 'ยกเลิก') => {
    if (hasConfirmHost()) return requestConfirm({ title, message, confirmText, cancelText, tone: 'primary' });
    const result = await Swal.fire({
        title: title,
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0b4c86',
        cancelButtonColor: '#6b7280',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
    });

    return result.isConfirmed;
};

/**
 * แสดง Delete Confirmation Dialog — ใช้หน้าต่างยืนยันกลางของระบบ (ConfirmHost) ถ้ามี
 * @param {string} message - ข้อความที่ต้องการแสดง
 * @returns {Promise<boolean>} - คืนค่า true ถ้ายืนยัน, false ถ้ายกเลิก
 */
export const showDeleteConfirm = async (message = 'คุณต้องการลบข้อมูลนี้ใช่หรือไม่?') => {
    if (hasConfirmHost()) return requestConfirm({ title: 'ยืนยันการลบ', message, confirmText: 'ลบ', tone: 'danger' });
    const result = await Swal.fire({
        title: 'ยืนยันการลบ',
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#b91c1c',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ลบ',
        cancelButtonText: 'ยกเลิก',
    });

    return result.isConfirmed;
};

/**
 * แสดง Logout Confirmation Dialog
 * @returns {Promise<boolean>} - คืนค่า true ถ้ายืนยัน, false ถ้ายกเลิก
 */
export const showLogoutConfirm = async () => {
    if (hasConfirmHost()) return requestConfirm({ title: 'ออกจากระบบ', message: 'ต้องการออกจากระบบใช่หรือไม่', confirmText: 'ออกจากระบบ', tone: 'primary' });
    const result = await Swal.fire({
        title: 'ยืนยันการออกจากระบบ',
        text: 'คุณต้องการออกจากระบบใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#0b4c86',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก',
    });

    return result.isConfirmed;
};
