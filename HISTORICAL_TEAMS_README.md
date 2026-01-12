# 📋 ระบบแสดงข้อมูลทีมงานในโหมดข้อมูลย้อนหลัง

## 🎯 ภาพรวม

เพิ่มฟีเจอร์แสดงข้อมูลทีมงาน EOC และสมาชิกในแต่ละทีมเมื่อดูข้อมูลย้อนหลัง (Historical Mode) เพื่อให้ผู้ใช้สามารถดูได้ว่าในแต่ละ Session มีทีมไหนเปิดใช้งานบ้าง และมีเจ้าหน้าที่คนไหนอยู่ในแต่ละทีม

---

## 📁 ไฟล์ที่สร้าง/แก้ไข

### 1. API Endpoint ใหม่

#### `app/api/eoc/sessions/[sessionId]/teams/route.js`
API สำหรับดึงข้อมูลทีมและสมาชิกของ Session (Public Access)

**Endpoint:** `GET /api/eoc/sessions/{sessionId}/teams`

**Response:**
```json
{
  "success": true,
  "session": {
    "id": 27,
    "eoc_type": "flood",
    "session_number": 2,
    "status": "closed",
    "eoc_name": "น้ำท่วม"
  },
  "teams": [
    {
      "session_team_id": 1,
      "team_id": 2,
      "team_code": "MCAT",
      "team_name_th": "ทีมประเมินสถานการณ์",
      "team_name_en": "Multi-Agency Coordination",
      "description": "รายงานข้อมูลเพื่อประเมินสถานการณ์",
      "icon": "📊",
      "color": "blue",
      "team_lead_name": "นายสมชาย ใจดี",
      "team_lead_role": "admin",
      "member_count": 5,
      "members": [
        {
          "id": 1,
          "officer_id": 4,
          "full_name": "นายสมชาย ใจดี",
          "officer_role": "admin",
          "role_in_team": "หัวหน้าทีม",
          "assigned_at": "2025-12-24T10:00:00"
        },
        {
          "id": 2,
          "officer_id": 5,
          "full_name": "นางสาวสมหญิง รักดี",
          "officer_role": "user",
          "role_in_team": "สมาชิก",
          "assigned_at": "2025-12-24T10:30:00"
        }
      ]
    }
  ]
}
```

---

### 2. Component ใหม่

#### `components/SessionTeamsList.jsx`
Component สำหรับแสดงรายชื่อทีมและสมาชิกในทีม

**Props:**
- `sessionId` (required) - ID ของ Session ที่ต้องการแสดง
- `showTitle` (optional, default: true) - แสดงหัวข้อหรือไม่

**Features:**
- แสดงทีมทั้งหมดที่เปิดใช้งานใน Session
- แสดงไอคอนและสีประจำทีม
- แสดงหัวหน้าทีม
- แสดงจำนวนสมาชิก
- คลิกดูรายชื่อสมาชิกทั้งหมด (Expandable)
- Responsive design (Grid layout)

**ตัวอย่างการใช้งาน:**
```jsx
import SessionTeamsList from '@/components/SessionTeamsList';

<SessionTeamsList 
  sessionId={27} 
  showTitle={true} 
/>
```

---

### 3. Component ที่แก้ไข

#### `components/FloodSessionSelector.jsx`
เพิ่ม prop `showTeams` สำหรับเปิด/ปิดการแสดงข้อมูลทีม

**Props เพิ่มเติม:**
- `showTeams` (optional, default: false) - แสดงข้อมูลทีมหรือไม่

**ตัวอย่างการใช้งาน:**
```jsx
import FloodSessionSelector from '@/components/FloodSessionSelector';

// โหมดข้อมูลย้อนหลัง + แสดงทีม
<FloodSessionSelector 
  currentMode="historical"
  showTeams={true}
  onSessionChange={(session, year) => {
    console.log('Session changed:', session);
  }}
/>
```

#### `components/DisasterSessionSelector.jsx`
เพิ่ม prop `showTeams` เช่นเดียวกับ FloodSessionSelector

**ตัวอย่างการใช้งาน:**
```jsx
import DisasterSessionSelector from '@/components/DisasterSessionSelector';

// โหมดข้อมูลย้อนหลัง + แสดงทีม
<DisasterSessionSelector 
  disasterType="drought"
  currentMode="historical"
  showTeams={true}
  onSessionChange={(session, year) => {
    console.log('Session changed:', session);
  }}
/>
```

---

### 4. SQL Script

#### `add_it_support_team.sql`
เพิ่มทีม IT Support ลงในระบบ

**ทีมที่เพิ่ม:**
- รหัส: `ITSUPPORT`
- ชื่อไทย: ทีมสนับสนุนด้านเทคโนโลยี
- ชื่ออังกฤษ: IT Support Team
- ไอคอน: 💻
- สี: indigo
- ลำดับ: 8

**วิธีรัน:**
```sql
-- รันไฟล์ในฐานข้อมูล MySQL
SOURCE add_it_support_team.sql;
```

---

## 🎨 UI/UX Features

### SessionTeamsList Component

**การแสดงผล:**
1. **Header** - พื้นหลังสีม่วง แสดงจำนวนทีมทั้งหมด
2. **Grid Layout** - แสดงการ์ดทีมแบบ responsive (1-3 คอลัมน์)
3. **Team Card:**
   - ไอคอนและชื่อทีม
   - รหัสทีม (Team Code)
   - ข้อมูลหัวหน้าทีม (รูป + ชื่อ + ตำแหน่ง)
   - จำนวนสมาชิก
   - ปุ่ม "ดูรายชื่อ" (Expandable)
   
4. **Members List (เมื่อขยาย):**
   - รายชื่อสมาชิกทั้งหมด
   - แสดงลำดับที่
   - บทบาทในทีม (หัวหน้าทีม, สมาชิก, ฯลฯ)
   - ตำแหน่งงาน (admin, user, ฯลฯ)
   - Scrollable (สูงสุด 192px)

**สีประจำทีม:**
- 💻 ITSUPPORT - Indigo (#6366f1)
- 📢 RISKCOM - Purple (#9333ea)
- 📊 MCAT - Blue (#3b82f6)
- 🚑 SAT - Red (#ef4444)
- 🚁 SeRHT - Orange (#f97316)
- ⚕️ MEDICAL - Green (#22c55e)
- 📦 LOGISTICS - Yellow (#eab308)
- 🏕️ SHELTER - Teal (#14b8a6)

---

## 💻 การใช้งาน

### ขั้นตอนที่ 1: รัน SQL
```bash
# เชื่อมต่อ MySQL
mysql -u root -p stn_eoc

# รันไฟล์ SQL
SOURCE add_it_support_team.sql;
```

### ขั้นตอนที่ 2: ใช้งานใน Component

#### ตัวอย่าง 1: ในหน้าแผนที่น้ำท่วมย้อนหลัง
```jsx
// app/public/flood/historical-map/page.jsx
import FloodSessionSelector from '@/components/FloodSessionSelector';

export default function HistoricalFloodMapPage() {
  const [selectedSession, setSelectedSession] = useState(null);

  return (
    <div>
      <FloodSessionSelector
        currentMode="historical"
        showTeams={true}  // เปิดการแสดงทีม
        onSessionChange={(session, year) => {
          setSelectedSession(session);
        }}
      />
      
      {/* แสดงแผนที่ */}
      {selectedSession && (
        <DisasterMap sessionId={selectedSession.id} />
      )}
    </div>
  );
}
```

#### ตัวอย่าง 2: ใช้ Component SessionTeamsList แยก
```jsx
// app/admin/eoc-sessions/[sessionId]/page.jsx
import SessionTeamsList from '@/components/SessionTeamsList';

export default function SessionDetailPage({ params }) {
  const { sessionId } = params;

  return (
    <div>
      <h1>รายละเอียด Session</h1>
      
      {/* แสดงข้อมูลทีม */}
      <SessionTeamsList sessionId={sessionId} showTitle={true} />
    </div>
  );
}
```

---

## 🔧 การตั้งค่าเพิ่มเติม

### ปรับแต่งการแสดงผล

#### ซ่อนหัวข้อ
```jsx
<SessionTeamsList sessionId={27} showTitle={false} />
```

#### ใช้ร่วมกับ FloodSessionSelector
```jsx
<FloodSessionSelector
  currentMode="historical"
  showTeams={true}  // แสดงทีมอัตโนมัติ
/>
```

### การจัดการ Loading State

Component จะแสดง Loading Spinner อัตโนมัติ:
```jsx
// กำลังโหลด...
<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
```

### การจัดการ Error State

Component จะแสดงข้อความ error อัตโนมัติ:
```jsx
// เกิดข้อผิดพลาด
<div className="text-center text-red-500">
  ❌ เกิดข้อผิดพลาดในการโหลดข้อมูล
</div>
```

---

## 📊 โครงสร้างข้อมูล

### ตาราง eoc_teams (ทีมทั้งหมดในระบบ)
```sql
SELECT * FROM eoc_teams WHERE is_active = TRUE ORDER BY sort_order;
```

### ตาราง eoc_session_teams (ทีมที่ใช้ใน Session)
```sql
SELECT * FROM eoc_session_teams 
WHERE eoc_session_id = 27 AND is_active = TRUE;
```

### ตาราง eoc_team_members (สมาชิกในทีม)
```sql
SELECT * FROM eoc_team_members tm
JOIN eoc_session_teams st ON tm.session_team_id = st.id
WHERE st.eoc_session_id = 27 AND tm.is_active = TRUE;
```

---

## 🎯 Use Cases

### 1. ดูข้อมูลย้อนหลังพร้อมทีมงาน
ผู้ใช้สามารถเลือกดู Session ในอดีตและดูว่าทีมไหนเปิดใช้งานในช่วงนั้น

### 2. วิเคราะห์การใช้งานทีม
ผู้บริหารสามารถวิเคราะห์ว่าทีมไหนถูกใช้บ่อยที่สุดในแต่ละประเภทภัย

### 3. ตรวจสอบการมอบหมายงาน
ดูได้ว่าเจ้าหน้าที่คนไหนอยู่ในทีมไหนในแต่ละ Session

### 4. รายงานการปฏิบัติงาน
สร้างรายงานแสดงทีมและสมาชิกที่ปฏิบัติงานในแต่ละเหตุการณ์

---

## ✅ Checklist การติดตั้ง

- [x] รัน SQL script เพิ่มทีม IT Support
- [x] สร้าง API endpoint `/api/eoc/sessions/[sessionId]/teams`
- [x] สร้าง Component `SessionTeamsList.jsx`
- [x] ปรับ `FloodSessionSelector.jsx` เพิ่ม prop showTeams
- [x] ปรับ `DisasterSessionSelector.jsx` เพิ่ม prop showTeams
- [x] ทดสอบการแสดงผลในโหมด historical
- [x] ทดสอบการขยาย/ซ่อนรายชื่อสมาชิก
- [x] ทดสอบ responsive design

---

## 📝 หมายเหตุ

1. Component นี้จะแสดงเฉพาะทีมที่ `is_active = TRUE`
2. แสดงเฉพาะสมาชิกที่ยังอยู่ในทีม (`is_active = TRUE`)
3. รายชื่อสมาชิกจะเรียงตามบทบาท (หัวหน้าทีมก่อน)
4. สามารถใช้ร่วมกับ Session ที่ปิดแล้วได้
5. รองรับทุกประเภทภัย (flood, drought, tsunami, earthquake, disease)

---

## 🚀 การพัฒนาต่อ

### ฟีเจอร์ที่สามารถเพิ่มเติม:
1. ดาวน์โหลดรายชื่อทีมเป็น PDF/Excel
2. กราฟแสดงสถิติการใช้งานทีม
3. Timeline แสดงการเข้า-ออกของสมาชิก
4. กราฟแสดงจำนวนสมาชิกในแต่ละทีม
5. ค้นหาและกรองทีม
6. เปรียบเทียบทีมระหว่าง Session

---

**สร้างเมื่อ:** 12 มกราคม 2026  
**เวอร์ชัน:** 1.0  
**ผู้พัฒนา:** GitHub Copilot
