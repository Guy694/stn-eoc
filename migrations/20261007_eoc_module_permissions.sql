-- สิทธิ์บันทึกข้อมูลรายเมนูของเหตุการณ์ (ตั้งค่าได้จากหน้า ตั้งค่าระบบ → สิทธิ์กลุ่มภารกิจ)
-- 1 แถว = กลุ่มภารกิจหนึ่งบันทึกเมนูหนึ่งได้ ในเหตุการณ์ประเภทหนึ่ง
-- team_code เป็นรหัสมาตรฐาน (เช่น sat, logistics) หรือ '*' = ทุกทีมที่ได้รับมอบหมาย
-- เมนูที่ยังไม่มีแถวในตารางนี้ใช้ค่าเริ่มต้นในโค้ด (lib/eocModulePermissions.js)
-- แอดมินและผู้บัญชาการบันทึกได้ทุกเมนูเสมอ (ไม่ได้เก็บในตารางนี้)
CREATE TABLE IF NOT EXISTS eoc_module_permissions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    eoc_type VARCHAR(40) NOT NULL,
    module_key VARCHAR(60) NOT NULL,
    team_code VARCHAR(40) NOT NULL,
    updated_by INT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_eoc_module_team (eoc_type, module_key, team_code),
    KEY idx_eoc_module (eoc_type, module_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
