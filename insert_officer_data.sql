-- เพิ่มข้อมูล officer ตัวอย่าง
-- รหัสผ่านทั้งหมดคือ 'password123' (ควร hash ด้วย bcrypt ในการใช้งานจริง)

-- Admin
INSERT INTO officer (username, password_hash, full_name, email, phone, role) VALUES
('admin', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'ผู้ดูแลระบบ', 'admin@eoc.satun.go.th', '074-123456', 'admin');

-- Staff
INSERT INTO officer (username, password_hash, full_name, email, phone, role) VALUES
('staff01', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'เจ้าหน้าที่ 1', 'staff01@eoc.satun.go.th', '074-111111', 'staff'),
('staff02', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'เจ้าหน้าที่ 2', 'staff02@eoc.satun.go.th', '074-111112', 'staff');

-- MCATT (Medical Casualty Assessment and Treatment Team)
INSERT INTO officer (username, password_hash, full_name, email, phone, role) VALUES
('mcatt01', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'ทีม MCATT 1', 'mcatt01@eoc.satun.go.th', '074-222221', 'MCATT'),
('mcatt02', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'ทีม MCATT 2', 'mcatt02@eoc.satun.go.th', '074-222222', 'MCATT');

-- SAT (Search and Rescue Team)
INSERT INTO officer (username, password_hash, full_name, email, phone, role) VALUES
('sat01', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'ทีม SAT 1', 'sat01@eoc.satun.go.th', '074-333331', 'SAT'),
('sat02', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'ทีม SAT 2', 'sat02@eoc.satun.go.th', '074-333332', 'SAT');

-- SeRHT (Search and Rescue Helicopter Team)
INSERT INTO officer (username, password_hash, full_name, email, phone, role) VALUES
('serht01', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'ทีม SeRHT 1', 'serht01@eoc.satun.go.th', '074-444441', 'SeRHT'),
('serht02', '$2b$10$rT/KvGdQXEpxMXqXZHKzHumYVLKvJWBxQPJZ.HN4CQxYjf8VQ5Fzu', 'ทีม SeRHT 2', 'serht02@eoc.satun.go.th', '074-444442', 'SeRHT');
