# การปรับปรุงหน้ารายงานโรค - ให้แยกตาม EOC Session

## สรุปการเปลี่ยนแปลง

### 1. Frontend (app/admin/disease-reports/page.jsx)
- ✅ เพิ่ม state สำหรับ `sessions` และ `selectedSession`
- ✅ เพิ่ม `fetchSessions()` เพื่อดึงรายการ EOC sessions ทั้งหมด
- ✅ เพิ่ม Session Selector UI ด้านบน (แสดงเลข session, ประเภท, วันที่, สถานะ)
- ✅ แสดงข้อความเตือนเมื่อยังไม่ได้เลือก session
- ✅ แก้ไข `fetchReports()` ให้ส่ง `session_id` ไปกับ API
- ✅ แก้ไข `handleSubmit()` ให้ส่ง `session_id` ไปกับ form data

### 2. Backend (app/api/admin/disease-reports/route.js)
- ✅ แก้ไข GET: รับ `session_id` จาก query params และกรองข้อมูลตาม session
- ✅ แก้ไข POST: รับ `session_id` จาก body และบันทึกลงฐานข้อมูล
- ✅ แก้ไข PUT: รับ `session_id` จาก body และอัพเดทข้อมูล
- ✅ ปรับ summary queries ทั้งหมดให้กรองตาม `session_id`

### 3. Database Migration (add_session_id_to_disease_reports.sql)
```sql
-- เพิ่ม column session_id
ALTER TABLE disease_reports ADD COLUMN session_id INT UNSIGNED NULL;

-- เพิ่ม foreign key
ALTER TABLE disease_reports 
ADD CONSTRAINT fk_disease_reports_session 
FOREIGN KEY (session_id) REFERENCES eoc_sessions(id);

-- อัพเดท unique constraint
ALTER TABLE disease_reports
ADD UNIQUE KEY unique_report (session_id, report_date, health_facility_id, disease_name);
```

## วิธีใช้งาน

1. **รัน SQL Migration**
   ```bash
   mysql -u root -p stneoc < add_session_id_to_disease_reports.sql
   ```

2. **เปิดหน้ารายงานโรค**
   - ระบบจะแสดง Session Selector ด้านบน
   - เลือก EOC Session ที่ต้องการ
   - ระบบจะแสดงรายงานโรคของ session นั้นๆ เท่านั้น

3. **เพิ่มรายงานโรคใหม่**
   - กด "เพิ่มรายงานโรค"
   - กรอกข้อมูล (ระบบจะบันทึก session_id อัตโนมัติ)
   - รายงานจะเชื่อมโยงกับ session ที่เลือกอยู่

## ข้อดี
- ✅ รายงานโรคแยกชัดเจนตาม EOC Session
- ✅ สามารถดูย้อนหลังได้ทุก session
- ✅ ไม่จำกัดเฉพาะ eoc_type = 'disease' อีกต่อไป
- ✅ สามารถรายงานโรคได้ทุกประเภท EOC (น้ำท่วม, ภัยแล้ง, โรคระบาด, ฯลฯ)
- ✅ UI สวยงาม มีสถานะ session แสดงชัดเจน

## หมายเหตุ
- ถ้ามีข้อมูลเก่าในตาราง disease_reports อาจต้องกำหนด session_id ให้ก่อน
- ระบบจะเลือก active session อัตโนมัติเมื่อโหลดหน้าครั้งแรก
