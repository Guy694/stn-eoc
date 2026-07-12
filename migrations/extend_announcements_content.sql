-- เพิ่มประเภทเนื้อหา หมวดหมู่ และเอกสารแนบ โดยไม่กระทบประกาศเดิม
ALTER TABLE announcements
    ADD COLUMN IF NOT EXISTS content_type VARCHAR(30) NOT NULL DEFAULT 'news' AFTER eoc_type,
    ADD COLUMN IF NOT EXISTS category VARCHAR(100) DEFAULT NULL AFTER content_type,
    ADD COLUMN IF NOT EXISTS attachment_path VARCHAR(500) DEFAULT NULL AFTER image_path,
    ADD COLUMN IF NOT EXISTS attachment_name VARCHAR(255) DEFAULT NULL AFTER attachment_path;
