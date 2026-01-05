-- สร้างตารางสำหรับระบบประชาสัมพันธ์/แบนเนอร์
CREATE TABLE IF NOT EXISTS announcements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(255) NOT NULL COMMENT 'หัวข้อประกาศ',
    description TEXT COMMENT 'รายละเอียดประกาศ',
    image_path VARCHAR(255) NOT NULL COMMENT 'path รูปภาพแบนเนอร์',
    show_popup BOOLEAN DEFAULT FALSE COMMENT 'แสดงเป็น popup หน้าแรกหรือไม่',
    priority INT DEFAULT 0 COMMENT 'ลำดับความสำคัญ (เลขมากแสดงก่อน)',
    is_active BOOLEAN DEFAULT TRUE COMMENT 'เปิดใช้งานหรือไม่',
    start_date DATETIME COMMENT 'วันที่เริ่มแสดง',
    end_date DATETIME COMMENT 'วันที่สิ้นสุดการแสดง',
    created_by INT COMMENT 'ผู้สร้าง (officer_id)',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_show_popup (show_popup, is_active),
    INDEX idx_dates (start_date, end_date),
    INDEX idx_priority (priority)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='ตารางเก็บข้อมูลแบนเนอร์ประชาสัมพันธ์';
