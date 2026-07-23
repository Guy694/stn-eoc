# Prompt: ปรับโครงสร้างระบบเจ้าหน้าที่ EOC และรายงานอุทกภัยให้เป็นระบบเดียว

คุณคือ Senior Full-stack Developer, Software Architect และ Security Engineer ผู้เชี่ยวชาญระบบ Emergency Operations Center (EOC) จงวิเคราะห์และปรับปรุงระบบ Satun Geo-EOC โดยยึดโค้ดและฐานข้อมูลจริงเป็นหลัก เป้าหมายคือทำให้ระบบเจ้าหน้าที่ การมอบหมายกลุ่มภารกิจ รายงานย้อนหลัง และ Dashboard อุทกภัยรายวันทำงานสอดคล้องกัน ไม่สร้างหน้า API ตาราง หรือ workflow ซ้ำโดยไม่จำเป็น

## 1. เป้าหมายหลัก

1. เจ้าหน้าที่เห็นและเข้าใช้งานเฉพาะ EOC Session และกลุ่มภารกิจที่ได้รับมอบหมาย
2. ผู้ที่ไม่ได้รับมอบหมายต้องไม่สามารถเข้าถึงหรือแก้ไขข้อมูลของกลุ่มภารกิจผ่านทั้ง UI และ API
3. ผู้ดูแลระบบและผู้บัญชาการสามารถเข้าถึงทุกกลุ่มภารกิจตามขอบเขตสิทธิ์
4. เมื่อปิด EOC แล้ว งานปฏิบัติการทั่วไปเป็น read-only แต่ workflow รายงานยังสามารถสร้าง แก้ไข ส่ง ตรวจ และอนุมัติย้อนหลังได้ตามสิทธิ์
5. ระบบอุทกภัยต้องมีแหล่งข้อมูลจริงเพียงชุดเดียวสำหรับแบบบันทึก รายงาน และ Dashboard รายวัน
6. ยกเลิกข้อมูล mock และลด route/service/component ที่ทำหน้าที่ซ้ำกัน

## 2. หลักการ Source of Truth

ให้กำหนดแหล่งข้อมูลกลางดังนี้:

- `eoc_sessions` เป็นแหล่งข้อมูลสถานะและช่วงเวลาเปิด–ปิด EOC
- `eoc_session_teams` เป็นแหล่งข้อมูลกลุ่มภารกิจที่เปิดใช้ในแต่ละ Session
- `eoc_team_members` เป็นแหล่งข้อมูลการมอบหมายเจ้าหน้าที่และหัวหน้าทีม
- `eoc_team_reports` เป็นแหล่งข้อมูล workflow รายงานของกลุ่มภารกิจ
- `flood_records` เป็นแหล่งข้อมูลสถานการณ์อุทกภัยระดับพื้นที่
- `activity_logs` เป็นแหล่งข้อมูล audit trail

ห้ามสร้างตารางหรือ API ชุดใหม่ หากข้อมูลเดียวกันมี Source of Truth อยู่แล้ว ให้ปรับ consumer เดิมมาใช้ schema และ service กลางแทน

## 3. โครงสร้างสิทธิ์เจ้าหน้าที่

สร้าง authorization กลางฝั่ง server ที่ตรวจอย่างน้อย:

- `user_id`
- `eoc_session_id`
- `session_team_id`
- `team_code`
- สถานะ membership
- บทบาทในทีม
- สถานะ Session
- ประเภท action เช่น view, create, edit, submit, review, approve

กติกาสิทธิ์:

1. `admin` เข้าถึงและจัดการได้ทุก Session ตามสิทธิ์ผู้ดูแลระบบ
2. `commander` ดูทุกกลุ่มภารกิจ ส่งตรวจ และอนุมัติรายงานได้
3. หัวหน้าทีมดูข้อมูลทีม สร้าง/แก้ไขรายงานของทีม และส่งรายงานได้
4. สมาชิกทีมดูข้อมูลทีมและสร้างรายงานได้ แก้ไขได้เฉพาะรายงานของตนเองที่เป็น `draft` หรือ `returned`
5. เจ้าหน้าที่ที่ไม่ได้เป็นสมาชิกของทีมต้องได้ HTTP 403 จาก API แม้เรียก URL โดยตรง
6. ห้ามใช้การซ่อนเมนูฝั่ง client เป็นกลไกควบคุมสิทธิ์หลัก
7. การมี role ชื่อเดียวกับ `team_code` ต้องไม่เป็นเหตุให้ข้าม membership ของ Session เว้นแต่มีนโยบาย legacy ที่ประกาศและทดสอบไว้อย่างชัดเจน

รวม logic ที่ซ้ำกันไว้ใน access helper/service กลาง และให้ทุก API mutation เรียกใช้ helper เดียวกัน

## 4. พฤติกรรมของเจ้าหน้าที่ที่ได้รับและไม่ได้รับมอบหมาย

### เจ้าหน้าที่ที่ได้รับมอบหมาย

- Sidebar แสดงเฉพาะกลุ่มภารกิจที่ได้รับมอบหมายใน EOC ที่กำลังใช้งาน
- หน้า Staff Workspace แสดงเฉพาะทีมที่เป็นสมาชิก
- เข้าหน้า Dashboard, รายงาน และสมาชิกของทีมตนเองได้
- หน้า “สมาชิก” แสดงเป็น responsive list table โดยมีลำดับ ชื่อ-นามสกุล ตำแหน่ง หน่วยงาน บทบาทในทีม และสถานะหัวหน้าทีม
- สามารถเลือก Session ปิดย้อนหลังเพื่อจัดทำรายงานได้ หาก membership ใน Session นั้นยังถูกต้อง

### เจ้าหน้าที่ที่ไม่ได้รับมอบหมาย

- เข้าได้เฉพาะหน้าหลัก โปรไฟล์ ตั้งค่า และข้อมูลทั่วไปที่กำหนดให้ทุกคนดู
- หน้า Staff Workspace แสดง empty state ที่อธิบายว่าไม่มีงานมอบหมาย
- ไม่แสดงเมนูหรือปุ่มของกลุ่มภารกิจ
- API ของทีมและ API mutation ต้องตอบ 403
- ห้ามอ่านข้อมูลสมาชิกหรือรายงานภายในของทีมอื่น

## 5. Session ปิดและรายงานย้อนหลัง

แยก permission `canOperate` และ `canReport` ออกจากกันอย่างชัดเจน:

- Session `active`: ทำงานปฏิบัติการและรายงานได้ตามสิทธิ์
- Session `closed`: งานปฏิบัติการทั่วไปเป็น read-only แต่รายงานย้อนหลังยังทำได้ตามสิทธิ์

เมื่อ Session ปิดแล้ว ผู้มีสิทธิ์ต้องสามารถ:

- สร้างรายงาน
- แก้ไขรายงานสถานะ `draft` หรือ `returned`
- ส่งรายงาน
- ส่งกลับแก้ไข
- ตรวจและอนุมัติรายงาน
- ส่งออกข้อมูล

ทุกหน้าต้องใช้ข้อความสถานะเดียวกัน เช่น:

> Session ปิดแล้ว งานปฏิบัติการอยู่ในโหมดอ่านอย่างเดียว แต่ยังสามารถจัดทำ แก้ไข ส่ง และตรวจรายงานย้อนหลังได้

แก้ `my-assignments`, Route Guard, Staff Workspace และ Report API ให้รองรับ membership ของ Session ปิดตรงกัน ห้ามมีหน้าหนึ่งอนุญาตแต่อีกหน้าปฏิเสธ

## 6. Workflow รายงานกลุ่มภารกิจ

ใช้สถานะมาตรฐาน:

`draft -> submitted -> approved`

และ:

`submitted -> returned -> draft`

ข้อกำหนด:

- รายงานต้องผูก `eoc_session_id`, `session_team_id`, `team_code` และผู้บันทึก
- ตรวจ ownership ก่อนแก้ไข
- หัวหน้าทีมหรือผู้มีสิทธิ์เท่านั้นที่ส่งรายงาน
- ผู้บัญชาการหรือผู้ดูแลระบบเท่านั้นที่อนุมัติหรือส่งกลับ
- ทุก mutation ต้องบันทึก `activity_logs`
- API response ต้องส่ง permissions ที่คำนวณจาก server
- UI ต้องแสดงปุ่มตาม permissions จาก API ไม่คำนวณสิทธิ์ขึ้นเองจาก role เพียงอย่างเดียว

## 7. ระบบอุทกภัยและ Dashboard รายวัน

ใช้ `flood_records` เป็นข้อมูลจริงชุดเดียว โดยกำหนด schema กลางและชื่อ field ให้ตรงกันทุก route:

- `session_id`
- `polygon_id`
- `province`
- `district`
- `tambon`
- `village`
- `flood_level`
- `flood_start_date` หรือชื่อวันที่รายงานมาตรฐานเพียงชื่อเดียว
- `water_depth_cm`
- `affected_area_sqm`
- `affected_households`
- `affected_people`
- `description`
- `created_by`
- `created_at`
- `updated_at`

Dashboard รายวันต้อง:

1. รับ `session_id` และ `report_date` อย่างชัดเจน
2. ตรวจว่า Session เป็น EOC ประเภท `flood`
3. กรองข้อมูลด้วย `session_id` ทุก query
4. กรองด้วยวันที่รายงานแบบตรงวัน ห้ามใช้เพียง `updated_at >= date`
5. รองรับทั้ง Session เปิดและ Session ปิดย้อนหลัง
6. สรุปจำนวนอำเภอ ตำบล หมู่บ้าน ครัวเรือน และประชาชนที่ได้รับผลกระทบ
7. แสดงระดับความรุนแรง ระดับน้ำ และแนวโน้มตามข้อมูลจริง
8. Drill down จากจังหวัด -> อำเภอ -> ตำบล -> หมู่บ้านได้
9. แสดง empty state เมื่อวันนั้นไม่มีข้อมูล โดยไม่ดึงข้อมูลวันอื่นมาปน
10. ใช้ timezone `Asia/Bangkok` อย่างสม่ำเสมอ

## 8. การรวม API และหน้าที่ซ้ำกัน

ตรวจสอบ route ที่เกี่ยวข้อง เช่น:

- `/api/admin/flood-records`
- `/api/eoc/flood/daily-records`
- `/api/eoc/flood/daily-risk`
- `/api/eoc/flood/management`

จากนั้น:

1. เลือก API production หลักเพียงชุดเดียว
2. แยก service สำหรับ query รายการและ aggregate รายวัน โดยใช้ schema เดียวกัน
3. ย้าย consumer ทุกหน้าให้เรียก service/API หลัก
4. ทำ compatibility adapter ชั่วคราวเฉพาะกรณีจำเป็น
5. ระบุ route ที่ deprecated และลบเมื่อไม่มี consumer
6. ห้ามมี route ที่อ้าง field เก่า เช่น `vid`, `recorded_day`, `water_level` หาก schema จริงใช้ชื่ออื่น

## 9. ยกเลิกข้อมูล Mock

หน้า Flood EOC Management, Daily Dashboard, Reports, Completeness และ Team Workspace ต้องอ่านข้อมูลจากฐานข้อมูลจริง

- ห้ามส่ง `data_mode: "mock"` ใน production
- ห้ามใช้ seed JSON เป็นข้อมูล dashboard จริง
- seed ใช้ได้เฉพาะ development fixture หรือ automated test
- ถ้ายังไม่มีข้อมูลจริง ให้แสดง empty state
- role access ต้องมาจาก authorization จริง ไม่ใช่ `role_access_mock`

## 10. UX และ Navigation

- ใช้ entry route และ Team Page Shell กลางสำหรับทุกกลุ่มภารกิจ
- Sidebar, Staff Workspace และ deep link ต้องให้ผลสิทธิ์ตรงกัน
- แสดงสถานะ loading, empty, error และ forbidden ให้ชัดเจน
- ตารางต้องรองรับมือถือด้วย horizontal scroll
- ห้ามสร้าง Dashboard ซ้ำหลายหน้าเพื่อแสดงข้อมูลเดียวกัน
- หน้ารายงานและ Dashboard ต้องคง Session ที่ผู้ใช้เลือกตลอด workflow
- URL ควรมี `sessionId` และวันที่เมื่อข้อมูลขึ้นกับ Session/วัน เพื่อให้ refresh และแชร์ deep link ได้ถูกต้อง

## 11. Security และ Data Integrity

- ทุก API ที่อ่านข้อมูลภายในต้องเรียก `requireAuth`
- ทุก API mutation ต้องตรวจ membership และ action permission
- validate ID ให้เป็น positive integer
- ใช้ parameterized query เท่านั้น
- validate วันที่ให้อยู่ในช่วงเปิด–ปิด Session
- ห้ามเชื่อ `team_code`, `session_id`, `created_by` จาก client โดยไม่ตรวจจากฐานข้อมูล
- ใช้ transaction ใน workflow ที่อัปเดตรายงานและ audit log พร้อมกัน
- ห้ามเปิดเผย stack trace หรือรายละเอียดฐานข้อมูลใน response

## 12. แผนดำเนินงาน

ทำงานตามลำดับนี้:

1. สำรวจ route, component, service, schema และ consumer ทั้งหมดก่อนแก้
2. ทำ dependency map และเลือก Source of Truth
3. เขียน authorization helper กลาง
4. ปรับ API ให้ตรวจสิทธิ์และใช้ schema กลาง
5. ปรับ `my-assignments`, Sidebar, Route Guard และ Staff Workspace
6. รวม API อุทกภัยและแก้ query รายวัน
7. เชื่อม Dashboard เข้าฐานข้อมูลจริง
8. ย้าย consumer ออกจาก route เก่า
9. เพิ่ม automated tests
10. ลบ mock และโค้ด deprecated เมื่อยืนยันว่าไม่มี consumer

ห้ามลบ route หรือตารางทันทีโดยยังไม่ได้ตรวจ consumer และ migration impact

## 13. Automated Tests ที่ต้องมี

### Authorization

- สมาชิกทีมเข้าทีมตนเองได้
- สมาชิกทีมเข้าทีมอื่นไม่ได้
- ผู้ไม่ได้รับมอบหมายได้ 403 จาก API
- admin และ commander เข้าถึงตามสิทธิ์
- team role อย่างเดียวไม่สามารถข้าม Session membership

### Session และรายงาน

- Session เปิดสามารถปฏิบัติงานและรายงานได้
- Session ปิดไม่สามารถแก้ข้อมูลงานปฏิบัติการทั่วไป
- Session ปิดยังสร้าง แก้ ส่ง ตรวจ และอนุมัติรายงานได้ตามสิทธิ์
- สมาชิกทั่วไปแก้รายงานของผู้อื่นไม่ได้
- ทุก workflow สร้าง audit log

### อุทกภัยรายวัน

- ข้อมูลถูกกรองด้วย `session_id`
- ข้อมูลถูกกรองด้วยวันที่รายงานตรงวัน
- ข้อมูลคนละ Session หรือคนละวันไม่ปะปน
- Session ปิดดู Dashboard ย้อนหลังได้
- วันไม่มีข้อมูลคืนผลรวมเป็นศูนย์และ empty list
- API ที่ไม่มี authentication ถูกปฏิเสธ

## 14. Definition of Done

งานถือว่าเสร็จเมื่อ:

- ไม่มีเจ้าหน้าที่ที่ไม่ได้รับมอบหมายเข้าถึงข้อมูลทีมผ่าน UI หรือ API ได้
- Sidebar, Staff Workspace, Route Guard และ API ให้ผลสิทธิ์ตรงกัน
- รายงานย้อนหลังหลังปิด EOC ทำงานครบ workflow
- Dashboard อุทกภัยรายวันใช้ข้อมูลฐานจริงและกรอง Session/วันที่ถูกต้อง
- ไม่มี production page ที่ใช้ mock data
- route ซ้ำถูกยุบหรือประกาศ deprecated พร้อม migration path
- lint, unit tests, integration tests และ build ผ่าน
- มีเอกสารสรุป route หลัก Source of Truth permission matrix และรายการ route ที่ยกเลิก

## 15. รูปแบบผลลัพธ์ที่ต้องส่งมอบ

เมื่อพัฒนาเสร็จ ให้รายงาน:

1. Architecture และ Source of Truth หลังปรับ
2. Permission matrix แยกตาม role และ action
3. รายการไฟล์/API ที่แก้
4. route ที่คงไว้ ยุบ หรือ deprecated
5. database migration ที่ใช้
6. automated tests และผลการทดสอบ
7. known limitations ที่ยังเหลือ

อย่ารายงานว่า “เสร็จแล้ว” จากการตรวจเฉพาะหน้าจอ ต้องยืนยันทั้ง UI, API authorization, database query และ automated tests
