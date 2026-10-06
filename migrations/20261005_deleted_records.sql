-- =============================================
-- ถังขยะข้อมูล (2026-10-05)
-- เก็บสำเนาข้อมูลทั้งแถวก่อนลบ ศูนย์พักพิง / กลุ่มเปราะบาง / รายงานจากประชาชน
-- เพื่อให้ "ลบแบบกู้คืนได้" และรู้ว่าใครลบ เมื่อไร เพราะอะไร
-- ข้อมูลในตารางหลักถูกลบจริง (query อ่านข้อมูลเดิมทั้งระบบจึงไม่ต้องแก้)
-- =============================================

CREATE TABLE IF NOT EXISTS deleted_records (
    id BIGINT NOT NULL AUTO_INCREMENT,
    table_name VARCHAR(64) NOT NULL,
    record_id VARCHAR(64) NOT NULL,
    record_label VARCHAR(255) NULL,
    record_data JSON NOT NULL,
    eoc_session_id BIGINT NULL,
    delete_reason VARCHAR(500) NOT NULL,
    deleted_by INT NULL,
    deleted_by_name VARCHAR(150) NULL,
    deleted_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    restored_at DATETIME NULL,
    restored_by INT NULL,
    PRIMARY KEY (id),
    KEY idx_deleted_records_table (table_name, record_id),
    KEY idx_deleted_records_pending (restored_at, deleted_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ถังขยะ: สำเนาข้อมูลที่ถูกลบ กู้คืนได้';

-- เวลาอัปเดตยอดผู้พักพิงล่าสุด (ให้ห้องประชุมเห็นว่าตัวเลขสดแค่ไหน)
ALTER TABLE shelter_session_activations
    ADD COLUMN updated_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP AFTER deactivated_at;
