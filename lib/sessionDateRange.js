// ตรวจว่า "วันที่รายงาน" อยู่ในช่วงเปิด–ปิดของเหตุการณ์ EOC
// ใช้ร่วมกันทุก API ที่บันทึกข้อมูลรายวัน เพื่อไม่ให้ตัวเลขในห้องประชุมปนข้อมูลนอกช่วงเหตุการณ์

export function toDateKey(value) {
    if (!value) return '';
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}/.test(value)) return value.slice(0, 10);
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function thaiDate(dateKey) {
    const [y, m, d] = dateKey.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** ตรวจวันที่กับเหตุการณ์ (ไม่แตะฐานข้อมูล) — เหตุการณ์ที่ยังเปิดอยู่ใช้ "วันนี้" เป็นวันสุดท้าย */
export function checkDateInSession(session, date, today = new Date()) {
    const dateKey = toDateKey(date);
    if (!dateKey) return { ok: false, status: 400, error: 'วันที่ไม่ถูกต้อง' };
    const openedKey = toDateKey(session?.opened_at);
    const closedKey = toDateKey(session?.closed_at) || toDateKey(today);
    if (openedKey && dateKey < openedKey) {
        return { ok: false, status: 400, error: `วันที่ต้องไม่ก่อนวันเปิด EOC (${thaiDate(openedKey)})` };
    }
    if (closedKey && dateKey > closedKey) {
        const reason = session?.closed_at ? `วันปิด EOC (${thaiDate(closedKey)})` : 'วันนี้';
        return { ok: false, status: 400, error: `วันที่ต้องไม่เกิน${reason}` };
    }
    return { ok: true, dateKey };
}

/**
 * อ่านเหตุการณ์จากฐานข้อมูลแล้วตรวจทุกวันที่
 * execute: (sql, params) => Promise<[rows]> เช่น connection.execute หรือ pool.query
 */
export async function validateSessionDates(execute, sessionId, dates, { eocType, label = 'EOC' } = {}) {
    if (!sessionId) return { ok: false, status: 400, error: 'กรุณาระบุเหตุการณ์ EOC' };
    const [sessions] = await execute(
        `SELECT id, eoc_type, opened_at, closed_at, status FROM eoc_sessions WHERE id = ?${eocType ? ' AND eoc_type = ?' : ''} LIMIT 1`,
        eocType ? [sessionId, eocType] : [sessionId]
    );
    if (!sessions.length) return { ok: false, status: 404, error: `ไม่พบเหตุการณ์ ${label}` };
    for (const date of dates) {
        const result = checkDateInSession(sessions[0], date);
        if (!result.ok) return result;
    }
    return { ok: true, session: sessions[0] };
}
