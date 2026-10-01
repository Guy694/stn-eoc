# Prompt สำหรับสร้างระบบ EOC ใหม่ด้วย TypeScript

จัดทำจากการอ่าน source code ใน workspace `stn-eoc` วันที่ 14 กันยายน 2026

## ผลการศึกษาและขอบเขตหลักฐาน

- ระบบศูนย์ปฏิบัติการภาวะฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล เป็น Next.js App Router แบบ full-stack ใช้ JavaScript/JSX, MySQL และ `mysql2/promise` เป็นหลัก
- `package.json` ระบุ Next.js `^16.1.1`, React `19.2.0`, Tailwind CSS 4, Zod 4, Leaflet, Recharts/Chart.js และ Jest ตัวเลขนี้เป็น dependency ที่ประกาศใน repository ไม่ใช่การยืนยันเวอร์ชันที่ติดตั้งหรือคำแนะนำเวอร์ชันล่าสุด
- `app/` มีหน้าสาธารณะ หน้าประชาชน หน้าผู้บัญชาการ หน้าปฏิบัติงาน และหน้าผู้ดูแล; `app/api/` เป็น backend; `components/` เป็น UI; `context/` ดูแล auth และ EOC ที่เลือก; `lib/` รวมฐานข้อมูล สิทธิ์ กฎงาน และ integration
- `src/features/eoc/` เริ่มแยก feature เป็น registry → resolver → entry → dashboard/service/schema มีหน้าทีมร่วม และ override เฉพาะทีม/ภัย เช่น flood:sat และ dengue:sat
- แกนข้อมูลคือ `eoc_sessions → eoc_session_teams → eoc_team_members → eoc_team_reports` เชื่อมข้อมูลภัย ภารกิจ การประชุม คำสั่ง และทรัพยากร
- ทีมมี 23 กลุ่ม แต่ไม่ได้มี dashboard เฉพาะครบทุกทีม: ตัว resolver ใช้ dashboard เฉพาะภัยและทีมก่อน แล้ว dashboard ทีม แล้วหน้าร่วม
- registry รองรับ flood, dengue, storm, drought, epidemic, fire, festival-accidents แต่โมดูลข้อมูลเฉพาะที่เห็นชัดคือ flood, disease/dengue และ accident/festival-accidents การมีชื่อใน registry ไม่เท่ากับมี workflow เฉพาะภัยครบแล้ว
- README และ `analysis.md` บางส่วนล้าสมัย เช่นเวอร์ชัน framework และความหมาย SAT จึงใช้โค้ดเป็นหลัก: SAT คือกลุ่มภารกิจตระหนักรู้สถานการณ์
- migration เก่า `create_eoc_team_reports.sql` ยังไม่มีสถานะ `verified` แต่ review API ปัจจุบันบังคับตรวจสอบก่อนอนุมัติ และมี migration เพิ่มเติม จึงต้องรวม migration ทั้งชุดเมื่อออกแบบ schema ใหม่
- พบการสร้าง/แก้ schema ระหว่าง request ใน API บางแห่ง ระบบใหม่ควรย้ายทั้งหมดไป migration และใช้ database pool ร่วม
- การศึกษานี้เป็น static code review ไม่ได้เปิดฐานข้อมูลจริง รันระบบ หรือยืนยันความครบถ้วนของข้อมูล production; ไม่อ่าน `.env` หรือ backup ที่อาจมีข้อมูลส่วนบุคคล

### แหล่งอ้างอิงภายใน repository

| เรื่อง | ไฟล์หลัก |
|---|---|
| Stack และการรัน | `package.json`, `next.config.mjs` |
| สถาปัตยกรรมและกฎรอบปฏิบัติการ | `docs/eoc-architecture.md` |
| Auth และสิทธิ์ | `lib/auth.js`, `lib/eocRoles.js`, `lib/eocTeamAccess.js`, `lib/eocOperationalAccess.js` |
| ประเภทภัย/ทีม/การประกอบหน้า | `src/features/eoc/registries/`, `src/features/eoc/resolvers/` |
| แบบรายงาน 23 ทีม | `src/features/eoc/registries/team-report-definition.registry.js` |
| Lifecycle และอนุมัติรายงาน | `app/api/eoc/status/route.js`, `app/api/eoc/sessions/[sessionId]/teams/[sessionTeamId]/reports/` |
| Flood daily และ state machine ภารกิจ | `lib/eocFloodDaily.js`, `lib/eocValidation.js` |
| ฐานข้อมูลและ master data | `migrations/`, `database/`, `lib/masterDataConfig.js` |
| ประชาชน/ทรัพยากร/ข้อมูลภายนอก | `app/api/public/`, `app/api/resources/`, `app/api/chatbot/`, `lib/weatherWatch.js`, `lib/routeAdvice.js` |
| การทดสอบและกู้คืน | `__tests__/`, `docs/backup-recovery.md` |

---

## เริ่มคัดลอก prompt จากบรรทัดถัดไป

คุณเป็น Senior Full-stack TypeScript Engineer และ Software Architect ให้สร้างระบบ “EOC — ศูนย์ปฏิบัติการภาวะฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล” ใหม่ โดยใช้ข้อกำหนดต่อไปนี้เป็น product specification และ implementation contract

ให้สร้างระบบที่รันได้จริง มี frontend, API, ฐานข้อมูล, migration, authorization, validation และ tests เชื่อมกัน ไม่จบเพียง mockup หรือแผนงาน ระบบเดิมเป็นแหล่งอ้างอิงกฎงาน แต่ระบบใหม่ต้องจัดโครงสร้างให้ขยายได้และใช้ TypeScript อย่างจริงจัง

หากมี repository เดิมให้อ่าน source และ migration ก่อนลงมือ ห้ามแก้หรือเขียนทับระบบเดิมโดยไม่จำเป็น ให้สร้างระบบใหม่ในโฟลเดอร์หรือ repository แยก และรักษาไฟล์ที่ผู้ใช้แก้ค้างไว้

ข้อกำหนดสถาปัตยกรรมและการเสริมความแข็งแรงด้านล่างเป็นเป้าหมายของระบบใหม่ ไม่ใช่การอ้างว่าระบบเดิมทำครบทั้งหมดแล้ว

### 1. เป้าหมายและ stack

- ให้ประชาชนติดตามสถานการณ์ แจ้งเหตุ และติดตามเรื่องของตนได้
- ให้เจ้าหน้าที่ปฏิบัติงานตาม Session และทีมที่ได้รับมอบหมาย
- ให้ผู้บัญชาการเห็นภาพรวม ตัดสินใจ มอบภารกิจ ตรวจสอบและอนุมัติรายงาน
- ให้ผู้ดูแลจัดการผู้ใช้ ทีม ข้อมูลหลัก คุณภาพข้อมูล และการสำรองข้อมูล
- ใช้ Next.js App Router + React + TypeScript, Tailwind CSS, Zod, MySQL, `mysql2/promise`, Leaflet/React Leaflet และเลือกใช้ Recharts เป็นมาตรฐานกราฟในระบบใหม่
- ยืนยัน compatibility และเลือกเวอร์ชันร่วมกันก่อนติดตั้ง บันทึกเวอร์ชันใน lockfile ไม่อ้างว่าเวอร์ชันจากโค้ดเดิมเป็นเวอร์ชันล่าสุด
- ใช้ modular monolith: route บาง → controller/validation → authorization → service → repository → database ไม่ต้องแยก microservices
- เปิด `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`; application code ใช้ `.ts`/`.tsx`; หลีกเลี่ยง `any`, `@ts-ignore` และ type assertion ที่ข้าม validation
- ใช้ `unknown` กับข้อมูลจาก network/JSON แล้ว parse ด้วย schema; มี type แยก DB row, domain model และ API DTO; ห้ามส่ง row ที่มีข้อมูลลับออกตรง ๆ
- ใช้ server component สำหรับส่วนที่เหมาะสม และ client component สำหรับ map/chart/form; server-only module ต้องไม่เข้า client bundle
- Production อ่านข้อมูลจริงจากฐานข้อมูลเท่านั้น; demo fixtures อยู่ใน seed/test แยกและต้องเปิดอย่างชัดเจน

### 2. Domain และรหัสมาตรฐาน

โครงสร้างสำคัญ:

`ประเภทภัย → EOC Session → ทีมที่เปิดใช้ → หัวหน้าทีม/สมาชิก → รายงานและภารกิจ`

แยก auth session ซึ่งเป็นการเข้าสู่ระบบ ออกจาก EOC session ซึ่งเป็นรอบเปิดศูนย์

ประเภทภัยใน registry ได้แก่ `flood`, `dengue`, `storm`, `drought`, `epidemic`, `fire`, `festival-accidents` โดยสร้าง workflow เฉพาะน้ำท่วม โรค และอุบัติเหตุเทศกาลให้ครบก่อน ส่วน storm/drought/fire ใช้หน้าร่วมและระบุขอบเขตความสามารถจริง ห้ามแต่งสูตรหรือแบบรายงานเฉพาะภัยขึ้นเอง

ระบบเดิม normalize `disease → dengue` และ `accident → festival-accidents` แต่ข้อมูล disease มีชนิดโรคได้หลายชนิด ระบบใหม่ต้องแยก hazard type กับ disease subtype และตรวจ `disease_id`/`disease_name` ก่อนย้ายข้อมูล ห้ามแปลงโรคทั้งหมดเป็นไข้เลือดออกโดยอัตโนมัติ ให้มี mapping report และรายการที่ต้องแก้ mapping

สร้าง team registry 23 ทีม:

| Code | ชื่อ |
|---|---|
| commander | ผู้บัญชาการเหตุการณ์และรองผู้บัญชาการเหตุการณ์ |
| sat | ตระหนักรู้สถานการณ์ |
| planning | การวางแผน |
| scientific | วิชาการ |
| jit | ปฏิบัติการสอบสวนควบคุมโรค |
| active-surv | เฝ้าระวังเชิงรุก |
| case-mgmt | จัดการและดูแลรักษาผู้ป่วย |
| lab | ห้องปฏิบัติการด้านสาธารณสุข |
| riskcom | สื่อสารความเสี่ยง |
| vaccine | บริหารจัดการและบริการวัคซีน |
| mcatt | ช่วยเหลือเยียวยาจิตใจ |
| poe | ด่านควบคุมโรคระหว่างประเทศ |
| quarantine | ปฏิบัติการกักกันโรค |
| mert | ปฏิบัติการฉุกเฉินทางการแพทย์ |
| serht | อนามัยสิ่งแวดล้อม |
| logistics | สำรองวัสดุ เวชภัณฑ์ และส่งกำลังบำรุง |
| legal | กฎหมาย |
| finance | การเงินและงบประมาณ |
| staffing | จัดสรรกำลังคน |
| admin | บริหารและธุรการ |
| it | เทคโนโลยีดิจิทัล |
| liaison | ประสานงานและเลขานุการ |
| eoc-mgmt | จัดการศูนย์ปฏิบัติการ |

รองรับ mapping legacy code เช่น `ITSUPPORT → it`, `EOC_ADMIN/ADMIN → admin`, `SeRHT → serht` แต่ team admin ไม่ได้แปลว่าเป็น system admin และสมาชิกทีม commander ไม่ได้รับสิทธิ์ system commander อัตโนมัติ

ใช้ typed registry/resolver สำหรับ navigation, dashboard, report schema และ permissions โดยลำดับ resolve คือ `(hazard, team) override → team default → shared default` ไม่เขียนเงื่อนไขชนิดภัยซ้ำทุกหน้า

### 3. ผู้ใช้และสิทธิ์

- ผู้เยี่ยมชม: อ่านข้อมูลสาธารณะที่อนุมัติแล้ว
- ประชาชน: ยืนยันตัวตนตามโฟลว์ที่กำหนด แจ้งเหตุ ดูประวัติและสถานะของตน
- เจ้าหน้าที่: ทำงานใน Session/ทีมที่ได้รับมอบหมาย
- หัวหน้าทีม: เป็นความสัมพันธ์ภายใน SessionTeam ไม่ใช่ system role ถาวร
- ผู้บัญชาการและผู้ดูแล: สิทธิ์ตามตารางด้านล่าง
- มี username/password, เปลี่ยนรหัสผ่าน, logout, session expiry และ ThaiID integration สำหรับเจ้าหน้าที่/ประชาชน
- มีคำขอสมัครและขั้นตอน pending/verified/approved/rejected, เจ้าหน้าที่ต้องได้รับอนุมัติก่อนใช้งาน และการเลื่อนประชาชนเป็นเจ้าหน้าที่ต้องมี audit
- ThaiID ต้องใช้ provider contract จริงจากเอกสาร/ค่าที่หน่วยงานให้มา ไม่เดา endpoint หรือจำลองว่าผ่านการยืนยันแล้ว; หากยังไม่ตั้งค่า ให้แสดง unavailable พร้อมใช้ local auth ได้
- ใช้ session token แบบสุ่ม เก็บอย่างปลอดภัยผ่าน HttpOnly/Secure/SameSite cookie, revoke ได้; idle timeout ตั้งค่าได้ โดยระบบเดิมใช้ 10 นาทีสำหรับเจ้าหน้าที่

| Action | Admin | Commander | Team lead | Team member | Unassigned |
|---|---|---|---|---|---|
| ดูข้อมูลทีม | ได้ | ได้ | ทีมตน | ทีมตน | ไม่ได้ |
| แก้งาน Session active | ได้ | ได้ | ตาม capability | ตาม capability | ไม่ได้ |
| แก้งาน Session closed | ไม่ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ |
| สร้างรายงานใน active/closed | ได้ | ได้ | ได้ | ได้ | ไม่ได้ |
| แก้ draft/returned | ได้ | ได้ | ทีมตน | รายงานตนเอง | ไม่ได้ |
| ส่งรายงาน | ได้ | ได้ | ทีมตน | ไม่ได้ | ไม่ได้ |
| ตรวจ/อนุมัติ/ส่งกลับ | ได้ | ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ |
| Verify/close ภารกิจ | ได้ | ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ |
| จัดการ master data/data quality | ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ | ไม่ได้ |

ทุก API ต้องตรวจผู้ใช้ สถานะอนุมัติ Session ทีม membership และ ownership จาก server ห้ามใช้การซ่อนเมนูหรือค่าจาก browser เป็น authorization การมี legacy role SAT หรือชื่อทีมเพียงอย่างเดียวไม่ทำให้เข้าถึง Session ได้

### 4. EOC Session และการจัดทีม

- เปิด/ปิดศูนย์ แสดงประวัติย้อนหลัง เลขรอบ ประเภทภัย ชนิดโรค/ประเภทเทศกาล เหตุผลเปิด/ปิด ผู้ดำเนินการ วันเวลา และไฟล์คำสั่งเปิดศูนย์
- บันทึกผู้บัญชาการ/รองผู้บัญชาการต่อ Session; เปิดใช้ทีม แต่งตั้งหัวหน้า เพิ่ม/ถอนสมาชิก และใช้ template การจัดทีมได้
- ตรวจ readiness เช่นข้อมูล Session ทีม หัวหน้า และสมาชิกที่ยังขาดก่อนเริ่มงาน
- ใช้ `eoc_sessions` เป็น source of truth; สถานะภาพรวมเป็น projection ไม่เขียนสถานะซ้ำหลายแห่งโดยไร้ transaction
- คงข้อจำกัดการเปิดรอบพร้อมกันตาม business rule ที่ตรวจจากระบบเดิม โดยระบุ uniqueness key ให้ชัด และกัน concurrent open ด้วย transaction/constraint
- UI ต้องแสดง Session และวันข้อมูลที่กำลังดูอย่างชัดเจน; เมื่อเปลี่ยน Session ต้องเปลี่ยน query/cache key ทั้งชุด ป้องกันเขียนผิดรอบ
- Closed Session อ่านย้อนหลังได้ แต่ห้ามแก้ operational records แม้เป็น admin; workflow รายงานยังดำเนินต่อได้ตามสิทธิ์

### 5. รายงานทีมและกล่องงาน

- มีหน้ารวมงานของฉัน รายการทีมที่ได้รับมอบหมาย dashboard ทีม สมาชิก รายงาน รายละเอียด สร้าง และแก้ไข
- สถานะรายงาน: `draft → submitted → verified → approved`; ส่งกลับได้จาก submitted/verified เป็น returned และส่งใหม่ได้หลังแก้ไข
- ต้องมีเหตุผลเมื่อส่งกลับ ตรวจ required fields ตอน submit; ห้ามข้าม verified ไป approved; approved แก้ตรง ๆ ไม่ได้
- สมาชิกแก้ได้เฉพาะ draft/returned ของตน หัวหน้าทีมและ privileged roles จัดการตาม matrix
- วันที่เนื้อหารายงานต้องอยู่ในช่วง Session; การส่งย้อนหลังหลังปิดศูนย์ยังทำได้ แยก reportDate ออกจาก submittedAt
- เก็บ title, reportDate, reportingPeriod, urgency, situationSummary, reportType, schemaVersion, payload และผู้/เวลาที่สร้าง แก้ ส่ง ตรวจ อนุมัติ
- มีแบบรายงานครบ 23 ทีมผ่าน versioned schema registry มี common fields และ fields เฉพาะทีม ใช้ definitions ของระบบเดิมเป็นฐาน หากมี source ให้ย้ายทุก field/options/submitRequiredFields พร้อม tests
- ตัวอย่างเนื้อหา: SAT สถานการณ์/แนวโน้ม/จุดเสี่ยง/แหล่งข้อมูล; planning แผน/วัตถุประสงค์/พื้นที่/ช่วงเวลา; logistics คลัง/การเบิกจ่าย; IT ระบบขัดข้อง/ทรัพยากร; riskcom ข้อความ/กลุ่มเป้าหมาย/ช่องทาง/ผลตอบรับ; ทีมอื่นมีแบบเฉพาะตามภารกิจ ไม่ใช้ textarea เดียวแทนทั้งหมด
- หากไม่มี source definitions ให้จัดทำ form specification 23 ทีมเป็น baseline ที่ระบุว่าเป็นข้อเสนอ และไม่อ้างว่าเหมือนระบบเดิมทุก field
- มี inbox, unread count, mark read และ notification เมื่อมอบงาน ส่งรายงาน ตรวจ/อนุมัติ/ส่งกลับ พร้อม deep link ที่ยังตรวจสิทธิ์

### 6. โมดูลอุทกภัย

- บันทึกระดับหมู่บ้านและพิกัด/polygon: จังหวัด อำเภอ ตำบล หมู่บ้าน ระดับน้ำท่วม สถานะ ความลึกน้ำ cm พื้นที่กระทบ m² ครัวเรือน ประชาชน วันที่เริ่ม/สิ้นสุด รายละเอียด และหลักฐานหลายไฟล์
- รองรับรายวัน timeline แผนที่ สรุปอำเภอ/ตำบล/หมู่บ้าน และคัดลอกข้อมูลวันก่อนโดย preview และป้องกันซ้ำ
- Query รายวันต้องระบุ Session และวันตาม Asia/Bangkok; compatibility เดิมใช้ `DATE(flood_start_date) = report_date` หากเพิ่ม observationDate ให้มี migration อธิบายความหมายแยกจากวันเริ่มเหตุ
- แยกตัวชี้วัด “หมู่บ้านไม่ซ้ำ”, “จำนวนบันทึก”, “จำนวนคนของวันนั้น” และ “สะสม” ห้ามบวก snapshot รายวันเป็นจำนวนคนสะสมโดยไม่มีวิธี deduplicate
- จัดการผู้ได้รับผลกระทบแยกประชาชน/อาสาสมัคร/เจ้าหน้าที่ และผลกระทบทรัพย์สิน บาดเจ็บ เสียชีวิต สูญหาย ได้รับยา อพยพ/ไม่อพยพ
- กลุ่มเปราะบาง ได้แก่ผู้สูงอายุ เด็ก ผู้พิการ ผู้ป่วยติดเตียง หญิงตั้งครรภ์ ผู้ป่วยเรื้อรัง มี baseline ใช้ข้าม Session และข้อมูลการช่วยเหลือของแต่ละ Session แยกกัน กลุ่มอาจซ้อนทับกัน ห้ามรวมเป็นจำนวนคนไม่ซ้ำโดยตรง
- ศูนย์พักพิง: ข้อมูลกลาง ที่ตั้ง พิกัด ผู้ติดต่อ ความจุ พร้อม activation ต่อ Session จำนวนผู้พัก และรายงานโรคในศูนย์
- Flood command room: summary, team workspace, daily input, completeness, ภารกิจ การประชุม ข้อสั่งการ และรายงาน

### 7. ภารกิจ การประชุม และข้อสั่งการ

เชื่อม traceability: `Meeting → Decision → Mission → Progress/Evidence → Verification`

- Meeting มีวาระ วันเวลา ผู้เกี่ยวข้อง สรุป และผลการประชุม
- Decision มีข้อสั่งการ ผู้สั่ง ทีมที่รับผิดชอบ กำหนดส่ง และ meeting reference
- Mission มีรหัส ประเภท ชื่อ รายละเอียด Session ทีม ผู้รับผิดชอบ พื้นที่ ความเร่งด่วน กำหนดส่ง ความคืบหน้า 0–100 หลักฐาน และสถานะ
- สถานะและ transition ที่ต้องรักษา:
  - intake → assigned
  - assigned → in_progress หรือ blocked
  - in_progress → blocked หรือ completed
  - blocked → assigned หรือ in_progress
  - completed → in_progress หรือ verified
  - verified → completed หรือ closed
  - closed เป็นสถานะปลายทาง
- เฉพาะ admin/commander เปลี่ยนเป็น verified/closed; ทุก mutation ตรวจว่า Session active
- การประชุมที่สร้างทั้ง Decision และ Mission ต้องสำเร็จหรือ rollback พร้อมกัน รวม audit และ notification ภายใน transaction; การส่ง notification ภายนอกใช้ outbox/retry เพื่อไม่ให้ส่งก่อน commit
- ใช้ version หรือ conditional update ตรวจ concurrent change และตอบ conflict เมื่อข้อมูลถูกแก้แล้ว

### 8. โรคและอุบัติเหตุ

โรค: ทะเบียนชนิดโรค รายงานผู้ป่วย/เหตุการณ์ วันข้อมูล หน่วยบริการ หมู่บ้านและพิกัด จำนวนป่วย/เสียชีวิต สรุปรายวัน แนวโน้มเปรียบเทียบช่วงเวลา แผนที่ และ SAT dashboard โดยรองรับ dengue เป็นกรณีเฉพาะ

คำนวณ morbidity = cases/population × 100,000; mortality = deaths/population × 100,000; case fatality = deaths/cases × 100 เมื่อข้อมูลครบและตัวหารมากกว่า 0 ต้องใช้ขอบเขตประชากร พื้นที่ และช่วงเวลาเดียวกัน หากไม่มีตัวหารหรือ scope ไม่ตรงให้คืน null พร้อมเหตุผล ห้ามใช้ประชากรสมมติหรือแทน unknown ด้วยศูนย์

อุบัติเหตุ: บันทึกเหตุ พิกัด วันเวลา บาดเจ็บ/เสียชีวิต ข้อมูลประเภทเหตุที่มีในต้นทาง จุดบริการชั่วคราว สรุปเทศกาลรายวัน และเปรียบเทียบรอบ/ปี โดยจับคู่ช่วงเทศกาลให้เทียบกันได้ ไม่ปะปนคนละ Session

### 9. คลังและทรัพยากร

- จัดการหน่วยบริการ อุปกรณ์ IT และคลังวัสดุ/เวชภัณฑ์ของหน่วยงาน
- Inventory แยก event/Session, หน่วยงาน, รายการ, หน่วยนับ, ยกมา, รับ, จ่าย, ปรับยอด และคงเหลือ
- เก็บ immutable movement ledger: receive/issue/adjust พร้อม balanceBefore/After ผู้ทำรายการ เวลา เหตุผล ทีมผู้ขอ และ Session
- คงเหลือคำนวณจาก ledger และตรวจสอบเทียบ snapshot ได้ ป้องกันยอดติดลบ/การตัดสต็อกพร้อมกันด้วย transaction และ row lock หรือ atomic update
- รองรับ `recorded` กับ `not_recorded`; คงเหลือศูนย์กับยังไม่บันทึกต้องแสดงต่างกัน; รายการที่ไม่ติดตาม movement ต้องแสดงข้อจำกัด
- ใช้ decimal อย่างถูกต้อง ไม่ใช้ floating point โดยไม่กำหนด precision และไม่บันทึกการส่งซ้ำเป็น movement ซ้ำ

### 10. ประชาชนและการสื่อสาร

- หน้าสาธารณะ: สถานการณ์ล่าสุด แผนที่น้ำท่วม/โรค/อุบัติเหตุ ศูนย์พักพิง ประกาศ infographic หน่วยงาน/สายด่วน และสภาพอากาศ
- แจ้งเหตุ: ประเภทภัย รายละเอียด ที่ตั้ง/pin วันเวลา ความเร่งด่วน จำนวนผู้กระทบ ระดับน้ำหรือสถานะเดินทางเมื่อเกี่ยวข้อง และรูปหลายภาพ
- สถานะรับแจ้ง pending/approved/rejected; เจ้าหน้าที่ตรวจและบันทึกเหตุผล ประชาชนดูได้เฉพาะเรื่องตนเอง
- เผยแพร่เฉพาะข้อมูลที่ผ่านการอนุมัติ และใช้ public DTO ที่ตัดชื่อ PID เบอร์โทร และพิกัดบ้านที่ไม่ควรเปิดเผย
- ประกาศมีหมวด ชื่อเรื่อง เนื้อหา รูป/ไฟล์ ช่วงเผยแพร่ สถานะ popup และ Session ที่เกี่ยวข้อง
- รองรับ Telegram notification ผ่าน adapter โดยไม่ทำให้บันทึกเหตุล้มเหลวเมื่อ provider ใช้ไม่ได้ และไม่ส่งข้อมูลส่วนบุคคลเกินจำเป็น

### 11. GIS, Weather และ AI

- ใช้ข้อมูลขอบเขตจังหวัด/อำเภอ/ตำบล/หมู่บ้านและ GeoJSON จากแหล่งข้อมูลที่ระบุ มี layer สถานการณ์ ศูนย์พักพิง หน่วยบริการ และจุดแจ้งเหตุ
- เลือก basemap/layer, filter Session/วัน/พื้นที่, legend, popup, fullscreen และ mobile ได้; map client-only และโหลด boundary ตามความจำเป็น
- GIS ใช้ identifier กลางเชื่อมข้อมูล หลีกเลี่ยง join ด้วยชื่อหมู่บ้านล้วน ๆ และเก็บ provenance/วันอัปเดต/เวอร์ชัน boundary
- เชื่อม GISTDA, weather provider, OSM และ route provider ผ่าน server adapter พร้อม timeout, cache, retry แบบจำกัด, validation และสถานะ unavailable/stale
- แยก observation จากฐานข้อมูล, forecast จาก provider และค่าคำนวณ แสดง source, observedAt/forecastFor/fetchedAt ตามชนิดข้อมูล
- Weather มีตัวเลือกวัน แผนที่ และกราฟตามข้อมูล provider ที่มีจริง ไม่สมมติข้อมูลย้อนหลังหรือ forecast ที่ provider ไม่ได้ให้
- Route advice ระบุความสดของข้อมูลและพื้นที่ที่ทราบผลกระทบ ไม่อ้างว่าเส้นทางปลอดภัยแน่นอนจากการมี route geometry เพียงอย่างเดียว
- AI สรุปได้เฉพาะข้อมูลที่ผู้ใช้มีสิทธิ์ ใช้ allowlisted typed query/service tools และแสดง Session/ช่วงเวลา/แหล่งข้อมูล ห้ามให้ model execute SQL อิสระหรือเขียนฐานข้อมูลโดยตรง
- ไม่ส่ง PID/ข้อมูลผู้ป่วยรายบุคคลเข้า model โดยอัตโนมัติ; provider ไม่พร้อมให้การดูข้อมูลและรายงานหลักยังใช้งานได้

### 12. แบบจำลองข้อมูลและ migration

ส่ง ERD, data dictionary, schema migration ที่สร้างฐานข้อมูลเปล่าได้ครบ และ legacy mapping โดยครอบคลุมกลุ่มต่อไปนี้ ชื่อใหม่เปลี่ยนได้แต่ต้องมี mapping ตรวจสอบได้:

| กลุ่ม | ตาราง/Entity |
|---|---|
| Identity | officers, citizens, auth_sessions, registration_requests |
| EOC | eoc_types, eoc_sessions, eoc_teams, eoc_session_teams, eoc_team_members, eoc_session_commanders |
| Reports | eoc_team_reports, report revisions/history, reporting cycles |
| Operations | missions, mission progress/evidence, meeting_notes, decision_logs |
| Flood | flood_records, affected_persons, vulnerable_group_baselines, session vulnerable groups |
| Shelters | shelter_centers, shelter_activations, shelter_disease_reports |
| Disease/accident | common_diseases, disease_reports, accident_reports, temporary_service_points |
| Resources | health_facilities, it_resources, medical_inventory_events/stock/movements |
| Public | incident_reports, announcements, infographics, agency_contacts |
| Master | areas/boundaries, area_population, area_risk_profiles, route_corridors |
| Platform | file_assets, activity_logs, notifications, outbox, import_runs, backup_runs |

บาง Entity เช่น outbox/import_runs/report revisions เป็นสิ่งเสริมในระบบใหม่ ไม่ได้หมายความว่ามีตารางชื่อเดียวกันในระบบเดิม

- Operational data ต้องมี Session FK; team-specific data ต้องยืนยันว่า team อยู่ใน Session เดียวกันผ่าน composite FK/constraint หรือ transaction validation
- Master data และ baseline ไม่ผูก Session; ศูนย์พักพิงเปิดใช้งานหลายรอบได้ผ่าน activation
- มี createdAt/By, updatedAt/By และ optimistic version ตามความเหมาะสม; หลีกเลี่ยง cascade delete ที่ทำลายประวัติศูนย์และ audit
- กำหนด grain และ unique key ของรายวัน/หมู่บ้านให้ชัดก่อนบังคับ uniqueness ถ้ารองรับหลายครั้งต่อวันต้องกำหนด latest/approved observation ที่ใช้ aggregate
- Population เก็บ male, female, total พร้อม constraint total = male + female, scope `thai/all`, source, sourceUpdatedAt และ nullable referenceYear ห้ามเดาปีเมื่อแหล่งข้อมูลไม่ระบุ
- วันปฏิบัติการใช้ MySQL DATE และ API `YYYY-MM-DD` ตาม Asia/Bangkok; timestamp เก็บ UTC และส่ง ISO 8601 แสดงผลภาษาไทย/พ.ศ. เฉพาะ presentation
- ตัวเลขจำนวนไม่ติดลบ พิกัดถูกช่วง และช่วงวันที่ถูกต้อง; schema JSON ของรายงานต้อง versioned; ตั้ง indexes ตาม Session/date/team/status/area และ query จริง
- ข้อมูล migration/import มี dry-run, validation report, source key, idempotency, mapping FK และสรุปแถวสำเร็จ/ซ้ำ/ผิดพลาด รองรับ CSV/Google Sheets ที่ได้รับอนุญาต ไม่ hardcode URL ส่วนบุคคลหรือ credential
- แยก seed ข้อมูล registry/master ที่เชื่อถือได้จาก demo seed; ห้าม import ข้อมูล production อัตโนมัติเมื่อเปิดเว็บ
- ห้าม `CREATE TABLE`/`ALTER TABLE` ใน request handler; migration ทำผ่านคำสั่งเฉพาะ

### 13. โครงสร้างโค้ดเป้าหมาย

```text
src/
  app/
    (public)/
    (auth)/
    (workspace)/
      commander/
      admin/
      eoc/[eocType]/teams/[teamCode]/
    api/
  features/
    auth/
    eoc/
      sessions/
      teams/
      reports/
      registries/
      resolvers/
    operations/
    flood/
    disease/
    festival-accidents/
    shelters/
    vulnerable-groups/
    inventory/
    incidents/
    announcements/
    geography/
    weather/
    analytics/
    master-data/
  components/ui/
  server/
    db/
    authorization/
    integrations/
    files/
    audit/
  shared/
    contracts/
    date/
    config/
migrations/
scripts/
tests/{unit,integration,e2e}/
docs/
```

ภายใน feature แยก components, schemas, types, service และ repository ตามความจำเป็น ไม่สร้าง abstraction ที่ไม่มีผู้ใช้จริง และไม่รวมทุก feature ไว้ใน component/API ไฟล์ใหญ่ไฟล์เดียว

### 14. API contract

- ใช้ REST, validate route/query/body ด้วย Zod; ใช้ DTO จาก schema ร่วมกัน; pagination/filter/sort มี allowlist
- รูปแบบผลลัพธ์เป็น discriminated union เช่น `{ success: true, data, meta? }` หรือ `{ success: false, error: { code, message, fieldErrors? }, requestId }`
- ใช้ 400 validation, 401 unauthenticated, 403 forbidden, 404 not found, 409 state/version conflict และ 503 dependency unavailable อย่างสม่ำเสมอ
- Error ภาษาไทยที่ผู้ใช้เข้าใจได้ โดยไม่ส่ง stack/SQL/credential ออกไป
- มี OpenAPI หรือเอกสาร endpoint พร้อมตัวอย่าง schema และ auth requirement
- กลุ่ม endpoint หลัก: auth, registrations, sessions, session teams/members/commanders, team reports + submit/review, assignments/inbox/notifications, flood/disease/accidents, missions/meetings/decisions, shelters, inventory/movements, public incidents/announcements, master data/geography/data quality และ health
- คง deep link เดิมที่จำเป็นผ่าน compatibility adapter/redirect พร้อมรายการ deprecated routes; ระบบเดิม `/api/eoc/flood/daily-records` เป็น read-only adapter และ mutation ตอบ 410 ห้ามนำกลับมาเป็นแหล่งเขียนข้อมูลคู่ขนาน

### 15. UI/UX

- ภาษาไทยเป็นหลัก ใช้ศัพท์ตรงงานจริง มี public layout และ workspace layout พร้อม sidebar ตามสิทธิ์
- Dashboard ผู้บัญชาการแสดงสถานการณ์ งานค้าง ภารกิจวิกฤต ความครบถ้วนรายงาน และข้อมูลล่าสุด กดต่อไปยังแหล่งข้อมูลได้
- ทุกหน้ามี loading, empty, error, unauthorized และ mutation feedback; ข้อมูลขาดต้องแสดง “ยังไม่มีข้อมูล” ไม่แทนด้วยตัวเลขหรือกราฟสมมติ
- ส่วนหัวแสดงประเภทภัย เลข Session active/closed และวันข้อมูล; Session ปิดแล้วแสดง read-only สำหรับงานปฏิบัติการ แต่ปุ่มรายงานแสดงตาม capability ของรายงาน
- ตารางค้นหา กรอง เรียง หน้าแบ่ง และ export CSV ภาษาไทยได้ โดย export ใช้สิทธิ์/ตัวกรองเดียวกับหน้าและป้องกัน spreadsheet formula injection
- ฟอร์มแสดง validation ใกล้ field, label ชัด, keyboard navigation, focus ที่เหมาะสม และไม่ใช้สีอย่างเดียวสื่อสถานะ
- รองรับมือถือสำหรับลงพื้นที่และจอใหญ่ในห้องบัญชาการ ไม่แสดง SQL/table/internal error ใน product UI

### 16. ความปลอดภัยและการปฏิบัติการ

- Prepared statements, dynamic SQL identifier allowlist, least-privilege database account, shared pool และ transaction boundary ชัดเจน
- ป้องกัน CSRF สำหรับ cookie mutation, XSS จากเนื้อหาประกาศ, IDOR ข้าม Session/ทีม/เจ้าของ และ brute force พร้อม rate limit ที่รองรับ deployment จริง
- ไฟล์ตรวจขนาด ชนิด MIME และเนื้อหา สุ่มชื่อ ป้องกัน path traversal มี metadata/checksum และตรวจสิทธิ์ download ของไฟล์ภายใน; ไฟล์สาธารณะต้องผ่านการเผยแพร่
- Audit ระบุ action ที่ไม่ว่าง actor, entity, Session/team, old/new, reason, timestamp, request metadata โดย redact password/token/PID และจำกัดการแก้ audit
- `.env.example` ใช้ placeholder เท่านั้น; validate env ตอน startup; public env ไม่มี secret
- Structured logging, health/readiness, error request ID, provider timeout และการแจ้งเตือน failure
- รองรับ Docker/standalone deployment, MySQL, persistent upload storage และ configurable base path โดยค่าเดิมคือ `/stn-eoc`; ทดสอบ asset/API/upload/callback ภายใต้ base path
- Backup เข้ารหัสรวม database และ managed files ตรวจ checksum กู้คืนเข้า target แยก ตรวจ row counts/constraints/files และบันทึกผลจริง ห้ามแสดง restore_verified หากไม่ได้กู้คืนทดสอบ
- อธิบาย runbook และ retention ที่ปรับตามหน่วยงาน ไม่อ้างว่าระบบผ่านข้อกฎหมายหรือ certification จากการมีฟังก์ชันเหล่านี้เพียงอย่างเดียว

### 17. การทดสอบและเกณฑ์รับงาน

ต้องมี unit tests สำหรับ permission policy, registry, schema, state transition, วันที่ไทย, metrics และ inventory arithmetic; integration tests กับ MySQL แยกสำหรับ transaction/constraint/auth; E2E สำหรับโฟลว์หลัก

เกณฑ์ที่ต้องพิสูจน์ได้:

1. สร้างฐานข้อมูลเปล่าจาก migration แล้วเปิดระบบได้ ไม่มี schema mutation ระหว่าง request
2. Login/approve officer/assign team แล้วสมาชิกเข้าทีมตนได้ แต่เปลี่ยน ID ใน URL/API เพื่อเข้าทีมอื่นไม่ได้
3. Team admin/commander และ legacy team roles ไม่ทำให้ได้รับ system privilege โดยอัตโนมัติ
4. เปิด Session → ตั้งทีม/หัวหน้า → บันทึก flood → ดู dashboard/map ได้จากข้อมูลเดียวกัน
5. ปิด Session แล้วทุก operational mutation รวมไฟล์/เส้นทางสำรองถูกปฏิเสธ แต่ยังสร้าง/ส่ง/ตรวจรายงานของช่วงนั้นตามสิทธิ์ได้
6. สมาชิกแก้รายงานผู้อื่นไม่ได้ ส่งรายงานเองไม่ได้; หัวหน้าส่งได้; reviewer ต้อง verified ก่อน approved; returned ต้องมีเหตุผล
7. การสร้าง Meeting/Decision/Mission ล้มเหลวกลางทางแล้ว rollback ครบ และไม่มี notification ภายนอกหลุดก่อน commit
8. ข้อมูลวันเดียวกันคนละ Session ไม่รวมกัน; วันรอยต่อเที่ยงคืนไทยและวันไม่ถูกต้องได้รับการทดสอบ
9. นับหมู่บ้านไม่ซ้ำถูกต้อง ไม่บวก snapshot เป็นคนสะสม; ไม่มี population/scope ไม่ตรงแล้ว rate เป็น null
10. เบิกสต็อกพร้อมกันไม่ติดลบ คำขอซ้ำไม่ตัดยอดซ้ำ และ not_recorded ต่างจาก 0
11. Public API/export ไม่เผยข้อมูลส่วนบุคคลหรือรายงาน pending; ประชาชนดูประวัติผู้อื่นไม่ได้
12. Provider ล้มเหลวแล้วแสดง unavailable/stale ตามจริง และ core workflow ยังทำงานได้
13. เพิ่มทีม/override ผ่าน registry ได้โดยไม่แก้หลายหน้าพร้อมกัน และ navigation ตรงกับ authorization
14. Import ซ้ำไม่เพิ่มข้อมูลซ้ำ พร้อมรายงาน mapping ผิดพลาด และ backup restore test ตรวจข้อมูล/ไฟล์ได้จริง
15. Typecheck, lint, tests และ production build ผ่าน; smoke test ทั้ง root/base path, mobile และ map client hydration

### 18. วิธีลงมือและสิ่งส่งมอบ

แบ่งงานเป็นขั้นที่รันและตรวจได้ แต่ต้องดำเนินการจนได้ขอบเขตที่ตกลง ไม่หยุดเพียง scaffold:

1. สรุป source inventory, feature parity matrix, schema gaps และ decision log
2. วาง TypeScript foundation, database migration, auth/permissions และ shared layout
3. สร้าง EOC Session/teams/assignments/report workflow เป็น vertical slice ที่ทดสอบครบ
4. เพิ่ม flood, shelter, vulnerable groups, operations และ command room
5. เพิ่ม disease, festival accidents, inventory และ public reporting
6. เพิ่ม GIS/weather/notifications/AI adapter, import/export, data quality และ production runbook
7. รัน acceptance tests แก้ข้อผิดพลาด ตรวจ migration/restore และสรุปสิ่งที่พร้อมใช้งานจริง

ส่งมอบ source code, `.env.example`, migrations, registry seed, demo seed แยก, OpenAPI, ERD/data dictionary, role matrix, test results, Docker/config ตัวอย่าง, คู่มือเริ่มต้น/การใช้งาน/สำรองกู้คืน และ legacy migration guide

รายงานให้ชัดว่าอะไร implemented/tested อะไรขึ้นกับ credential/data/provider และอะไรยังไม่เสร็จ ห้ามรายงานว่า feature เสร็จเพียงเพราะมี route หรือเมนู และห้ามนำ placeholder มาแสดงเป็นข้อมูลจริง

เริ่มจากสำรวจ repository และจัดทำ feature parity matrix จากนั้นลงมือสร้างระบบตามลำดับข้างต้น

## จบ prompt
