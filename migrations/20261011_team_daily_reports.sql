-- แบบรายงานประจำวันของทีม MCATT / หน่วยแพทย์ / MERT รายอำเภอ ในแต่ละเหตุการณ์ EOC
-- ตัวเลขเก็บใน metrics (JSON) ตามรายการช่องใน lib/teamDailyReports.js
CREATE TABLE IF NOT EXISTS eoc_team_daily_reports (
  id INT AUTO_INCREMENT PRIMARY KEY,
  session_id INT NOT NULL,
  report_type VARCHAR(20) NOT NULL COMMENT 'mcatt / medical / mert',
  report_date DATE NOT NULL,
  district_name VARCHAR(100) NOT NULL,
  metrics TEXT NOT NULL,
  area_note VARCHAR(255) NULL COMMENT 'พื้นที่ปฏิบัติงาน (MERT)',
  note VARCHAR(1000) NULL,
  reported_by INT NULL,
  reported_by_name VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_team_report_day (session_id, report_type, report_date, district_name),
  KEY idx_team_report_session (session_id, report_type, report_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
