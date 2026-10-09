-- ทะเบียนกลุ่มเปราะบางรายบุคคล + สถานะการเข้าช่วยเหลือในแต่ละเหตุการณ์
-- ข้อมูลอ่อนไหว (ชื่อ เบอร์ ที่อยู่ พิกัดบ้าน ความต้องการ ผู้ดูแล บันทึกหน้างาน) เก็บแบบเข้ารหัส AES-256-GCM
-- ในคอลัมน์ *_enc — ถอดรหัสได้เฉพาะในแอป (กุญแจจาก VULNERABLE_DATA_KEY หรือ SECRET_KEY) ไม่มีค่าจริงในฐานข้อมูล
-- เก็บเป็นข้อความธรรมดาเฉพาะ อำเภอ/ตำบล/หมู่บ้าน และประเภท เพื่อใช้กรองและสรุป
-- รันซ้ำได้

CREATE TABLE IF NOT EXISTS vulnerable_persons (
  id INT AUTO_INCREMENT PRIMARY KEY,
  vulnerable_type VARCHAR(30) NOT NULL COMMENT 'bedridden, disabled, pregnant, elderly, children, chronic_illness',
  district VARCHAR(100) NOT NULL,
  tambon VARCHAR(100) NOT NULL,
  village VARCHAR(100) NULL,
  name_enc TEXT NOT NULL,
  phone_enc TEXT NULL,
  address_enc TEXT NULL,
  location_enc TEXT NULL COMMENT 'พิกัดบ้าน {lat,lng} (เข้ารหัส)',
  needs_enc TEXT NULL COMMENT 'อาการ/ความต้องการพิเศษ (เข้ารหัส)',
  caregiver_enc TEXT NULL COMMENT 'ผู้ดูแล ชื่อ/เบอร์ (เข้ารหัส)',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_by INT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_vulnerable_persons_area (district, tambon, village),
  KEY idx_vulnerable_persons_type (vulnerable_type, is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- สถานะล่าสุดของแต่ละคนในเหตุการณ์ (ไม่มีแถว = รอช่วยเหลือ)
CREATE TABLE IF NOT EXISTS vulnerable_person_cases (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  person_id INT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'waiting',
  moved_to VARCHAR(255) NULL,
  note_enc TEXT NULL,
  updated_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uniq_vulnerable_case (session_id, person_id),
  KEY idx_vulnerable_case_status (session_id, status)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ประวัติการเปลี่ยนสถานะ (ใคร เมื่อไร)
CREATE TABLE IF NOT EXISTS vulnerable_case_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  session_id BIGINT NOT NULL,
  person_id INT NOT NULL,
  status VARCHAR(20) NOT NULL,
  moved_to VARCHAR(255) NULL,
  note_enc TEXT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vulnerable_case_events (session_id, person_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- บันทึกการเข้าดู/แก้ไขข้อมูลรายบุคคล (PDPA: ตรวจย้อนหลังได้ว่าใครเปิดดูข้อมูลใคร)
CREATE TABLE IF NOT EXISTS vulnerable_access_log (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  officer_id INT NULL,
  officer_role VARCHAR(30) NULL,
  action VARCHAR(30) NOT NULL,
  session_id BIGINT NULL,
  person_id INT NULL,
  result_count INT NULL,
  ip_address VARCHAR(64) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_vulnerable_access_officer (officer_id, created_at),
  KEY idx_vulnerable_access_person (person_id, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
