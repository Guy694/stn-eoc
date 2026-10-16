-- เข้าสู่ระบบด้วย Provider ID (Health ID กระทรวงสาธารณสุข): เก็บการเชื่อมบัญชีของเจ้าหน้าที่
-- provider_account_id = account_id จาก Provider ID (ไม่ซ้ำกัน) · provider_cid_hmac = HMAC(SECRET_KEY, hash_cid) ไม่เก็บเลขบัตร
-- รันซ้ำได้: ตรวจ information_schema ก่อนเพิ่มคอลัมน์
SET @db_name = DATABASE();

SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'officer' AND COLUMN_NAME = 'provider_account_id');
SET @sql = IF(@exists = 0, 'ALTER TABLE officer ADD COLUMN provider_account_id VARCHAR(64) NULL, ADD COLUMN provider_cid_hmac CHAR(64) NULL, ADD COLUMN provider_id VARCHAR(40) NULL, ADD COLUMN provider_hcode VARCHAR(20) NULL, ADD COLUMN provider_org VARCHAR(255) NULL, ADD COLUMN provider_linked_at DATETIME NULL', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'officer' AND INDEX_NAME = 'uq_officer_provider_account');
SET @sql = IF(@exists = 0, 'ALTER TABLE officer ADD UNIQUE KEY uq_officer_provider_account (provider_account_id)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @exists = (SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'officer' AND INDEX_NAME = 'idx_officer_provider_cid');
SET @sql = IF(@exists = 0, 'ALTER TABLE officer ADD KEY idx_officer_provider_cid (provider_cid_hmac)', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- วิธีเข้าสู่ระบบใน session: เดิมเป็น ENUM('username_password','thaiid') → เปลี่ยนเป็นข้อความเพื่อรองรับ provider_id
SET @exists = (SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA = @db_name AND TABLE_NAME = 'user_sessions' AND COLUMN_NAME = 'login_method' AND DATA_TYPE = 'enum');
SET @sql = IF(@exists = 1, 'ALTER TABLE user_sessions MODIFY login_method VARCHAR(30) NULL DEFAULT ''username_password''', 'SELECT 1');
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;
