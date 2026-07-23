# Prompt: ตรวจสอบและพัฒนาระบบจัดการข้อมูลสำหรับเจ้าหน้าที่ EOC

## บทบาท

คุณเป็น Senior Full-stack Engineer, Data Architect และ Security Engineer ผู้รับผิดชอบระบบ STN-EOC จงพัฒนาระบบจัดการข้อมูลเจ้าหน้าที่ให้ข้อมูลถูกต้อง ตรวจสอบย้อนหลังได้ ใช้งานง่าย และปลอดภัย โดยยึด Database เป็น Source of Truth

ก่อนเริ่มงานต้องอ่าน:

- `prompter/structure.md`
- `prompter/คำสั่งปรับแก้.md`
- `docs/eoc-architecture.md`
- schema และ migration ที่เกี่ยวข้อง

ตรวจ `git status` ก่อนแก้ไข และรักษางานเดิมของผู้ใช้ ห้ามลบหรือเขียนทับการแก้ไขที่ไม่เกี่ยวข้อง

## เป้าหมาย

1. เจ้าหน้าที่เห็นงาน ข้อมูล และรายงานตาม Session และกลุ่มภารกิจที่ได้รับมอบหมาย
2. ข้อมูลทุกชุดมีแหล่งที่มา ปีอ้างอิง สถานะตรวจสอบ และผู้รับผิดชอบ
3. ระบบตรวจพบข้อมูลผิดปกติก่อนนำไปใช้คำนวณหรือเผยแพร่
4. Mission, Meeting และ Decision เชื่อมโยงกันและใช้งานได้จริง
5. ทุกการแก้ไขข้อมูลสำคัญตรวจสอบย้อนหลังได้
6. Session ปิดแล้ว งานปฏิบัติการเป็น read-only แต่รายงานย้อนหลังยังทำได้ตาม permission
7. ไม่มี mock, seed, sample หรือ fallback ที่สร้างข้อมูลปฏิบัติการขึ้นเอง

## กฎ Source of Truth

ใช้ตารางหลักดังนี้:

- `eoc_sessions`: สถานะและช่วงเวลา EOC
- `eoc_session_teams`: กลุ่มภารกิจของ Session
- `eoc_team_members`: สมาชิกและหัวหน้ากลุ่มภารกิจ
- `eoc_team_reports`: รายงานกลุ่มภารกิจ
- `flood_records`: รายงานสถานการณ์อุทกภัย
- `missions`: ภารกิจ
- `meeting_notes`: บันทึกการประชุม
- `decision_logs`: ข้อสั่งการและการตัดสินใจ
- `satun_village_polygon`: Master Data พื้นที่และ Polygon
- `area_population`: ประชากรรายอำเภอ
- `area_risk_profiles`: Risk profile
- `route_corridors`: เส้นทางที่รับรอง
- `eoc_file_assets`: Metadata ของไฟล์
- `activity_logs`: Audit trail

ห้ามสร้างตารางหรือ API ซ้ำ หากข้อมูลมี Source of Truth อยู่แล้ว

## 1. Data Quality Dashboard

สร้างหน้า Admin สำหรับตรวจคุณภาพข้อมูล โดยสรุปอย่างน้อย:

- จำนวนข้อมูลที่ไม่มีปีอ้างอิง
- จำนวนข้อมูลที่ไม่มีแหล่งที่มา
- จำนวนข้อมูลพื้นที่ที่ไม่ตรงกับ Master Data
- จำนวนรายงานที่ไม่มี Session
- จำนวนรายงานที่ไม่มีวันที่
- จำนวนข้อมูลติดลบหรือผิดช่วง
- จำนวนข้อมูลซ้ำใน Session, วันที่ และพื้นที่เดียวกัน
- จำนวนรายงานที่ยังไม่ผ่านการตรวจสอบ
- จำนวนไฟล์ที่มี metadata แต่ไม่มีไฟล์จริง
- จำนวนไฟล์ที่มีจริงแต่ไม่มี metadata

สำหรับ `area_population` ต้องตรวจ:

- `male_population >= 0`
- `female_population >= 0`
- `population = male_population + female_population`
- มี `population_scope`
- มี `source_name`
- แสดงคำเตือนเมื่อ `population_year` เป็น `NULL`
- ห้ามคำนวณอัตราต่อแสน หากไม่มีประชากรหรือขอบเขตประชากรไม่ตรงกับข้อมูลผู้ป่วย

Dashboard ต้อง Drill down ไปยัง Record ที่มีปัญหาและมีปุ่มแก้ไขสำหรับผู้มีสิทธิ์

## 2. Master Data Management

สร้างหน้า Admin สำหรับจัดการ:

- ประชากรรายอำเภอ แยกชาย หญิง และรวม
- อำเภอ ตำบล หมู่บ้าน
- หน่วยงาน
- สถานพยาบาล
- ประเภทโรค
- ประเภทภัย
- Risk profile
- Route corridor

ข้อกำหนด:

- List Table รองรับมือถือด้วย horizontal scroll
- มีค้นหา กรอง เรียงลำดับ และ pagination
- แสดง source, reference year, updated_at และผู้แก้ไข
- ตรวจ duplicate ก่อนบันทึก
- ใช้ Server-side validation
- ทุก mutation บันทึก Audit Log
- ลบข้อมูลที่ถูกอ้างอิงอยู่ไม่ได้ ให้ใช้ inactive/archive แทน

### ประชากร

ฟอร์มประชากรต้องมี:

- จังหวัด
- อำเภอ
- ชาย
- หญิง
- รวม โดยคำนวณจากชาย + หญิง
- ขอบเขตประชากร เช่น `thai` หรือ `all`
- ปีข้อมูล
- แหล่งข้อมูล
- วันที่ข้อมูลต้นทาง
- หมายเหตุ

ห้ามให้ client ส่งยอดรวมที่ไม่ตรงกับชาย + หญิง และ Database ต้องมี Check Constraint ยืนยันอีกชั้น

## 3. Officer Work Inbox

สร้างหน้า Inbox ส่วนบุคคลสำหรับเจ้าหน้าที่ โดยแสดง:

- Session ที่ได้รับมอบหมาย
- กลุ่มภารกิจที่เป็นสมาชิก
- รายงานที่ต้องส่งวันนี้
- รายงานใกล้ถึงกำหนด
- รายงานที่ถูกส่งกลับแก้ไข
- Mission ที่รับผิดชอบ
- Decision หรือข้อสั่งการที่ต้องติดตาม
- การประชุมครั้งถัดไป
- Notification ที่ยังไม่ได้อ่าน

ข้อมูลต้องกรองตาม `user_id`, membership และ permission ฝั่ง Server ห้ามกรองเฉพาะใน Client

## 4. Mission Management

พัฒนาหน้า Mission ให้รองรับ:

- สร้างและแก้ไข Mission
- รหัสและประเภทภารกิจ
- ชื่อและรายละเอียด
- พื้นที่
- ทีมและผู้รับผิดชอบ
- หน่วยงานรับผิดชอบ
- Priority
- Due date
- สถานะ
- Progress
- หลักฐาน
- หมายเหตุ

สถานะแนะนำ:

```text
intake → assigned → in_progress → completed → verified → closed
                          ↘ blocked
```

กฎ:

- Closed Session ห้ามสร้างหรือแก้ Mission
- ผู้รับผิดชอบอัปเดตความคืบหน้าได้ตามสิทธิ์
- ผู้บัญชาการหรือผู้มีสิทธิ์เป็นผู้ verified/closed
- ทุกการเปลี่ยนสถานะต้องมีผู้เปลี่ยน เวลา และเหตุผล
- Progress ต้องอยู่ระหว่าง 0–100

## 5. Meeting Management

พัฒนาหน้าประชุมให้รองรับ:

- วันและเวลา
- ประธาน
- ผู้เข้าร่วม
- วาระ
- สรุปสถานการณ์
- ประเด็นสำคัญ
- มติ
- ข้อสั่งการ
- ทีมรับผิดชอบ
- Due date
- สถานะติดตาม
- การประชุมครั้งถัดไป
- ไฟล์แนบ

ต้องสามารถแปลงมติหรือข้อสั่งการจากการประชุมเป็น:

- `decision_logs`
- `missions`

การสร้างข้อมูลที่เชื่อมโยงกันต้องใช้ Database Transaction

## 6. Decision Management

พัฒนาหน้า Decision ให้รองรับ:

- วันเวลา
- ผู้ตัดสินใจ
- ประเด็น
- ข้อมูลประกอบ
- ข้อสั่งการ
- ทีมรับผิดชอบ
- กำหนดติดตาม
- สถานะ
- Mission ที่เชื่อมโยง
- เอกสารแนบ

ต้องแสดง Traceability:

```text
Meeting → Decision → Mission → Progress → Evidence → Verification
```

ห้ามลบ Decision ที่เชื่อมกับ Mission ให้ใช้ยกเลิกพร้อมเหตุผลและ Audit Log

## 7. Report Verification Workflow

ใช้ workflow:

```text
draft → submitted → verified → approved
                    ↘ returned → draft
```

หาก schema ปัจจุบันใช้ `approved` โดยไม่มี `verified` ให้ตรวจ impact และสร้าง migration อย่างปลอดภัย ห้ามเปลี่ยน enum โดยไม่ตรวจ consumer

กฎสิทธิ์:

- สมาชิกสร้างรายงานและแก้ของตนเองในสถานะ `draft` หรือ `returned`
- หัวหน้าทีมส่งรายงาน
- ผู้ตรวจสอบ verified หรือ returned
- Commander/Admin approved
- Closed Session ยังทำ workflow รายงานย้อนหลังได้
- ทุก mutation ต้องบันทึก `activity_logs`

ข้อมูลที่ยังไม่ approved ต้องไม่เผยแพร่สู่หน้าสาธารณะโดยอัตโนมัติ

## 8. Notification Center

สร้าง Notification Center รองรับ:

- ได้รับมอบหมายเข้า Session หรือกลุ่มภารกิจ
- ได้รับ Mission ใหม่
- ใกล้ถึงกำหนด
- เกินกำหนด
- รายงานถูกส่งกลับ
- รายงานผ่านการตรวจสอบ
- รายงานได้รับอนุมัติ
- มี Decision ใหม่
- มีการประชุมใหม่
- Session ปิดแต่มีรายงานค้าง

Notification ต้องมี:

- ผู้รับ
- ประเภท
- หัวข้อ
- รายละเอียด
- Target URL
- Session
- สถานะอ่านแล้ว
- created_at/read_at

รองรับ Notification ในระบบก่อน ส่วน Telegram ให้ใช้เป็นช่องทางเสริมและต้องไม่ส่งข้อมูลส่วนบุคคลหรือข้อมูลลับ

## 9. Audit Log

Audit Log สำหรับข้อมูลสำคัญต้องเก็บ:

- `user_id`
- username
- action
- target table/type
- target ID
- Session
- Team
- ค่าเดิม
- ค่าใหม่
- เหตุผล
- IP
- User agent
- เวลา `Asia/Bangkok`

ข้อมูล Audit ต้อง append-only ผู้ใช้ทั่วไปแก้ไขหรือลบไม่ได้

หน้า Audit Log ต้องค้นหาและกรองตามผู้ใช้ Session ประเภทข้อมูล และช่วงเวลาได้

## 10. File Integrity

ไฟล์ทุกประเภทต้องใช้ `eoc_file_assets` เป็น Metadata Source of Truth:

- MIME type
- ขนาด
- SHA-256 checksum
- storage path
- original filename
- Session
- report date
- uploaded_by
- created_at

เพิ่ม Job ตรวจ:

- Metadata แต่ไม่มีไฟล์
- ไฟล์แต่ไม่มี Metadata
- Checksum ไม่ตรง
- ไฟล์ซ้ำ

การลบต้องมี compensation หาก Database หรือ Storage ขั้นใดขั้นหนึ่งล้มเหลว

## 11. Backup และ Recovery

จัดทำ script และเอกสารสำหรับ:

- Database backup
- File storage backup
- Retention policy
- Encryption
- Restore test
- Backup status
- Last successful backup
- Failure notification

ห้ามรายงานว่า backup พร้อมใช้งาน หากยังไม่เคยทดสอบ restore

## 12. Security

- ทุก Internal API ต้อง `requireAuth`
- ทุก mutation ตรวจ membership และ permission ฝั่ง Server
- ใช้ parameterized query
- Validate positive integer ID
- Validate วันที่และช่วง Session
- จำกัด MIME type และขนาดไฟล์
- ป้องกัน path traversal
- ห้ามเชื่อ `user_id`, `session_id`, `team_code` หรือ `created_by` จาก Client
- ไม่ส่ง stack trace หรือ SQL error ให้ Client
- ข้อมูลส่วนบุคคลต้องแสดงตามหลัก least privilege

## 13. Automated Tests

เพิ่ม tests อย่างน้อย:

1. ประชากรรวมต้องเท่ากับชาย + หญิง
2. ไม่มีประชากรแล้วต้องไม่คำนวณอัตราต่อแสน
3. ขอบเขตประชากรไม่ตรงต้องแสดง warning
4. สมาชิกทีมเข้าถึงเฉพาะข้อมูลทีมตนเอง
5. ผู้ไม่ได้รับมอบหมายได้ HTTP 403
6. Closed Session แก้งานปฏิบัติการไม่ได้
7. Closed Session ยังส่งและตรวจรายงานย้อนหลังได้
8. Meeting สร้าง Decision และ Mission ใน Transaction เดียว
9. เปลี่ยน Mission status แล้วมี Audit Log
10. ไฟล์ checksum ไม่ตรงถูกแจ้งใน Data Quality Dashboard
11. Notification แสดงเฉพาะผู้รับ
12. ข้อมูลที่ยังไม่ approved ไม่ออกหน้าสาธารณะ

## 14. ลำดับการดำเนินงาน

1. สำรวจ schema, route, service, component และ permission เดิม
2. ทำ dependency map และระบุ Source of Truth
3. สร้าง Data Quality query/service กลาง
4. พัฒนา Master Data API และ UI
5. พัฒนา Officer Inbox
6. พัฒนา Mission, Meeting และ Decision
7. เชื่อม workflow และ transaction
8. เพิ่ม Notification
9. เพิ่ม Audit และ File Integrity
10. เพิ่ม tests
11. รัน migration ในสภาพแวดล้อมที่กำหนด
12. รัน lint, tests และ production build
13. ทดสอบ UI และ API ตาม permission จริง

## 15. Definition of Done

งานถือว่าเสร็จเมื่อ:

- ไม่มีข้อมูลปฏิบัติการจาก mock หรือ fallback
- Data Quality Dashboard แสดงปัญหาและ Drill down ได้
- Master Data แก้ไขได้พร้อม Audit
- เจ้าหน้าที่มี Inbox งานส่วนบุคคล
- Mission, Meeting และ Decision เชื่อมโยงกัน
- Closed Session และ Report Workflow ทำงานตาม permission
- Notification Center ใช้งานได้
- File Integrity ตรวจสอบได้
- Backup มีเอกสารและผล Restore Test
- Unauthorized API ได้ 401/403 อย่างถูกต้อง
- lint ผ่าน
- automated tests ผ่าน
- production build ผ่าน

## รูปแบบผลส่งมอบ

เมื่อพัฒนาเสร็จ ให้รายงาน:

1. Architecture และ Source of Truth
2. Permission matrix
3. Migration ที่เพิ่ม
4. API และหน้าที่เพิ่มหรือแก้
5. Workflow ของ Mission, Meeting, Decision และ Report
6. Data Quality rules
7. Notification และ Audit
8. ผล lint, tests, build และ runtime verification
9. Known limitations

ห้ามสรุปว่าเสร็จ หากตรวจเฉพาะ UI แต่ยังไม่ได้ตรวจ Database, API authorization, transaction และ automated tests
