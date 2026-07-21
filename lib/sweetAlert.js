import Swal from 'sweetalert2';
import { toast } from 'sonner';

/**
 * แสดง Alert แบบธรรมดา
 * @param {string} message - ข้อความที่ต้องการแสดง
 * @param {string} icon - ประเภทของ alert (success, error, warning, info)
 */
export const showAlert = (message, icon = 'info') => {
    if (icon === 'success') return toast.success(message);
    if (icon === 'error') return toast.error(message);
    if (icon === 'warning') return toast.warning(message);
    return toast(message);
};

/**
 * แสดง Success Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showSuccess = (message) => {
    return toast.success(message);
};

/**
 * แสดง Error Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showError = (message) => {
    return toast.error(message);
};

/**
 * แสดง Warning Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showWarning = (message) => {
    return toast.warning(message);
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
    const result = await Swal.fire({
        title: title,
        text: message,
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#6b7280',
        confirmButtonText: confirmText,
        cancelButtonText: cancelText,
    });

    return result.isConfirmed;
};

/**
 * แสดง Delete Confirmation Dialog
 * @param {string} message - ข้อความที่ต้องการแสดง
 * @returns {Promise<boolean>} - คืนค่า true ถ้ายืนยัน, false ถ้ายกเลิก
 */
export const showDeleteConfirm = async (message = 'คุณต้องการลบข้อมูลนี้ใช่หรือไม่?') => {
    const result = await Swal.fire({
        title: 'ยืนยันการลบ',
        text: message,
        icon: 'warning',
        showCancelButton: true,
        confirmButtonColor: '#ef4444',
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
    const result = await Swal.fire({
        title: 'ยืนยันการออกจากระบบ',
        text: 'คุณต้องการออกจากระบบใช่หรือไม่?',
        icon: 'question',
        showCancelButton: true,
        confirmButtonColor: '#3085d6',
        cancelButtonColor: '#6b7280',
        confirmButtonText: 'ออกจากระบบ',
        cancelButtonText: 'ยกเลิก',
    });

    return result.isConfirmed;
};
