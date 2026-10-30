-- เมนูหลังบ้านที่แอดมินซ่อนไว้ (ตั้งค่าระบบ › เปิด/ปิดเมนู) · 1 แถว = 1 เมนูที่ปิดอยู่ · ไม่มีแถว = เมนูเปิดตามปกติ
-- menu_key: "<ประเภทเหตุการณ์>:<รหัสเมนู>" เช่น flood:records หรือ "path:<ทางเข้า>" สำหรับเมนูทั่วไป เช่น path:/admin/trash
CREATE TABLE IF NOT EXISTS eoc_menu_hidden (
    menu_key VARCHAR(160) NOT NULL PRIMARY KEY,
    hidden_by INT NULL,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
