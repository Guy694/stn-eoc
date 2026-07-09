# 🏗️ สถาปัตยกรรมระบบ EOC แบบยืดหยุ่น
## ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุขจังหวัดสตูล

---

## 📋 สรุปสถาปัตยกรรม

ระบบถูกออกแบบให้รองรับ:
- ✅ **หลายประเภทภัย** (น้ำท่วม, แล้ง, โรคระบาด, สึนามิ, แผ่นดินไหว และภัยใหม่ๆ ในอนาคต)
- ✅ **โครงสร้างเมนูที่แตกต่างกัน** ตามประเภทภัย
- ✅ **การมอบหมายทีมงานแบบยืดหยุ่น** (Dynamic Team Assignment)
- ✅ **เจ้าหน้าที่เปลี่ยนบทบาทได้** ตาม Session และภัย

---

## 🎯 หลักการออกแบบ (Design Principles)

### 1. **Modular Architecture**
แต่ละประเภทภัยเป็น "Module" แยกกัน แต่ใช้ Core Components ร่วมกัน

```
┌──────────────────────────────────────────────┐
│          Core EOC Framework                  │
│  • Session Management                        │
│  • Team Assignment Engine                    │
│  • Permission System                         │
│  • Data Collection Framework                 │
└──────────────────────────────────────────────┘
                    ↓
    ┌───────────────┼───────────────┐
    ↓               ↓               ↓
┌────────┐    ┌──────────┐    ┌──────────┐
│ Flood  │    │ Disease  │    │ Drought  │
│ Module │    │ Module   │    │ Module   │
└────────┘    └──────────┘    └──────────┘
```

### 2. **Configuration-Driven**
ใช้ Configuration แทนการ Hard-code → เพิ่มภัยใหม่ได้โดยไม่แก้โค้ด

### 3. **Role-Based + Team-Based Access Control**
- **Role-Based**: บทบาทถาวรของเจ้าหน้าที่ (admin, staff, MCATT)
- **Team-Based**: บทบาทชั่วคราวในแต่ละ Session (RISKCOM, MCAT, SAT)

---

## 🗂️ โครงสร้างฐานข้อมูล (Database Schema)

### **Layer 1: EOC Type Configuration**

#### ตาราง `eoc_status`
กำหนดประเภทภัยที่มีในระบบ
```sql
eoc_type (PK)   | name_th        | name_en      | icon | color_primary
----------------|----------------|--------------|------|---------------
flood           | น้ำท่วม        | Flood        | 💧   | blue
drought         | ภัยแล้ง        | Drought      | 🌵   | orange
disease         | โรคระบาด      | Disease      | 🦠   | red
tsunami         | คลื่นสึนามิ    | Tsunami      | 🌊   | cyan
earthquake      | แผ่นดินไหว     | Earthquake   | 🏚️   | brown
```

#### ตาราง `eoc_type_modules`
กำหนดเมนู/โมดูลสำหรับแต่ละประเภทภัย
```sql
id | eoc_type | module_code    | module_name_th        | module_type | route_path
---|----------|----------------|-----------------------|-------------|-------------------
1  | flood    | flood_map      | แผนที่น้ำท่วม          | map         | /eoc/flood/map
2  | flood    | daily_report   | รายงานประจำวัน        | data_entry  | /eoc/flood/daily
3  | flood    | shelter_mgmt   | จัดการศูนย์พักพิง     | data_entry  | /eoc/flood/shelters
4  | disease  | disease_map    | แผนที่โรคระบาด        | map         | /eoc/disease/map
5  | disease  | patient_report | รายงานผู้ป่วย         | data_entry  | /eoc/disease/patients
6  | disease  | epidemiology   | ข้อมูลระบาดวิทยา      | analytics   | /eoc/disease/epi
```

**ข้อดี:**
- ✅ เพิ่มเมนูใหม่ได้โดยไม่แก้โค้ด
- ✅ แต่ละภัยมีเมนูที่เหมาะสม (น้ำท่วม ≠ โรคระบาด)

---

### **Layer 2: Session Management**

#### ตาราง `eoc_sessions`
เก็บการเปิด-ปิด EOC แต่ละครั้ง
```sql
id | eoc_type | session_number | opened_at  | closed_at  | status
---|----------|----------------|------------|------------|--------
27 | flood    | 2              | 2025-12-24 | NULL       | active
28 | drought  | 4              | 2025-12-25 | 2025-12-29 | closed
```

**หมายเหตุ:** 
- Session เป็นหน่วยของการทำงาน EOC แต่ละครั้ง
- สามารถมีหลาย Session เปิดพร้อมกัน (flood + disease)

---

### **Layer 3: Dynamic Team Assignment**

#### ตาราง `eoc_teams`
กำหนดทีมงานที่มีในระบบ EOC
```sql
id | team_code | team_name_th              | icon | color
---|-----------|---------------------------|------|-------
1  | RISKCOM   | ฝ่ายประชาสัมพันธ์         | 📢   | purple
2  | MCAT      | ทีมประเมินสถานการณ์       | 📊   | blue
3  | SAT       | ทีมค้นหาและกู้ภัย          | 🚑   | red
4  | SeRHT     | ทีมกู้ภัยทางอากาศ         | 🚁   | orange
5  | MEDICAL   | ทีมแพทย์และสาธารณสุข      | ⚕️   | green
6  | LOGISTICS | ทีมลำเลียง                | 📦   | yellow
7  | SHELTER   | ทีมศูนย์พักพิง             | 🏕️   | teal
```

#### ตาราง `eoc_session_teams`
กำหนดว่า Session ใดใช้ทีมอะไร
```sql
id | eoc_session_id | team_id | team_lead_officer_id | assigned_by
---|----------------|---------|---------------------|-------------
1  | 27             | 1       | 2                   | 1 (admin)
2  | 27             | 2       | 4                   | 1 (admin)
3  | 28             | 5       | 10                  | 1 (admin)
```

**ตัวอย่าง:**
- Session 27 (flood ครั้งที่ 2) ใช้ทีม RISKCOM + MCAT
- Session 28 (drought ครั้งที่ 4) ใช้แค่ทีม MEDICAL

#### ตาราง `eoc_team_members`
กำหนดสมาชิกในแต่ละทีมของ Session
```sql
id | session_team_id | officer_id | role_in_team  | is_active
---|-----------------|------------|---------------|----------
1  | 1               | 2          | หัวหน้าทีม    | TRUE
2  | 1               | 5          | สมาชิก        | TRUE
3  | 1               | 8          | สมาชิก        | FALSE (ถอดออก)
4  | 2               | 4          | หัวหน้าทีม    | TRUE
```

**ข้อดี:**
- ✅ เจ้าหน้าที่คนเดียวสามารถอยู่หลายทีมได้
- ✅ เปลี่ยนทีมกลางคันได้ (`is_active`)
- ✅ มอบหมายทีมแตกต่างกันในแต่ละ Session

---

## 🔐 ระบบสิทธิ์ (Permission System)

### **2-Level Permission Model**

#### Level 1: Role-Based (Static)
บทบาทถาวรของเจ้าหน้าที่ในระบบ
```
admin    → เข้าถึงทุกอย่าง
staff    → เข้าถึงพื้นฐาน (ไม่รวมจัดการทรัพยากร)
MCATT    → เหมือน staff
SAT      → เหมือน staff
SeRHT    → เหมือน staff
```

#### Level 2: Team-Based (Dynamic)
สิทธิ์ตามทีมที่ได้รับมอบหมายใน Session

**ตาราง `module_permissions`**
```sql
module_id | team_id | can_view | can_create | can_edit | can_delete | can_approve
----------|---------|----------|------------|----------|------------|------------
1 (map)   | 2(MCAT) | TRUE     | TRUE       | TRUE     | FALSE      | FALSE
2 (report)| 2(MCAT) | TRUE     | TRUE       | TRUE     | FALSE      | FALSE
2 (report)| 1(RISK) | TRUE     | FALSE      | FALSE    | FALSE      | TRUE
```

**ตัวอย่างการใช้งาน:**
```javascript
// ตรวจสอบว่าเจ้าหน้าที่สามารถสร้างรายงานได้หรือไม่
function canCreateReport(officerId, sessionId, moduleCode) {
  // 1. ตรวจสอบว่าเจ้าหน้าที่อยู่ในทีมของ Session นี้หรือไม่
  const teamMembership = getUserTeam(officerId, sessionId);
  
  // 2. ตรวจสอบสิทธิ์ของทีมกับ module
  const permission = getModulePermission(moduleCode, teamMembership.teamId);
  
  return permission.can_create === true;
}
```

---

## 🎨 การทำงานของระบบ (Workflow)

### **Scenario 1: เปิด EOC น้ำท่วมครั้งที่ 3**

```
1. Admin เปิด EOC (eoc_type='flood', session_number=3)
   ↓
2. ระบบสร้าง eoc_sessions record (id=29, status='active')
   ↓
3. Admin มอบหมายทีม:
   - RISKCOM (หัวหน้าทีม: นายสมชาย)
   - MCAT (หัวหน้าทีม: นางสาวสมหญิง)
   - SAT (หัวหน้าทีม: ร.ต.ประเสริฐ)
   ↓
4. ระบบสร้าง eoc_session_teams (3 records)
   ↓
5. Admin เพิ่มสมาชิกในแต่ละทีม
   ↓
6. ระบบโหลด modules ของ 'flood' จาก eoc_type_modules
   - แผนที่น้ำท่วม (ทีม MCAT, RISKCOM เข้าถึงได้)
   - รายงานประจำวัน (ทีม MCAT สร้างได้, RISKCOM อนุมัติได้)
   - จัดการศูนย์พักพิง (ทีม SHELTER จัดการ)
   ↓
7. เจ้าหน้าที่แต่ละทีมเข้าใช้งาน module ตามสิทธิ์
```

### **Scenario 2: เปิด EOC โรคระบาดพร้อมกับน้ำท่วม**

```
Session 29 (flood) - active
  ├─ RISKCOM (นายสมชาย + 3 คน)
  ├─ MCAT (นางสาวสมหญิง + 5 คน)
  └─ SAT (ร.ต.ประเสริฐ + 8 คน)

Session 30 (disease) - active
  ├─ MEDICAL (นพ.สุรชัย + 6 คน)
  ├─ RISKCOM (นางสมศรี + 2 คน)  ← คนละคนกับ flood
  └─ MCAT (นายสมศักดิ์ + 4 คน)  ← คนละคนกับ flood
```

**ข้อดี:**
- ✅ เปิดได้พร้อมกัน
- ✅ ใช้คนต่างกันในแต่ละ Session
- ✅ เมนู/โมดูลต่างกัน (flood มีศูนย์พักพิง, disease มีระบาดวิทยา)

---

## 📱 ตัวอย่าง UI/UX

### **1. หน้า Admin: จัดการ EOC Session**

```
┌─────────────────────────────────────────────────────┐
│ 🚨 จัดการ EOC Sessions                              │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📊 Active Sessions (2)                             │
│                                                     │
│ [💧 น้ำท่วม #29] เปิดเมื่อ: 2026-01-09 10:00     │
│   ทีมงาน: RISKCOM, MCAT, SAT                       │
│   [📋 จัดการทีม] [📊 ดูข้อมูล] [❌ ปิด EOC]       │
│                                                     │
│ [🦠 โรคระบาด #30] เปิดเมื่อ: 2026-01-09 14:30    │
│   ทีมงาน: MEDICAL, RISKCOM, MCAT                   │
│   [📋 จัดการทีม] [📊 ดูข้อมูล] [❌ ปิด EOC]       │
│                                                     │
│ [➕ เปิด EOC ใหม่]                                 │
└─────────────────────────────────────────────────────┘
```

### **2. หน้า Staff: Dashboard ตามสิทธิ์**

**กรณี: นางสาวสมหญิง (อยู่ในทีม MCAT ของ flood #29)**

```
┌─────────────────────────────────────────────────────┐
│ 👤 นางสาวสมหญิง | ทีม: MCAT                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📌 EOC ที่คุณรับผิดชอบ:                            │
│                                                     │
│ [💧 น้ำท่วม #29] - ทีม MCAT (หัวหน้าทีม)          │
│   ├─ 🗺️ แผนที่น้ำท่วม          [เปิด]             │
│   ├─ 📝 รายงานประจำวัน          [เปิด]             │
│   └─ 🏕️ จัดการศูนย์พักพิง      [ดูอย่างเดียว]     │
│                                                     │
│ ❌ ไม่มี Session อื่นที่คุณรับผิดชอบ                │
│                                                     │
└─────────────────────────────────────────────────────┘
```

**กรณี: นพ.สุรชัย (อยู่ในทีม MEDICAL ของ disease #30)**

```
┌─────────────────────────────────────────────────────┐
│ 👤 นพ.สุรชัย | ทีม: MEDICAL                         │
├─────────────────────────────────────────────────────┤
│                                                     │
│ 📌 EOC ที่คุณรับผิดชอบ:                            │
│                                                     │
│ [🦠 โรคระบาด #30] - ทีม MEDICAL (หัวหน้าทีม)     │
│   ├─ 🗺️ แผนที่โรคระบาด        [เปิด]              │
│   ├─ 🏥 รายงานผู้ป่วย           [เปิด]             │
│   ├─ 📈 ข้อมูลระบาดวิทยา        [เปิด]             │
│   └─ 💉 มาตรการสาธารณสุข        [เปิด]             │
│                                                     │
└─────────────────────────────────────────────────────┘
```

---

## 🛠️ การเพิ่มภัยใหม่ (Adding New EOC Type)

### **ตัวอย่าง: เพิ่มภัย "อัคคีภัย (Fire)"**

#### **ขั้นตอนที่ 1: เพิ่มประเภทภัยใหม่**

```sql
-- 1. เพิ่ม enum ใหม่
ALTER TABLE eoc_status 
MODIFY COLUMN eoc_type ENUM('flood','drought','tsunami','earthquake','disease','fire');

-- 2. เพิ่มข้อมูล EOC Type
INSERT INTO eoc_status (eoc_type, name_th, name_en, icon, color_primary, color_gradient)
VALUES ('fire', 'อัคคีภัย', 'Fire', '🔥', 'red', 'from-red-500 to-orange-600');
```

#### **ขั้นตอนที่ 2: กำหนด Modules**

```sql
-- เพิ่ม Modules สำหรับ fire
INSERT INTO eoc_type_modules (eoc_type, module_code, module_name_th, module_name_en, module_type, route_path, icon) VALUES
('fire', 'fire_map', 'แผนที่ไฟไหม้', 'Fire Map', 'map', '/eoc/fire/map', '🔥'),
('fire', 'fire_incident', 'รายงานเหตุเพลิงไหม้', 'Fire Incident Report', 'data_entry', '/eoc/fire/incident', '📝'),
('fire', 'fire_resources', 'ทรัพยากรดับเพลิง', 'Fire Resources', 'data_entry', '/eoc/fire/resources', '🚒'),
('fire', 'evacuation', 'การอพยพประชาชน', 'Evacuation', 'report', '/eoc/fire/evacuation', '🏃');
```

#### **ขั้นตอนที่ 3: กำหนดทีมและสิทธิ์**

```sql
-- กำหนดว่า Module ไหนใช้ทีมอะไร
-- เช่น แผนที่ไฟไหม้ ใช้ทีม SAT + RISKCOM
INSERT INTO module_permissions (module_id, team_id, can_view, can_create, can_edit)
SELECT 
  (SELECT id FROM eoc_type_modules WHERE module_code='fire_map' AND eoc_type='fire'),
  (SELECT id FROM eoc_teams WHERE team_code='SAT'),
  TRUE, TRUE, TRUE;
```

#### **ขั้นตอนที่ 4: อัพเดท Frontend Config**

```javascript
// lib/disasterConfig.jsx
export const DISASTER_CONFIG = {
  // ... existing configs
  fire: {
    id: 'fire',
    name: 'อัคคีภัย',
    nameEn: 'Fire',
    icon: '🔥',
    color: {
      primary: 'red',
      gradient: 'from-red-500 to-orange-600'
    },
    routes: {
      main: '/eoc/fire',
      map: '/eoc/fire/map'
    }
  }
};
```

**เสร็จแล้ว!** ระบบพร้อมใช้งานภัยใหม่ทันที

---

## 🔄 การเปลี่ยนบทบาทเจ้าหน้าที่

### **Scenario: นายสมชายเปลี่ยนจากทีม RISKCOM → MCAT**

```sql
-- 1. ปิดการเป็นสมาชิกทีมเดิม
UPDATE eoc_team_members 
SET is_active = FALSE, 
    removed_at = NOW(),
    removed_by = 1  -- admin
WHERE officer_id = 5  -- นายสมชาย
  AND session_team_id = (
    SELECT id FROM eoc_session_teams 
    WHERE eoc_session_id = 29 
      AND team_id = (SELECT id FROM eoc_teams WHERE team_code='RISKCOM')
  );

-- 2. เพิ่มเข้าทีมใหม่
INSERT INTO eoc_team_members (session_team_id, officer_id, role_in_team, assigned_by)
VALUES (
  (SELECT id FROM eoc_session_teams 
   WHERE eoc_session_id = 29 
     AND team_id = (SELECT id FROM eoc_teams WHERE team_code='MCAT')),
  5,  -- นายสมชาย
  'สมาชิก',
  1   -- admin
);
```

**ผลลัพธ์:**
- ✅ นายสมชายสูญเสียสิทธิ์เมนู RISKCOM
- ✅ ได้รับสิทธิ์เมนู MCAT ทันที
- ✅ มี History การเปลี่ยนทีม

---

## 📊 Views สำหรับการดึงข้อมูล

### **View 1: ดูว่า Session ใดใช้ทีมอะไร**

```sql
SELECT * FROM vw_session_team_summary WHERE session_id = 29;
```

**ผลลัพธ์:**
```
session_id | eoc_type | team_code | team_name_th              | team_lead_name | member_count
-----------|----------|-----------|---------------------------|----------------|-------------
29         | flood    | RISKCOM   | ฝ่ายประชาสัมพันธ์         | นายสมชาย       | 3
29         | flood    | MCAT      | ทีมประเมินสถานการณ์       | นางสาวสมหญิง   | 5
29         | flood    | SAT       | ทีมค้นหาและกู้ภัย          | ร.ต.ประเสริฐ   | 8
```

### **View 2: ดูว่าเจ้าหน้าที่อยู่ทีมไหนของ Session ใด**

```sql
SELECT * FROM vw_officer_team_assignments 
WHERE officer_id = 5 AND session_status = 'active';
```

**ผลลัพธ์:**
```
officer_id | full_name  | session_id | eoc_type | team_code | role_in_team | is_active
-----------|------------|------------|----------|-----------|--------------|----------
5          | นายสมชาย   | 29         | flood    | MCAT      | สมาชิก       | TRUE
```

---

## 🎓 Best Practices

### **1. การมอบหมายทีม**
- ✅ มอบหมายทีมตอนเปิด Session
- ✅ แต่ละทีมควรมีหัวหน้าทีมชัดเจน
- ✅ บันทึกเหตุผลการมอบหมาย/เปลี่ยนทีม

### **2. การออกแบบ Module**
- ✅ Module ควรมีหน้าที่เฉพาะเจาะจง
- ✅ กำหนด `required_teams` ใน JSON config
- ✅ ใช้ `form_config` สำหรับฟอร์ม dynamic

### **3. การจัดการ Permission**
- ✅ Admin มีสิทธิ์เต็มเสมอ
- ✅ ทีมอื่นต้องกำหนดสิทธิ์ใน `module_permissions`
- ✅ ใช้ `can_approve` สำหรับ workflow อนุมัติ

### **4. การเพิ่มภัยใหม่**
1. เพิ่ม enum ในตาราง
2. เพิ่มข้อมูล eoc_status
3. สร้าง modules ที่เหมาะสม
4. กำหนดสิทธิ์ทีม
5. อัพเดท frontend config

---

## 🔗 ไฟล์ที่เกี่ยวข้อง

### **Database**
- `create_eoc_team_system.sql` - สร้างโครงสร้างทีมงาน
- `create_eoc_types_table.sql` - สร้างตาราง eoc_status
- `stneoc.sql` - Database schema หลัก

### **Frontend**
- `lib/disasterConfig.jsx` - Configuration ประเภทภัย
- `components/DisasterDashboard.jsx` - Dashboard แสดงทุกภัย
- `components/DisasterSessionSelector.jsx` - เลือก Session
- `context/EOCContext.jsx` - จัดการ state ของ EOC

### **Backend API**
- `app/api/eoc/[type]/sessions-summary/route.js` - API สรุปข้อมูล Session
- `app/api/admin/eoc-types/route.js` - API จัดการประเภทภัย

---

## 📞 สรุป

ระบบนี้ออกแบบให้:
1. **ยืดหยุ่น** - เพิ่มภัยใหม่ได้ง่าย
2. **Scalable** - รองรับหลาย Session พร้อมกัน
3. **ปลอดภัย** - ระบบสิทธิ์แบบ 2 ชั้น
4. **ใช้งานง่าย** - UI/UX ปรับตามบทบาท
5. **Maintainable** - โครงสร้างโค้ดชัดเจน

---

**เอกสารนี้อัพเดทล่าสุด:** 9 มกราคม 2026  
**ผู้จัดทำ:** GitHub Copilot (Claude Sonnet 4.5)
