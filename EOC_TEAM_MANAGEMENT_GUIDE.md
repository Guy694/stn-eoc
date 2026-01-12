# 📋 คู่มือการจัดการทีมงาน EOC

## 🎯 ภาพรวม

ระบบจัดการทีมงาน EOC รองรับการมอบหมายทีมงานและสมาชิกแยกตาม **Session** เพื่อให้แต่ละครั้งที่เปิด EOC สามารถกำหนดทีมงานได้อิสระ

**สถานการณ์ตัวอย่าง:**
- 🌊 **น้ำท่วม Session 1** (มกราคม 2026): นายกาย เป็นสมาชิกทีม MCAT
- 🌊 **น้ำท่วม Session 2** (มีนาคม 2026): นายกายไม่ได้ถูกมอบหมายอัตโนมัติ ต้องแต่งตั้งใหม่

✅ ระบบรองรับการทำงานแบบนี้แล้ว - แต่ละ session มีทีมงานแยกกัน

---

## 🏗️ โครงสร้างระบบ

### 1. ตารางฐานข้อมูล

```
eoc_teams (ทีมงานหลัก - 8 ทีม)
├── RISKCOM (ฝ่ายประชาสัมพันธ์) 📢
├── MCAT (ทีมประเมินสถานการณ์) 📊
├── SAT (ทีมค้นหาและกู้ภัย) 🚑
├── SeRHT (ทีมกู้ภัยทางอากาศ) 🚁
├── MEDICAL (ทีมแพทย์และสาธารณสุข) ⚕️
├── LOGISTICS (ทีมลำเลียง) 📦
├── SHELTER (ทีมศูนย์พักพิง) 🏕️
└── ITSUPPORT (ทีมสนับสนุนด้านเทคโนโลยี) 💻

eoc_session_teams (การมอบหมายทีมให้ Session)
├── eoc_session_id → อ้างอิงถึง session ที่เปิด
├── team_id → อ้างอิงถึงทีมใน eoc_teams
├── team_lead_officer_id → หัวหน้าทีมในครั้งนี้
└── is_active → สถานะการใช้งาน

eoc_team_members (สมาชิกในทีม)
├── session_team_id → อ้างอิงถึง eoc_session_teams
├── officer_id → เจ้าหน้าที่
├── role_in_team → บทบาท (หัวหน้า, รองหัวหน้า, สมาชิก)
└── is_active → สถานะการใช้งาน
```

### 2. การทำงานของระบบ

```
เปิด EOC ใหม่ (Session 7)
        ↓
ยังไม่มีทีมงาน (0 teams, 0 members)
        ↓
Admin เข้าไปจัดการทีมงาน
        ↓
เพิ่มทีม MCAT, SAT, RISKCOM
        ↓
เพิ่มสมาชิกในแต่ละทีม
        ↓
เจ้าหน้าที่ที่ได้รับมอบหมายจะเห็นสิทธิ์ใน session นี้เท่านั้น
```

---

## 📖 วิธีการใช้งาน

### ขั้นตอนที่ 1: เปิด EOC Session

1. ไปที่ **Admin → จัดการศูนย์ EOC** (`/admin/eoc-management`)
2. เลือก EOC ที่ต้องการ (เช่น น้ำท่วม)
3. คลิก **🟢 เปิด EOC**
4. ระบุเหตุผลในการเปิด
5. ระบบจะสร้าง Session ใหม่โดยอัตโนมัติ

### ขั้นตอนที่ 2: จัดการทีมงาน

1. หลังจากเปิด EOC แล้ว จะมีปุ่ม **👥 จัดการทีมงาน** ปรากฏขึ้น
2. คลิกปุ่มเพื่อเข้าสู่หน้าจัดการทีม (`/admin/eoc-sessions/{sessionId}/teams`)

### ขั้นตอนที่ 3: เพิ่มทีมให้ Session

1. คลิกปุ่ม **➕ เพิ่มทีมงาน**
2. เลือกทีมที่ต้องการ (เช่น MCAT, SAT, RISKCOM)
3. เลือกหัวหน้าทีม (ถ้ามี)
4. คลิก **บันทึก**

### ขั้นตอนที่ 4: เพิ่มสมาชิกในทีม

1. ในแต่ละทีมที่เพิ่มแล้ว คลิก **➕ เพิ่มสมาชิก**
2. เลือกเจ้าหน้าที่จากรายชื่อ
3. ระบุบทบาท (หัวหน้าทีม / รองหัวหน้าทีม / สมาชิก)
4. คลิก **บันทึก**

### ขั้นตอนที่ 5: จัดการสิทธิ์การเข้าถึง

ระบบจะอนุญาตให้เจ้าหน้าที่เข้าถึง **เฉพาะ Session ที่ถูกมอบหมาย** เท่านั้น

**ตัวอย่าง:**
- นายกาย ถูกเพิ่มใน Session 1 → เห็นข้อมูล Session 1
- Session 2 เปิดขึ้นมาใหม่ → นายกาย**ไม่มีสิทธิ์** จนกว่าจะถูกแต่งตั้งใหม่
- Admin ต้องเพิ่มนายกายในทีม Session 2 อีกครั้ง

---

## 🔐 การตรวจสอบสิทธิ์

### API สำหรับตรวจสอบสิทธิ์เจ้าหน้าที่

```javascript
// ตรวจสอบว่าเจ้าหน้าที่มีสิทธิ์ใน Session นี้หรือไม่
GET /api/eoc/sessions/{sessionId}/teams

// ผลลัพธ์
{
  "success": true,
  "userTeams": [
    {
      "team_code": "MCAT",
      "team_name_th": "ทีมประเมินสถานการณ์",
      "role_in_team": "สมาชิก"
    }
  ],
  "hasAccess": true
}
```

### ตรวจสอบใน Component

```javascript
// ตัวอย่างการใช้งานใน React Component
const { user } = useAuth();
const [userTeams, setUserTeams] = useState([]);

useEffect(() => {
  if (sessionId && user.role !== 'admin') {
    checkUserAccess();
  }
}, [sessionId]);

const checkUserAccess = async () => {
  const response = await fetch(`/api/eoc/sessions/${sessionId}/teams`);
  const data = await response.json();
  
  if (!data.hasAccess) {
    alert('คุณไม่มีสิทธิ์เข้าถึง Session นี้');
    router.push('/dashboard');
  } else {
    setUserTeams(data.userTeams);
  }
};
```

---

## 🎯 สถานการณ์การใช้งานจริง

### กรณีที่ 1: เปิด Session ใหม่

```
📅 1 มกราคม 2026: เปิด น้ำท่วม Session 1
└── Admin มอบหมาย:
    ├── MCAT: นายกาย (หัวหน้า), นางดาว (สมาชิก)
    ├── SAT: นายเดช (หัวหน้า)
    └── RISKCOM: นางมาลี (สมาชิก)

✅ นายกาย เห็นข้อมูล Session 1
✅ นางดาว เห็นข้อมูล Session 1
✅ นายเดช เห็นข้อมูล Session 1

📅 15 มกราคม: ปิด Session 1

📅 1 มีนาคม 2026: เปิด น้ำท่วม Session 2
└── ยังไม่มีการมอบหมายทีม

❌ นายกาย **ไม่มีสิทธิ์** ใน Session 2 (จนกว่า Admin จะแต่งตั้งใหม่)
❌ นางดาว **ไม่มีสิทธิ์** ใน Session 2
```

### กรณีที่ 2: เจ้าหน้าที่เปลี่ยนทีม

```
Session 1:
├── นายกาย อยู่ใน MCAT
└── Session 1 ปิดแล้ว

Session 2:
└── Admin แต่งตั้งนายกายใหม่ใน SAT (เปลี่ยนทีม)

✅ นายกาย จะเห็นข้อมูลของ SAT ใน Session 2
✅ ประวัติ Session 1 ยังคงแสดงว่านายกายเคยอยู่ใน MCAT
```

### กรณีที่ 3: เจ้าหน้าที่หลายทีม

```
Session 3:
└── Admin มอบหมาย:
    ├── MCAT: นายกาย (สมาชิก)
    └── RISKCOM: นายกาย (สมาชิก)

✅ นายกาย สามารถเข้าถึงทั้ง MCAT และ RISKCOM ได้
✅ มีสิทธิ์ตามที่กำหนดในแต่ละทีม
```

---

## 🔧 การตรวจสอบและแก้ไขปัญหา

### ปัญหา: เจ้าหน้าที่เข้าไม่ได้หลังเปิด Session ใหม่

**สาเหตุ:** ยังไม่มีการมอบหมายทีมงานใน Session นี้

**วิธีแก้:**
1. ไปที่ `/admin/eoc-management`
2. คลิก **👥 จัดการทีมงาน** ของ Session ที่เปิดอยู่
3. เพิ่มทีมและสมาชิก

### ปัญหา: ไม่พบปุ่ม "จัดการทีมงาน"

**สาเหตุ:** EOC ยังไม่เปิด หรือ User ไม่ใช่ Admin

**วิธีแก้:**
1. ตรวจสอบว่า EOC เปิดอยู่หรือไม่ (status = active)
2. ตรวจสอบว่า login ด้วย role = 'admin' หรือไม่

### การตรวจสอบจำนวนทีมและสมาชิกใน Session

```sql
-- ตรวจสอบทีมงานใน Session ปัจจุบัน
SELECT 
    s.id as session_id,
    s.eoc_type,
    s.session_number,
    s.status,
    COUNT(DISTINCT st.id) as team_count,
    COUNT(DISTINCT tm.id) as member_count
FROM eoc_sessions s
LEFT JOIN eoc_session_teams st ON s.id = st.eoc_session_id AND st.is_active = TRUE
LEFT JOIN eoc_team_members tm ON st.id = tm.session_team_id AND tm.is_active = TRUE
WHERE s.status = 'active'
GROUP BY s.id;

-- ดูรายละเอียดทีมและสมาชิก
SELECT 
    t.team_name_th,
    o.full_name as officer_name,
    tm.role_in_team,
    s.eoc_type,
    s.session_number
FROM eoc_team_members tm
JOIN eoc_session_teams st ON tm.session_team_id = st.id
JOIN eoc_teams t ON st.team_id = t.id
JOIN officer o ON tm.officer_id = o.id
JOIN eoc_sessions s ON st.eoc_session_id = s.id
WHERE tm.is_active = TRUE AND s.status = 'active';
```

---

## 📊 โครงสร้าง API

### 1. ดึงข้อมูลทีมงานใน Session

```
GET /api/admin/eoc-sessions/{sessionId}/teams

Response:
{
  "success": true,
  "session": {
    "id": 33,
    "eoc_type": "flood",
    "session_number": 7,
    "status": "active"
  },
  "teams": [
    {
      "session_team_id": 45,
      "team_id": 2,
      "team_code": "MCAT",
      "team_name_th": "ทีมประเมินสถานการณ์",
      "team_lead_name": "นายกาย",
      "member_count": 3,
      "members": [
        {
          "officer_id": 10,
          "full_name": "นายกาย",
          "role_in_team": "หัวหน้าทีม"
        }
      ]
    }
  ]
}
```

### 2. เพิ่มทีมให้ Session

```
POST /api/admin/eoc-sessions/{sessionId}/teams

Body:
{
  "teamId": 2,
  "teamLeadOfficerId": 10,
  "assignedBy": 1
}

Response:
{
  "success": true,
  "sessionTeamId": 45
}
```

### 3. เพิ่มสมาชิกในทีม

```
POST /api/admin/eoc-teams/{sessionTeamId}/members

Body:
{
  "officerId": 11,
  "roleInTeam": "สมาชิก",
  "assignedBy": 1
}

Response:
{
  "success": true,
  "memberId": 102
}
```

### 4. ถอดทีมออกจาก Session

```
DELETE /api/admin/eoc-sessions/{sessionId}/teams

Body:
{
  "teamId": 2
}
```

### 5. ถอดสมาชิกออกจากทีม

```
DELETE /api/admin/eoc-teams/{sessionTeamId}/members

Body:
{
  "memberId": 102,
  "removedBy": 1
}
```

---

## 🚀 คำแนะนำการใช้งาน

### สำหรับ Admin

1. **เปิด Session ใหม่เสมอเมื่อเกิดภัย** - อย่าใช้ Session เดิมซ้ำ
2. **มอบหมายทีมทันที** - หลังเปิด EOC ให้ไปจัดการทีมงานก่อน
3. **ตรวจสอบสิทธิ์** - ตรวจสอบว่าทุกคนเข้าถึงได้ถูกต้อง
4. **ปิด Session เมื่อเสร็จสิ้น** - เพื่อแยกข้อมูลแต่ละครั้งชัดเจน

### สำหรับเจ้าหน้าที่

1. **ถ้าเข้าไม่ได้** - ติดต่อ Admin เพื่อขอแต่งตั้งในทีม
2. **ตรวจสอบ Session ที่ active** - มั่นใจว่าเข้าถึง Session ที่ถูกต้อง
3. **บันทึกข้อมูลตามบทบาท** - ดำเนินการตามที่ได้รับมอบหมาย

---

## ✅ สรุป

| คุณสมบัติ | สถานะ | หมายเหตุ |
|-----------|-------|----------|
| ✅ ตารางฐานข้อมูล | พร้อมใช้งาน | eoc_teams, eoc_session_teams, eoc_team_members |
| ✅ API Endpoints | พร้อมใช้งาน | CRUD ครบถ้วน |
| ✅ หน้า UI จัดการทีม | พร้อมใช้งาน | /admin/eoc-sessions/[sessionId]/teams |
| ✅ Component EOCTeamManager | พร้อมใช้งาน | จัดการทีมและสมาชิก |
| ✅ ปุ่มเข้าถึงจากหน้าจัดการ EOC | พร้อมใช้งาน | ปรากฏเมื่อ EOC active |
| ✅ ระบบสิทธิ์แยกตาม Session | พร้อมใช้งาน | แต่ละ session มีทีมงานแยกกัน |

**🎉 ระบบพร้อมใช้งานแล้ว - เพียงแค่ Admin เข้าไปมอบหมายทีมในแต่ละ Session!**
