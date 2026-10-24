-- นับผู้รับแจ้งเตือนภัย: เครื่องที่แจ้งเตือนขึ้นจริง (shown) และกดเปิดอ่าน (opened) ต่อรายการส่ง — รันซ้ำได้
-- เก็บเฉพาะรหัสรายการส่ง + ค่า hash ของปลายทางเครื่อง (ค่าเดียวกับ push_subscriptions.endpoint_hash) ไม่เก็บ IP ชื่อ หรือตำแหน่ง
-- หนึ่งเครื่องนับได้ครั้งเดียวต่อรายการต่อเหตุการณ์ · ลบอัตโนมัติเมื่อเกิน 1 ปี (lib/pdpaRetention.mjs)
CREATE TABLE IF NOT EXISTS push_receipts (
  log_id INT NOT NULL,
  event ENUM('shown','opened') NOT NULL,
  sub_hash CHAR(64) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (log_id, event, sub_hash),
  KEY idx_push_receipts_created (created_at),
  KEY idx_push_receipts_sub (sub_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- รายการส่งที่แนบรหัสไปกับแจ้งเตือนแล้ว (นับได้) · รายการเก่าก่อน migration นี้ = 0 (นับย้อนหลังไม่ได้)
SET @sql = (
    SELECT IF(COUNT(*) = 0,
        'ALTER TABLE public_push_log ADD COLUMN receipt_tracked TINYINT(1) NOT NULL DEFAULT 0 AFTER removed',
        'SELECT 1')
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'public_push_log' AND COLUMN_NAME = 'receipt_tracked'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;
