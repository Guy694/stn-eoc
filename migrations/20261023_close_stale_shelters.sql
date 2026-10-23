-- ซ่อมข้อมูล: ปิด EOC แล้วแต่ยังมีครั้ง (session) ที่ค้างสถานะเปิด หรือศูนย์พักพิงที่ยังเปิดใช้อยู่
-- 1) ครั้งที่ยัง active ทั้งที่สวิตช์ EOC ของประเภทนั้นปิดแล้ว → ปิด
-- 2) ศูนย์พักพิงที่เปิดใช้ในครั้งที่ปิดแล้ว → ปิด
-- รันซ้ำได้ (รอบสองไม่มีแถวให้แก้)
UPDATE eoc_sessions es
JOIN eoc_status st ON st.eoc_type = es.eoc_type AND st.is_active = 0
SET es.status = 'closed',
    es.closed_at = COALESCE(es.closed_at, st.deactivated_at, NOW()),
    es.close_reason = CONCAT(COALESCE(es.close_reason, ''), ' [ปิดอัตโนมัติ: EOC ปิดแล้วแต่สถานะค้างเปิด]')
WHERE es.status = 'active';

UPDATE shelter_session_activations ssa
JOIN eoc_sessions es ON es.id = ssa.session_id
SET ssa.is_active = 0,
    ssa.deactivated_at = COALESCE(ssa.deactivated_at, es.closed_at, NOW())
WHERE ssa.is_active = 1 AND es.status <> 'active';
