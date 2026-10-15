-- บทบาทในทีมเหลือ 2 แบบ: หัวหน้าทีม / สมาชิกทีม — แปลงค่าเก่า (รองหัวหน้าทีม, สมาชิก, เจ้าหน้าที่, ผู้ประสานงาน ฯลฯ) เป็นค่ามาตรฐาน
UPDATE eoc_team_members
SET role_in_team = CASE
    WHEN role_in_team LIKE 'รอง%' THEN 'สมาชิกทีม'
    WHEN role_in_team LIKE 'หัวหน้า%' THEN 'หัวหน้าทีม'
    ELSE 'สมาชิกทีม'
END
WHERE role_in_team IS NULL OR role_in_team NOT IN ('หัวหน้าทีม', 'สมาชิกทีม');
