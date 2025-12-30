import Swal from 'sweetalert2';

/**
 * แสดง Alert แบบธรรมดา
 * @param {string} message - ข้อความที่ต้องการแสดง
 * @param {string} icon - ประเภทของ alert (success, error, warning, info)
 */
export const showAlert = (message, icon = 'info') => {
    return Swal.fire({
        text: message,
        icon: icon,
        confirmButtonText: 'ตรงลง',
        confirmButtonColor: '#3085d6',
    });
};

/**
 * แสดง Success Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showSuccess = (message) => {
    return Swal.fire({
        text: message,
        icon: 'success',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#10b981',
    });
};

/**
 * แสดง Error Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showError = (message) => {
    return Swal.fire({
        text: message,
        icon: 'error',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#ef4444',
    });
};

/**
 * แสดง Warning Alert
 * @param {string} message - ข้อความที่ต้องการแสดง
 */
export const showWarning = (message) => {
    return Swal.fire({
        text: message,
        icon: 'warning',
        confirmButtonText: 'ตกลง',
        confirmButtonColor: '#f59e0b',
    });
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
