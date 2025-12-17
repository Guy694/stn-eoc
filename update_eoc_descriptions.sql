UPDATE eoc_status 
SET description = CASE eoc_type 
    WHEN 'flood' THEN 'ศูนย์ EOC น้ำท่วม - จัดการเหตุการณ์น้ำท่วมและอุทกภัย'
    WHEN 'drought' THEN 'ศูนย์ EOC ภัยแล้ง - จัดการเหตุการณ์ภัยแล้งและการขาดแคลนน้ำ'
    WHEN 'tsunami' THEN 'ศูนย์ EOC สึนามิ - จัดการเหตุการณ์คลื่นสึนามิ'
    WHEN 'earthquake' THEN 'ศูนย์ EOC แผ่นดินไหว - จัดการเหตุการณ์แผ่นดินไหว'
    WHEN 'disease' THEN 'ศูนย์ EOC โรคระบาด - จัดการเหตุการณ์โรคระบาดและภัยสุขภาพ'
END 
WHERE eoc_type IN ('flood', 'drought', 'tsunami', 'earthquake', 'disease');
