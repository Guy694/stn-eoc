# ระบบแสดงข้อมูลย้อนหลังน้ำท่วม (Flood Historical Data System)

## 📋 ภาพรวม

ระบบนี้เพิ่มฟีเจอร์การแสดงข้อมูลย้อนหลังของปีที่เกิดน้ำท่วม โดยมีเมนูย่อยที่ช่วยให้ผู้ใช้สามารถ:
1. **ติดตามสถานการณ์แบบเรียลไทม์** - แสดงข้อมูลตั้งแต่เปิด EOC จนถึงปัจจุบัน
2. **ดูข้อมูลสรุปย้อนหลัง** - ดูข้อมูลสถิติและประวัติของปีที่ผ่านมา

## 🎯 ฟีเจอร์หลัก

### 1. โหมดแสดงผล 2 แบบ

#### 🔴 โหมดเรียลไทม์ (Real-time Mode)
- แสดงสถานการณ์ปัจจุบันของ EOC ที่เปิดอยู่
- อัพเดทข้อมูลตามเวลาจริง
- แสดงระยะเวลาที่เปิด EOC
- แสดงสถิติปัจจุบัน: เหตุการณ์ทั้งหมด, ความรุนแรงสูง, ผู้ได้รับผลกระทบ

#### 📊 โหมดข้อมูลย้อนหลัง (Historical Mode)
- เลือกดูข้อมูลแยกตามปี (พ.ศ.)
- เลือกดู EOC Session เฉพาะ
- แสดงสถิติสรุปของแต่ละ session
- แสดงสรุปของทั้งปี

### 2. เลือกปีและ Session

**การเลือกปี:**
- Dropdown แสดงรายการปีที่มีข้อมูล
- แสดงเป็น พ.ศ. เพื่อความเข้าใจง่าย
- เลือกปีปัจจุบันโดยอัตโนมัติเมื่อเปิดครั้งแรก

**การเลือก Session:**
- แสดงรายการ EOC Sessions ทั้งหมดในปีที่เลือก
- แสดงวันเวลาเปิด-ปิด
- ระบุสถานะ (กำลังดำเนินการ/ปิดแล้ว)
- เลือก active session โดยอัตโนมัติ

### 3. สถิติและข้อมูลสรุป

#### สถิติสรุปของปี:
- 🔢 จำนวน EOC Sessions ทั้งหมด
- ⏱️ ระยะเวลารวมที่เปิด EOC
- 📋 จำนวนกิจกรรมทั้งหมด
- 📝 จำนวนบันทึกข้อมูล
- 🏘️ จำนวนหมู่บ้านที่ได้รับผลกระทบ
- 📍 จำนวนตำบลและอำเภอ

#### สถิติของแต่ละ Session:
- 🏘️ หมู่บ้านที่ได้รับผลกระทบ
- 📍 ตำบลและอำเภอ
- 👥 จำนวนประชากรที่ได้รับผลกระทบ
- 🔴 จำนวนเหตุการณ์แยกตามความรุนแรง (สูง/ปานกลาง/เล็กน้อย)
- ⏱️ ระยะเวลาที่เปิด EOC
- 📝 จำนวนบันทึกข้อมูลและกิจกรรม

### 4. การแสดงผลบนแผนที่

- แผนที่ปรับตามช่วงเวลาที่เลือก
- แสดงข้อมูล GISTDA ตาม session
- กรองข้อมูลตาม date range ของ session อัตโนมัติ
- รองรับการซูมและดูรายละเอียดพื้นที่

## 🗂️ ไฟล์ที่สร้างใหม่

### 1. API Endpoints

#### `/api/eoc/flood/sessions-summary/route.js`
**GET Request:**
- `?year={year}` - ดึงข้อมูลของปีที่ระบุ
- ไม่ระบุ year - ดึงสรุปทุกปี

**Response:**
```json
{
  "success": true,
  "year": 2025,
  "summary": {
    "total_sessions": 3,
    "total_hours": 456.5,
    "total_activities": 145,
    "total_data_entries": 892,
    "active_sessions": 1,
    "closed_sessions": 2,
    "total_villages": 45,
    "total_tambons": 15,
    "total_districts": 5
  },
  "sessions": [
    {
      "id": 1,
      "session_number": 1,
      "opened_at": "2025-01-15T08:00:00",
      "closed_at": "2025-01-25T18:00:00",
      "duration_hours": 250.5,
      "status": "closed",
      "total_activities": 45,
      "total_data_entries": 234,
      "opened_by_name": "นายสมชาย ใจดี",
      "closed_by_name": "นายสมหญิง รักษ์ดี"
    }
  ]
}
```

### 2. React Components

#### `/components/FloodSessionSelector.js`
Component สำหรับเลือกปีและ session

**Props:**
- `currentMode` - 'realtime' หรือ 'historical'
- `onSessionChange` - callback เมื่อเลือก session ใหม่

**Features:**
- Dropdown เลือกปี (แสดงเป็น พ.ศ.)
- Dropdown เลือก EOC Session
- แสดงสรุปสถิติของปี
- แสดงรายละเอียด session ที่เลือก
- Auto-select active session หรือ session ล่าสุด

#### `/components/SessionStats.js`
Component สำหรับแสดงสถิติของ session

**Props:**
- `session` - ข้อมูล session ที่เลือก
- `year` - ปี

**Features:**
- ดึงข้อมูลน้ำท่วมตาม date range ของ session
- คำนวณสถิติแบบเรียลไทม์
- แสดง cards สถิติหลายประเภท
- แสดงข้อมูลสรุปด้านล่าง

### 3. การแก้ไขไฟล์เดิม

#### `/app/eoc/flood/page.js`
**เพิ่มเติม:**
- Import components ใหม่
- State management สำหรับ viewMode, selectedSession, selectedYear
- Function handleSessionChange
- UI switcher สำหรับเปลี่ยนโหมด
- Conditional rendering ตามโหมด

**Changes:**
```javascript
// เพิ่ม state
const [viewMode, setViewMode] = useState('realtime');
const [selectedSession, setSelectedSession] = useState(null);
const [selectedYear, setSelectedYear] = useState(null);

// เพิ่ม handler
const handleSessionChange = (session, year) => {
    setSelectedSession(session);
    setSelectedYear(year);
    // ปรับ date range ตาม session
};
```

## 💻 การใช้งาน

### สำหรับผู้ใช้ทั่วไป

1. **เข้าสู่หน้าแผนที่น้ำท่วม** (`/eoc/flood`)

2. **เลือกโหมดการแสดงผล:**
   - คลิก "โหมดเรียลไทม์" เพื่อดูสถานการณ์ปัจจุบัน
   - คลิก "โหมดข้อมูลย้อนหลัง" เพื่อดูประวัติ

3. **ในโหมดเรียลไทม์:**
   - ดู EOC ที่เปิดอยู่ (ถ้ามี)
   - ดูระยะเวลาที่เปิด EOC
   - ดูสถิติปัจจุบัน

4. **ในโหมดข้อมูลย้อนหลัง:**
   - เลือกปีที่ต้องการดู
   - เลือก EOC Session ที่สนใจ
   - ดูสถิติสรุปของ session นั้น
   - แผนที่จะแสดงข้อมูลตาม session ที่เลือก

### สำหรับนักพัฒนา

#### การติดตั้ง
ไม่ต้องติดตั้งเพิ่มเติม ใช้ dependencies เดิม

#### การเรียกใช้ API

```javascript
// ดึงรายการปีทั้งหมด
const response = await fetch('/api/eoc/flood/sessions-summary');
const data = await response.json();
// data.availableYears = [2025, 2024, 2023]

// ดึงข้อมูลปี 2025
const response = await fetch('/api/eoc/flood/sessions-summary?year=2025');
const data = await response.json();
// data.summary = {...}, data.sessions = [...]
```

#### การใช้ Components

```jsx
import FloodSessionSelector from "@/components/FloodSessionSelector";

<FloodSessionSelector 
    currentMode="historical"
    onSessionChange={(session, year) => {
        console.log('Selected:', session, year);
    }}
/>
```

```jsx
import SessionStats from "@/components/SessionStats";

<SessionStats 
    session={selectedSession}
    year={2025}
/>
```

## 🎨 UI/UX Design

### Color Scheme
- **โหมดเรียลไทม์:** สีน้ำเงิน (#3B82F6) - บ่งบอกถึงข้อมูลสด
- **โหมดข้อมูลย้อนหลัง:** สีม่วง (#8B5CF6) - บ่งบอกถึงข้อมูลประวัติ
- **Active Session:** พื้นหลังไล่เฉดสีน้ำเงิน
- **Historical Session:** พื้นหลังไล่เฉดสีม่วง

### Icons
- 🔴 Real-time mode
- 📊 Historical mode
- 🟢 Active session
- ⚫ Closed session
- 🏘️ Villages
- 📍 Tambon/District
- 👥 Population
- ⚠️ Severity levels

### Responsive Design
- Desktop: Grid layout แบบหลายคอลัมน์
- Tablet: ปรับเป็น 2 คอลัมน์
- Mobile: Single column, stacked layout

## 🔄 Data Flow

```
User Action (Select Mode)
    ↓
FloodSessionSelector Component
    ↓
Fetch /api/eoc/flood/sessions-summary
    ↓
Display Years & Sessions
    ↓
User Selects Session
    ↓
handleSessionChange()
    ↓
Update startDate & endDate
    ↓
SessionStats Component (if historical)
    ↓
Fetch flood data for date range
    ↓
Update Map & Stats Display
```

## 📊 Database Schema

### ตาราง eoc_sessions
```sql
CREATE TABLE eoc_sessions (
    id BIGINT PRIMARY KEY AUTO_INCREMENT,
    eoc_type ENUM('flood', 'drought', 'tsunami', 'earthquake', 'disease'),
    session_number INT NOT NULL,
    opened_at DATETIME NOT NULL,
    closed_at DATETIME NULL,
    duration_hours DECIMAL(10,2) NULL,
    status ENUM('active', 'closed') DEFAULT 'active',
    total_activities INT DEFAULT 0,
    total_data_entries INT DEFAULT 0,
    affected_areas TEXT NULL,
    summary TEXT NULL,
    ...
);
```

### ตาราง daily_village_flood
ใช้สำหรับดึงข้อมูลพื้นที่ที่ได้รับผลกระทบในแต่ละ session

## 🚀 การพัฒนาในอนาคต

### Phase 2
- [ ] เพิ่มกราฟแสดงแนวโน้มการเกิดน้ำท่วมแต่ละปี
- [ ] เพิ่มการเปรียบเทียบ sessions
- [ ] Export รายงานเป็น PDF/Excel
- [ ] Filter ขั้นสูง (ตามพื้นที่, ความรุนแรง)

### Phase 3
- [ ] Dashboard สำหรับวิเคราะห์ข้อมูลแบบ advanced
- [ ] Heatmap แสดงพื้นที่เสี่ยงตามประวัติ
- [ ] AI prediction สำหรับพื้นที่เสี่ยง
- [ ] Integration กับระบบเตือนภัย

## 🐛 Known Issues & Solutions

### Issue 1: ข้อมูลไม่แสดง
**สาเหตุ:** Database ยังไม่มีข้อมูล eoc_sessions
**วิธีแก้:** ใช้ mock data ที่มีอยู่ใน API (useMockData: true)

### Issue 2: Date range ไม่ถูกต้อง
**สาเหตุ:** Timezone conversion
**วิธีแก้:** ใช้ ISO string format และ split('T')[0]

## 📞 Support

หากพบปัญหาหรือต้องการความช่วยเหลือ:
- อ่าน documentation นี้อีกครั้ง
- ตรวจสอบ console log สำหรับ errors
- ตรวจสอบ Network tab ใน DevTools
- ทดสอบด้วย mock data ก่อน

## 📝 Change Log

### Version 1.0.0 (2025-12-22)
- ✅ เพิ่มโหมดเรียลไทม์และย้อนหลัง
- ✅ สร้าง API sessions-summary
- ✅ สร้าง FloodSessionSelector component
- ✅ สร้าง SessionStats component
- ✅ ปรับปรุง flood page UI
- ✅ เพิ่ม auto date range selection
- ✅ Mock data support for development

---

**สร้างโดย:** GitHub Copilot  
**วันที่:** 22 ธันวาคม 2568  
**Version:** 1.0.0
