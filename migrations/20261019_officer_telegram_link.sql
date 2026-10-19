-- เชื่อม Telegram ของเจ้าหน้าที่ด้วยลิงก์บอท (ไม่ต้องกรอก Chat ID)
-- เจ้าหน้าที่กด "เชื่อม Telegram" → ได้ลิงก์ t.me/<bot>?start=<รหัสครั้งเดียว> → กด Start → ระบบผูก chat_id ให้
-- เก็บเฉพาะ SHA-256 ของรหัส อายุ 15 นาที ใช้ได้ครั้งเดียว · รันซ้ำได้
CREATE TABLE IF NOT EXISTS officer_telegram_links (
  token_hash CHAR(64) NOT NULL,
  officer_id INT NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (token_hash),
  KEY idx_officer_telegram_links_officer (officer_id),
  KEY idx_officer_telegram_links_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
