-- แจ้งเตือนระดับน้ำสถานี ปภ. แยกครบ 5 ระดับ: เพิ่มสถานะ warning (เตือนภัย) / danger (อันตราย) / critical (วิกฤต)
-- ค่าเดิม near/overflow ยังอยู่ในชนิดข้อมูล (ระบบอ่าน near = เฝ้าระวัง, overflow = อันตราย) ใช้ซ้ำได้
ALTER TABLE water_station_alert_state
    MODIFY state ENUM('normal','near','overflow','watch','severe','warning','danger','critical') NOT NULL DEFAULT 'normal';

ALTER TABLE water_alert_log
    MODIFY state ENUM('normal','near','overflow','watch','severe','warning','danger','critical') NOT NULL,
    MODIFY previous_state ENUM('normal','near','overflow','watch','severe','warning','danger','critical') NOT NULL;
