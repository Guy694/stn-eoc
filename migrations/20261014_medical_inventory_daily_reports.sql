-- รายงานเวชภัณฑ์ประจำวัน: ทุกวันแต่ละหน่วยบริการรายงาน "รับเข้า" และ "ใช้ไป/จ่ายออก" ของทุกรายการ
-- ระบบคำนวณยอดคงเหลือเอง (ยอดยกมา + รับเข้า − ใช้ไป) และเก็บ "นับได้จริง" ไว้ตรวจว่าตรงกับที่คำนวณหรือไม่
-- 1 แถว = 1 รายการคลัง (medical_inventory_stock) ต่อ 1 วัน — รายงานซ้ำวันเดิมคือแก้ไขแถวเดิม
CREATE TABLE IF NOT EXISTS medical_inventory_daily_reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    inventory_event_id INT NOT NULL,
    stock_id INT NOT NULL,
    report_date DATE NOT NULL,
    received_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    used_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    counted_qty DECIMAL(14,2) NULL,
    note VARCHAR(500) NULL,
    source ENUM('form','excel') NOT NULL DEFAULT 'form',
    reported_by INT NULL,
    reported_by_name VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_med_daily_stock_date (stock_id, report_date),
    KEY idx_med_daily_event_date (inventory_event_id, report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
