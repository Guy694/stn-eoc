-- ประเมินความพึงพอใจระบบ (ให้ดาว 1–5 + ข้อเสนอแนะไม่บังคับ) — รันซ้ำได้
-- ไม่เก็บชื่อ เบอร์โทร หรือ IP · เก็บเฉพาะคะแนน ข้อความ หน้าที่ประเมิน ประเภทอุปกรณ์ และบทบาท (ถ้าเป็นเจ้าหน้าที่ที่เข้าสู่ระบบ)
-- ลบอัตโนมัติเมื่อเกิน 2 ปี (lib/pdpaRetention.mjs)
CREATE TABLE IF NOT EXISTS satisfaction_feedback (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(1000) NULL,
  page_path VARCHAR(255) NULL,
  area ENUM('public','staff') NOT NULL DEFAULT 'public',
  role VARCHAR(30) NULL COMMENT 'บทบาทของเจ้าหน้าที่ที่เข้าสู่ระบบ (ไม่เก็บว่าเป็นใคร)',
  device VARCHAR(20) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_satisfaction_created (created_at),
  KEY idx_satisfaction_rating (rating)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
