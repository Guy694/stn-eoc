-- อัพเดทรหัสผ่านให้เป็น password123 สำหรับทุกบัญชี
-- Password: password123
-- Bcrypt hash: $2b$10$kZfZQVj729UeNrTSWvB9F.Te8H6A7t5JdJzcPxq12m0iT1JvfFDCi

UPDATE officer SET password_hash = '$2b$10$kZfZQVj729UeNrTSWvB9F.Te8H6A7t5JdJzcPxq12m0iT1JvfFDCi' WHERE username = 'admin';
UPDATE officer SET password_hash = '$2b$10$kZfZQVj729UeNrTSWvB9F.Te8H6A7t5JdJzcPxq12m0iT1JvfFDCi' WHERE username LIKE 'staff%';
UPDATE officer SET password_hash = '$2b$10$kZfZQVj729UeNrTSWvB9F.Te8H6A7t5JdJzcPxq12m0iT1JvfFDCi' WHERE username LIKE 'mcatt%';
UPDATE officer SET password_hash = '$2b$10$kZfZQVj729UeNrTSWvB9F.Te8H6A7t5JdJzcPxq12m0iT1JvfFDCi' WHERE username LIKE 'sat%';
UPDATE officer SET password_hash = '$2b$10$kZfZQVj729UeNrTSWvB9F.Te8H6A7t5JdJzcPxq12m0iT1JvfFDCi' WHERE username LIKE 'serht%';

-- ตรวจสอบผลลัพธ์
SELECT username, role, 
       CASE 
           WHEN password_hash = '$2b$10$kZfZQVj729UeNrTSWvB9F.Te8H6A7t5JdJzcPxq12m0iT1JvfFDCi' 
           THEN 'password123' 
           ELSE 'different' 
       END as password_status
FROM officer;
