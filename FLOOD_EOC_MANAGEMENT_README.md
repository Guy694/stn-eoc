# Officer EOC Management Dashboard - Flood Module

ระบบนี้เติมชั้นหลังบ้านสำหรับเจ้าหน้าที่ EOC น้ำท่วม โดยไม่แทนที่หน้าทำงานเดิมของระบบ

## เช็กระบบเดิมก่อนสร้าง

ระบบเดิมมีส่วนต่อไปนี้อยู่แล้ว:

- `eoc_sessions` สำหรับเปิด/ปิด EOC session
- `eoc_session_teams` และ `eoc_teams` สำหรับทีมใน session
- หน้า flood overview, flood map, flood records, shelters, affected persons
- API dashboard เดิมที่รวมข้อมูลผู้ประสบภัย, โรค, ศูนย์พักพิง, IT resources

ส่วนที่เติมเพิ่มตามคำสั่ง:

- Daily Reporting Cycle ก่อนเวลา 15:00 น.
- Team Daily Inputs และ Data Completeness Matrix
- Command Room Daily Briefing Dashboard
- Team Workspace และแบบฟอร์มรายทีม
- Decision Queue / Decision Log
- Mission Tracking Kanban
- Meeting Notes & Orders
- Report Generator สำหรับ Daily Situation Report และ Session Summary Report
- Mock Data และ schema ใหม่ที่พร้อมต่อ DB จริง

## เส้นทางหน้าเว็บ

- `/stn-eoc/eoc/flood/management`
- `/stn-eoc/eoc/flood/management/daily`
- `/stn-eoc/eoc/flood/management/command-room`
- `/stn-eoc/eoc/flood/management/team-workspace`
- `/stn-eoc/eoc/flood/management/completeness`
- `/stn-eoc/eoc/flood/management/forms`
- `/stn-eoc/eoc/flood/management/missions`
- `/stn-eoc/eoc/flood/management/meetings`
- `/stn-eoc/eoc/flood/management/decisions`
- `/stn-eoc/eoc/flood/management/reports`

## API และข้อมูลจำลอง

- API mock: `/stn-eoc/api/eoc/flood/management`
- Mock seed: `data/eoc-flood-management.json`
- Service/generator: `lib/eocFloodManagement.js`
- Schema: `migrations/create_flood_eoc_management.sql`

Mock ครอบคลุม:

- 1 Flood EOC Session
- Reporting Cycle 5 วัน
- 7 อำเภอ
- จุดน้ำท่วม 30 จุด
- ถนนปิด 15 จุด
- ศูนย์พักพิง 12 แห่ง
- หน่วยบริการสุขภาพ 20 แห่ง
- ภารกิจ 40 รายการ
- Missing Data อย่างน้อย 10 รายการ
- Decision Log 8 รายการ
- Meeting Notes 5 วัน
- Daily Situation Report 5 วัน

## Icon System

เพิ่ม `lucide-react` และปรับเมนูหลัก `components/Sidebar.jsx` ให้ใช้ Lucide icon แทน emoji/string icon สำหรับรายการเมนูหลัก รวมถึงเมนูใหม่ “จัดการ EOC น้ำท่วม”

## การต่อ API/Database จริง

หน้า UI ตอนนี้ใช้ mock service เพื่อให้รันได้ทันที ส่วน API route เตรียมไว้เป็น proxy boundary แล้ว เมื่อต่อ database จริงให้:

1. รัน migration `migrations/create_flood_eoc_management.sql`
2. เปลี่ยน `app/api/eoc/flood/management/route.js` ให้ query จากตารางจริง
3. คง response shape ให้ตรงกับ `getFloodEocManagementData`
4. ผูกปุ่ม submit/review/approve กับ `team_daily_inputs`, `missions`, `meeting_notes`, `decision_logs`
5. เพิ่ม Audit Log ทุก action ที่แก้ข้อมูลหลัง 15:00 น.
