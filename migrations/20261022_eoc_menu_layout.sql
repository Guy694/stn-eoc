-- การจัดกลุ่มและลำดับเมนูของเหตุการณ์ในเมนูข้าง (แอดมินตั้งได้ที่ ตั้งค่าระบบ › จัดกลุ่มเมนู)
-- 1 แถว = เมนูหนึ่งของเหตุการณ์ประเภทหนึ่ง · group_name ว่าง = ไม่อยู่ในกลุ่ม · ไม่มีแถว = ใช้ค่าเริ่มต้นในโค้ด
CREATE TABLE IF NOT EXISTS eoc_menu_layout (
    id INT AUTO_INCREMENT PRIMARY KEY,
    eoc_type VARCHAR(40) NOT NULL,
    module_key VARCHAR(60) NOT NULL,
    group_name VARCHAR(60) NULL,
    sort_order INT NOT NULL DEFAULT 0,
    updated_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_eoc_menu_layout (eoc_type, module_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
