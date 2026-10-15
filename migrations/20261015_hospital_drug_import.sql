-- นำเข้าข้อมูลจากระบบคลังยาของโรงพยาบาล (ไฟล์ DRUGLIST / INVENTORY / RECEIPT / DISTRIBUTION)
-- ใช้ตั้งยอดคงคลัง เก็บล็อตและวันหมดอายุ และอัตราใช้ปกติรายเดือนของยาที่ EOC ติดตาม

-- รหัสโรงพยาบาลในไฟล์ (HOSP_CODE) → หน่วยบริการในระบบ (จำไว้ใช้ครั้งต่อไป)
CREATE TABLE IF NOT EXISTS hospital_drug_sources (
    hosp_code VARCHAR(20) NOT NULL PRIMARY KEY,
    health_facility_id INT NOT NULL,
    updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ยาคงคลังรายล็อต ณ วันที่ในไฟล์ (นำเข้าใหม่ = แทนที่ล็อตเดิมของรายการนั้น)
CREATE TABLE IF NOT EXISTS medical_inventory_lots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    stock_id INT NOT NULL,
    lot_no VARCHAR(60) NULL,
    expire_date DATE NULL,
    qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    value DECIMAL(14,2) NULL,
    onhand_date DATE NULL,
    source_file VARCHAR(255) NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_med_lots_stock FOREIGN KEY (stock_id) REFERENCES medical_inventory_stock(id) ON DELETE CASCADE,
    KEY idx_med_lots_stock (stock_id),
    KEY idx_med_lots_expire (expire_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ยอดรับ/จ่ายรายเดือนจากระบบของโรงพยาบาล (ก่อนเกิดภัย) ใช้เป็นอัตราใช้ปกติเมื่อยังรายงานรายวันไม่พอ
CREATE TABLE IF NOT EXISTS medical_inventory_usage_baseline (
    stock_id INT NOT NULL,
    period CHAR(6) NOT NULL COMMENT 'YYYYMM',
    used_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    received_qty DECIMAL(14,2) NOT NULL DEFAULT 0,
    days_in_period TINYINT NOT NULL DEFAULT 30,
    source_file VARCHAR(255) NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (stock_id, period),
    CONSTRAINT fk_med_baseline_stock FOREIGN KEY (stock_id) REFERENCES medical_inventory_stock(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- รายงานประจำวันที่มาจากการนำเข้าไฟล์คลังยาของโรงพยาบาล
ALTER TABLE medical_inventory_daily_reports
    MODIFY COLUMN source ENUM('form','excel','hospital') NOT NULL DEFAULT 'form';
