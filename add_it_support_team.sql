-- ========================================
-- เพิ่มทีม IT Support ลงในระบบ EOC
-- ========================================

-- เพิ่มทีม IT Support ลงในตาราง eoc_teams
INSERT INTO eoc_teams (team_code, team_name_th, team_name_en, description, icon, color, sort_order) 
VALUES (
    'ITSUPPORT', 
    'ทีมสนับสนุนด้านเทคโนโลยี', 
    'IT Support Team', 
    'รับผิดชอบด้านเทคโนโลยีสารสนเทศ ระบบคอมพิวเตอร์ และการสนับสนุนด้านเทคนิค', 
    '💻', 
    'indigo', 
    8
);

SELECT '✅ เพิ่มทีม IT Support สำเร็จ' AS status;

-- ตรวจสอบทีมทั้งหมดในระบบ
SELECT 
    id,
    team_code,
    team_name_th,
    team_name_en,
    icon,
    color,
    sort_order,
    is_active
FROM eoc_teams
ORDER BY sort_order;
