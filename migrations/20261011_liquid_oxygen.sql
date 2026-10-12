-- ออกซิเจนเหลวของโรงพยาบาล: รายงานรายวันต่อหน่วยบริการในแต่ละเหตุการณ์ EOC
-- คงเหลือ + ใช้ต่อวัน ของถังหลัก (psi) และถังสำรองใหญ่/เล็ก (ถัง) → ระบบคำนวณจำนวนวันที่ใช้ได้
CREATE TABLE IF NOT EXISTS liquid_oxygen_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  health_facility_id INT NOT NULL,
  report_date DATE NOT NULL,
  tank_qty DECIMAL(12,2) NULL COMMENT 'ถังออกซิเจนเหลว คงเหลือ (psi)',
  tank_use_per_day DECIMAL(12,2) NULL COMMENT 'ถังออกซิเจนเหลว ใช้ต่อวัน (psi)',
  big_qty DECIMAL(12,2) NULL COMMENT 'ถังสำรองใหญ่ คงเหลือ (ถัง)',
  big_use_per_day DECIMAL(12,2) NULL,
  small_qty DECIMAL(12,2) NULL COMMENT 'ถังสำรองเล็ก คงเหลือ (ถัง)',
  small_use_per_day DECIMAL(12,2) NULL,
  procurement_problem TINYINT(1) NOT NULL DEFAULT 0,
  problem_note VARCHAR(500) NULL,
  reported_by INT NULL,
  reported_by_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_oxygen_day (session_id, health_facility_id, report_date),
  KEY idx_oxygen_session_date (session_id, report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
