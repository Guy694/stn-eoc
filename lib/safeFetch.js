/**
 * Safe Fetch Utility
 * Utility functions สำหรับจัดการ fetch requests อย่างปลอดภัย
 */

/**
 * Fetch และ parse JSON อย่างปลอดภัย
 * @param {string} url - URL ที่ต้องการ fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function safeFetch(url, options = {}) {
    try {
        const response = await fetch(url, options);

        // ตรวจสอบว่า response มี content หรือไม่
        const contentType = response.headers.get('content-type');
        const hasContent = contentType && contentType.includes('application/json');

        // ถ้า response ไม่ ok
        if (!response.ok) {
            // พยายาม parse error message ถ้ามี
            if (hasContent) {
                try {
                    const errorData = await response.json();
                    return {
                        success: false,
                        error: errorData.error || errorData.message || `HTTP ${response.status}: ${response.statusText}`
                    };
                } catch {
                    return {
                        success: false,
                        error: `HTTP ${response.status}: ${response.statusText}`
                    };
                }
            }
            return {
                success: false,
                error: `HTTP ${response.status}: ${response.statusText}`
            };
        }

        // ถ้า response ok แต่ไม่มี content
        if (!hasContent) {
            return {
                success: true,
                data: null
            };
        }

        // Parse JSON
        try {
            const data = await response.json();
            return {
                success: true,
                data
            };
        } catch (jsonError) {
            return {
                success: false,
                error: 'ไม่สามารถอ่านข้อมูลได้'
            };
        }

    } catch (error) {
        console.error('Fetch error:', error);
        return {
            success: false,
            error: error.message || 'เกิดข้อผิดพลาดในการเชื่อมต่อ'
        };
    }
}

/**
 * Fetch JSON อย่างง่าย (คาดหวัง JSON response เสมอ)
 * @param {string} url - URL ที่ต้องการ fetch
 * @param {RequestInit} options - Fetch options
 * @returns {Promise<any>} - JSON data หรือ throw error
 */
export async function fetchJSON(url, options = {}) {
    const response = await fetch(url, options);

    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const contentType = response.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
        throw new Error('Response is not JSON');
    }

    const text = await response.text();
    if (!text) {
        throw new Error('Empty response body');
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        throw new Error('Invalid JSON response');
    }
}

/**
 * POST JSON data
 * @param {string} url - URL ที่ต้องการ POST
 * @param {any} data - Data ที่ต้องการส่ง
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function postJSON(url, data, options = {}) {
    return safeFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: JSON.stringify(data),
        ...options
    });
}

/**
 * PUT JSON data
 * @param {string} url - URL ที่ต้องการ PUT
 * @param {any} data - Data ที่ต้องการส่ง
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function putJSON(url, data, options = {}) {
    return safeFetch(url, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
            ...options.headers
        },
        body: JSON.stringify(data),
        ...options
    });
}

/**
 * DELETE request
 * @param {string} url - URL ที่ต้องการ DELETE
 * @param {RequestInit} options - Additional fetch options
 * @returns {Promise<{success: boolean, data?: any, error?: string}>}
 */
export async function deleteRequest(url, options = {}) {
    return safeFetch(url, {
        method: 'DELETE',
        ...options
    });
}
