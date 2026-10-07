import { query } from '@/lib/db';

// ช่องสถานะ (phone/service_status/...) มาจาก migration 20261007_health_facility_status
// ตรวจก่อนเพื่อให้ระบบยังทำงานได้ถ้ายังไม่ได้รัน migration
const STATUS_COLUMNS = ['phone', 'service_status', 'flood_status', 'service_note', 'status_updated_at'];
let cached = null;
let cachedAt = 0;

export async function hasFacilityStatusColumns() {
    if (cached === true) return true;
    if (cached === false && Date.now() - cachedAt < 60 * 1000) return false;
    const rows = await query(
        `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'health_facilities'
           AND COLUMN_NAME IN (${STATUS_COLUMNS.map(() => '?').join(',')})`,
        STATUS_COLUMNS
    );
    cached = rows.length === STATUS_COLUMNS.length;
    cachedAt = Date.now();
    return cached;
}

export const FACILITY_STATUS_SELECT = 'phone, service_status, flood_status, service_note, status_updated_at';
