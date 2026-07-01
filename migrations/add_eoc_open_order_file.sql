-- =============================================
-- EOC Open Order File Migration
-- เพิ่มคอลัมน์เก็บไฟล์คำสั่งการเปิด EOC ใน eoc_sessions
-- =============================================

ALTER TABLE eoc_sessions
ADD COLUMN open_order_file_path VARCHAR(255) NULL
COMMENT 'พาธไฟล์คำสั่งการเปิด EOC'
AFTER open_reason,
ADD COLUMN open_order_file_name VARCHAR(255) NULL
COMMENT 'ชื่อไฟล์คำสั่งการเปิด EOC เดิม'
AFTER open_order_file_path;
