-- =============================================
-- EOC Accident Database Schema
-- 7 วันอันตราย - ช่วงเทศกาลปีใหม่/สงกรานต์
-- =============================================

-- ตาราง 1: รายงานอุบัติเหตุ
CREATE TABLE IF NOT EXISTS accident_reports (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL COMMENT 'เชื่อมกับ eoc_sessions',
  report_date DATE NOT NULL COMMENT 'วันที่เกิดเหตุ',
  report_time TIME COMMENT 'เวลาเกิดเหตุ',
  accident_type ENUM('รถยนต์', 'จักรยานยนต์', 'รถจักรยาน', 'คนเดินเท้า', 'อื่นๆ') DEFAULT 'รถยนต์',
  location_name VARCHAR(255) COMMENT 'ชื่อสถานที่/ถนน',
  lat DECIMAL(10,8) COMMENT 'ละติจูด',
  lng DECIMAL(11,8) COMMENT 'ลองจิจูด',
  district VARCHAR(100) COMMENT 'อำเภอ',
  tambon VARCHAR(100) COMMENT 'ตำบล',
  deaths INT DEFAULT 0 COMMENT 'จำนวนผู้เสียชีวิต',
  injuries INT DEFAULT 0 COMMENT 'จำนวนผู้บาดเจ็บ',
  drunk_driving TINYINT(1) DEFAULT 0 COMMENT 'เมาแล้วขับ',
  no_helmet TINYINT(1) DEFAULT 0 COMMENT 'ไม่สวมหมวกกันน็อค',
  no_seatbelt TINYINT(1) DEFAULT 0 COMMENT 'ไม่คาดเข็มขัดนิรภัย',
  speeding TINYINT(1) DEFAULT 0 COMMENT 'ขับรถเร็ว',
  notes TEXT COMMENT 'รายละเอียดเพิ่มเติม',
  reported_by INT UNSIGNED COMMENT 'ผู้รายงาน user_id',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_date (report_date),
  INDEX idx_location (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ตาราง 2: จุดบริการชั่วคราว
CREATE TABLE IF NOT EXISTS temporary_service_points (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id INT UNSIGNED NOT NULL COMMENT 'เชื่อมกับ eoc_sessions',
  name VARCHAR(255) NOT NULL COMMENT 'ชื่อจุดบริการ',
  point_type ENUM('จุดตรวจ', 'จุดบริการ', 'จุดพักรถ', 'ด่านชุมชน') DEFAULT 'จุดตรวจ',
  lat DECIMAL(10,8) COMMENT 'ละติจูด',
  lng DECIMAL(11,8) COMMENT 'ลองจิจูด',
  district VARCHAR(100) COMMENT 'อำเภอ',
  tambon VARCHAR(100) COMMENT 'ตำบล',
  address TEXT COMMENT 'ที่อยู่',
  officer_count INT DEFAULT 0 COMMENT 'จำนวนเจ้าหน้าที่',
  vehicle_count INT DEFAULT 0 COMMENT 'จำนวนรถตรวจ',
  start_date DATE COMMENT 'วันเริ่มเปิด',
  end_date DATE COMMENT 'วันสิ้นสุด',
  operating_hours VARCHAR(100) COMMENT 'เวลาเปิดบริการ เช่น 00:00-24:00',
  contact_phone VARCHAR(50) COMMENT 'เบอร์ติดต่อ',
  is_active TINYINT(1) DEFAULT 1 COMMENT 'สถานะเปิด/ปิด',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_session (session_id),
  INDEX idx_active (is_active),
  INDEX idx_location (lat, lng)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
