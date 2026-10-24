-- ยอดเข้าชมรายวันของเนื้อหาในหน้า "ประกาศและความรู้": ประกาศของศูนย์ฯ สื่อความรู้จาก riskcom และอินโฟกราฟิก — รันซ้ำได้
-- เก็บเฉพาะยอดรวมต่อชิ้นต่อวัน ไม่มี IP หรือข้อมูลผู้เข้าชม (กันปั่นยอดด้วยตัวนับในหน่วยความจำ 1 IP ต่อชิ้นต่อชั่วโมง)
CREATE TABLE IF NOT EXISTS content_views (
  kind ENUM('announcement','riskcom','infographic') NOT NULL,
  item_id VARCHAR(80) NOT NULL,
  view_date DATE NOT NULL,
  views INT UNSIGNED NOT NULL DEFAULT 0,
  title VARCHAR(200) NULL COMMENT 'ชื่อเรื่องล่าสุดที่เห็น (สื่อจาก riskcom อยู่นอกระบบ)',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (kind, item_id, view_date),
  KEY idx_content_views_date (view_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
