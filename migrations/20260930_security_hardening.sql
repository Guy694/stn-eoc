-- =============================================
-- Security hardening (2026-09-30)
-- 1) ตารางตัวนับ rate limit ที่ใช้ร่วมกันทุก instance (lib/rateLimit.js)
-- 2) ปิด session เดิมทั้งหมด เพราะตั้งแต่เวอร์ชันนี้ user_sessions.session_token เก็บเป็น SHA-256
--    token แบบเดิม (plaintext) จะใช้ไม่ได้อีก ผู้ใช้ต้องเข้าสู่ระบบใหม่หนึ่งครั้ง
-- =============================================

CREATE TABLE IF NOT EXISTS rate_limit_hits (
    bucket_key VARCHAR(190) NOT NULL,
    window_start DATETIME NOT NULL,
    hits INT NOT NULL DEFAULT 0,
    expires_at DATETIME NOT NULL,
    PRIMARY KEY (bucket_key, window_start),
    KEY idx_rate_limit_hits_expires (expires_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
  COMMENT='ตัวนับ rate limit ของ endpoint สาธารณะ/เข้าสู่ระบบ';

UPDATE user_sessions SET is_active = 0 WHERE is_active = 1;
