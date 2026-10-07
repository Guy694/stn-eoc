// ตัวช่วยฐานข้อมูลของระบบเผยแพร่รายงานจากประชาชน (ใช้ฝั่งเซิร์ฟเวอร์)

export async function hasPublishingColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'public_incident_reports'
           AND COLUMN_NAME = 'publish_status'`
    );
    return columns.length > 0;
}

// จุดที่เลยเวลาหมดอายุ → เปลี่ยนสถานะเป็น "หมดอายุ" (หน้าสาธารณะกรองด้วยเวลาอยู่แล้ว อันนี้เพื่อให้เจ้าหน้าที่เห็นตรงกัน)
export async function expireOverduePublications(connection) {
    await connection.execute(
        `UPDATE public_incident_reports
         SET publish_status = 'expired'
         WHERE publish_status = 'published' AND expires_at IS NOT NULL AND expires_at <= NOW()`
    );
}

// ช่องแนวโน้มน้ำ (water_trend) มาจาก migration 20261007_incident_water_report — ก่อน migrate ให้บันทึกได้โดยไม่มีช่องนี้
export async function hasWaterTrendColumn(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'public_incident_reports'
           AND COLUMN_NAME = 'water_trend'`
    );
    return columns.length > 0;
}

// ช่องยืนยันจากประชาชน (ยังท่วม/แจ้งผิด) มาจาก migration 20261007_incident_confirmations
export async function hasConfirmationColumns(connection) {
    const [columns] = await connection.execute(
        `SELECT COLUMN_NAME
         FROM INFORMATION_SCHEMA.COLUMNS
         WHERE TABLE_SCHEMA = DATABASE()
           AND TABLE_NAME = 'public_incident_reports'
           AND COLUMN_NAME IN ('still_reports', 'wrong_reports')`
    );
    return columns.length === 2;
}
