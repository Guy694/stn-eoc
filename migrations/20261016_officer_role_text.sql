-- role / requested_role เดิมเป็น ENUM (บางเครื่องยังเป็นชุดเก่า 6 ค่า เพราะ expand-eoc-team-system-roles ถูก baseline ไว้โดยไม่ได้รันจริง)
-- ทำให้บันทึกสิทธิ์กลุ่มภารกิจใหม่ (เช่น LOGISTICS) ไม่ได้ → เปลี่ยนเป็นข้อความ ค่าที่ใช้ได้ตรวจในโค้ด (lib/eocRoles.js) แทน
-- รันซ้ำได้: MODIFY เป็นชนิดเดิมไม่กระทบข้อมูล
ALTER TABLE officer
    MODIFY role VARCHAR(50) NOT NULL DEFAULT 'staff',
    MODIFY requested_role VARCHAR(50) NULL DEFAULT 'staff';

ALTER TABLE user_sessions
    MODIFY role VARCHAR(50) NOT NULL DEFAULT 'staff';
