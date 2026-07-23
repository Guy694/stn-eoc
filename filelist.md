# รายการไฟล์ที่อาจลบได้ในอนาคต

วันที่ตรวจสอบ: 23 กรกฎาคม 2026

เอกสารนี้รวบรวมไฟล์ที่ไม่พบการใช้งานในระบบปัจจุบัน เพื่อใช้ตรวจสอบและลบในอนาคตเท่านั้น ห้ามลบอัตโนมัติโดยไม่ตรวจสอบ import, URL, ฐานข้อมูล และการใช้งานจากระบบภายนอกอีกครั้ง

## 1. ไฟล์ตกค้างที่มีความมั่นใจสูง

ไฟล์กลุ่มนี้ไม่พบการอ้างอิงจาก source code และไม่จำเป็นต่อ Next.js runtime

- `.DS_Store`
- `public/.DS_Store`
- `lib/disasterConfig.jsx.backup`
- `public/file.svg`
- `public/globe.svg`
- `public/next.svg`
- `public/vercel.svg`
- `public/window.svg`
- `public/img/crisis.png`

ไฟล์ต่อไปนี้ไม่พบการอ้างอิงจาก source code และไม่พบชื่อไฟล์ในคอลัมน์ข้อความหรือ JSON ของฐานข้อมูล ณ วันที่ตรวจสอบ

- `public/uploads/announcements/1783322240820-bc416b88dced0f84daf8762d.jpg`

ก่อนลบไฟล์ใน `public/uploads` ต้องตรวจฐานข้อมูลและระบบจัดเก็บไฟล์อีกครั้งเสมอ เพราะอาจมีการสร้างข้อมูลอ้างอิงใหม่หลังวันที่ตรวจสอบ

## 2. Components ที่ไม่อยู่ใน Runtime Import Graph

ไม่พบ entry point, page, route, layout หรือ component ที่ใช้งานไฟล์ต่อไปนี้ในระบบปัจจุบัน

- `components/AccidentMap.jsx`
- `components/DailyFloodTimeline.jsx`
- `components/DisasterDashboard.jsx`
- `components/DisasterMap.jsx`
- `components/DisasterSessionSelector.jsx`
- `components/DiseaseSummaryCards.jsx`
- `components/EOCTypeChart.jsx`
- `components/EmergencyHotline.jsx`
- `components/EmptyState.jsx`
- `components/ErrorMessage.jsx`
- `components/FullscreenMapWrapper.jsx`
- `components/HelpButton.jsx`
- `components/LiveUpdatesFeed.jsx`
- `components/SessionStats.jsx`
- `components/SkeletonLoader.jsx`
- `components/StatCard.jsx`
- `components/SuccessMessage.jsx`
- `components/UserEOCDashboard.jsx`
- `components/common/AnimatedCounter.jsx`
- `components/common/Breadcrumb.jsx`
- `components/ui/card.jsx`
- `components/ui/chart.jsx`

## 3. Data และ Library ที่ไม่ใช้ใน Runtime

- `data/satunData.jsx`
  - ปัจจุบันถูก import เฉพาะจาก `components/DisasterMap.jsx` ซึ่งไม่ได้ใช้งาน
- `lib/safeFetch.js`
  - ไม่พบการ import จาก runtime หรือ scripts
- `lib/sessionMiddleware.js`
  - ไม่พบการ import หรือการกำหนดเป็น Next.js middleware
- `lib/encryption.js`
  - ไม่ใช้ใน runtime แต่ยังถูกใช้โดย `__tests__/lib/encryption.test.js`
  - ห้ามลบจนกว่าจะตัดสินใจยกเลิกชุดทดสอบหรือยืนยันว่าไม่มีแผนใช้การเข้ารหัส PID

## 4. โครงสร้าง EOC ที่ยังไม่เชื่อมกับ Runtime

ไฟล์กลุ่มนี้อาจเป็นโครงสร้างที่เตรียมไว้สำหรับการพัฒนาในอนาคต ควรตรวจ roadmap และเอกสารสถาปัตยกรรมก่อนลบ

- `src/features/eoc/eoc-types/dengue/sat/config.js`
- `src/features/eoc/eoc-types/dengue/sat/index.js`
- `src/features/eoc/eoc-types/dengue/shared/config.js`
- `src/features/eoc/eoc-types/flood/sat/index.js`
- `src/features/eoc/eoc-types/flood/shared/config.js`
- `src/features/eoc/eoc-types/registry.js`
- `src/features/eoc/registries/navigation.registry.js`
- `src/features/eoc/registries/team-module.registry.js`
- `src/features/eoc/resolvers/navigation.resolver.js`
- `src/features/eoc/resolvers/team-module.resolver.js`
- `src/features/eoc/teams/it/config.js`
- `src/features/eoc/teams/it/index.js`
- `src/features/eoc/teams/it/permissions/it.permissions.js`
- `src/features/eoc/teams/riskcom/config.js`
- `src/features/eoc/teams/riskcom/index.js`
- `src/features/eoc/teams/riskcom/permissions/riskcom.permissions.js`
- `src/features/eoc/teams/sat/config.js`
- `src/features/eoc/teams/sat/index.js`
- `src/features/eoc/teams/sat/permissions/sat.permissions.js`
- `src/features/eoc/teams/sat/schemas/sat.schema.js`
- `src/features/eoc/teams/sat/services/sat.service.js`

## 5. ไฟล์ที่ไม่มีผู้เรียกภายใน แต่ยังไม่ควรลบ

- `app/api/eoc/flood/daily-records/route.js`
  - เป็น deprecated API และไม่พบผู้เรียกจาก frontend
  - ยังเป็น URL ที่ระบบภายนอกอาจเรียกโดยตรง จึงต้องตรวจ access log และผู้ใช้งาน API ก่อนลบ
- `migrations/*.sql`
  - เป็นประวัติและคำสั่งปรับโครงสร้างฐานข้อมูล
- `scripts/*.js` และ `scripts/*.mjs`
  - บางไฟล์เป็นคำสั่งดูแลระบบหรือนำเข้าข้อมูลที่เรียกด้วยตนเอง
- `prompter/*`, `docs/*`, `database/*.sql`
  - เป็นเอกสาร ข้อกำหนด และข้อมูลสำหรับกู้คืนหรือตรวจสอบระบบ

## ขั้นตอนตรวจสอบก่อนลบ

1. ค้นหา import และชื่อไฟล์ทั้งโครงการด้วย `rg`
2. ตรวจ dynamic import, URL รูปภาพ และ path ที่ประกอบจากตัวแปร
3. สำหรับไฟล์ใน `public/uploads` ให้ค้นหา path ในฐานข้อมูลทุกตาราง
4. สำหรับ API route ให้ตรวจ access log และระบบภายนอกที่เชื่อมต่อ
5. ย้ายไฟล์ไป branch cleanup แยกต่างหาก
6. รัน `npm test -- --runInBand`
7. รัน `npm run lint`
8. รัน `npm run build`
9. ทดสอบหน้าหลัก หน้า EOC หน้าแอดมิน และการเข้าสู่ระบบ
10. ลบถาวรเมื่อผ่านการตรวจสอบและเก็บ commit ที่สามารถย้อนกลับได้แล้ว

## บันทึกการทบทวน

| วันที่ | ผู้ตรวจสอบ | ผลการตรวจสอบ | การดำเนินการ |
|---|---|---|---|
| 23 กรกฎาคม 2026 | Codex | จัดทำรายการเริ่มต้นจาก static import graph, source reference และฐานข้อมูล | ยังไม่ลบไฟล์ |

