-- เปลี่ยนชื่อกลุ่มภารกิจอนามัยสิ่งแวดล้อมจาก SeRHT เป็น SEhRT ให้ตรงกับชื่อทางการ
-- officer.role / requested_role / user_sessions.role เป็น VARCHAR แล้ว (20261016_officer_role_text) จึงอัปเดตค่าได้ตรงๆ
-- ใช้ BINARY เทียบตัวพิมพ์ตรงตัว · รันซ้ำได้ (รอบสองไม่มีแถวให้แก้)
UPDATE officer SET role = 'SEhRT' WHERE BINARY role = 'SeRHT';
UPDATE officer SET requested_role = 'SEhRT' WHERE BINARY requested_role = 'SeRHT';
UPDATE user_sessions SET role = 'SEhRT' WHERE BINARY role = 'SeRHT';
UPDATE eoc_teams SET team_code = 'SEhRT' WHERE BINARY team_code = 'SeRHT';
UPDATE eoc_type_modules
   SET required_teams = REPLACE(required_teams, '"SeRHT"', '"SEhRT"')
 WHERE required_teams LIKE BINARY '%"SeRHT"%';
