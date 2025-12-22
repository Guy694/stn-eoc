# 🔧 การปรับปรุงระบบเป็น Modular Architecture

## 📋 ภาพรวม

ระบบ EOC ได้รับการปรับปรุงให้เป็นแบบ **Module-based Architecture** ที่รองรับการจัดการภัยพิบัติหลายประเภท:
- 💧 **น้ำท่วม (Flood)**
- 🌵 **ภัยแล้ง (Drought)**
- 🦠 **โรคระบาด (Disease Outbreak)**
- 🌊 **คลื่นสึนามิ (Tsunami)**
- 🏚️ **แผ่นดินไหว (Earthquake)**

---

## 🎯 คุณสมบัติหลัก

### 1. **Disaster Configuration System**
ระบบ configuration กลางที่กำหนดคุณสมบัติของแต่ละ disaster module:

```javascript
// lib/disasterConfig.js
export const DISASTER_CONFIG = {
    flood: { ... },
    drought: { ... },
    disease: { ... },
    tsunami: { ... },
    earthquake: { ... }
};
```

**คุณสมบัติของแต่ละ Module:**
- ชื่อภาษาไทย/อังกฤษ
- ไอคอน และ color scheme
- Routes (เส้นทาง URL)
- API endpoints
- Risk levels (ระดับความเสี่ยง)
- Metrics (ตัวชี้วัด)

### 2. **Generic Components**
Components ที่ใช้ร่วมกันได้กับทุก disaster type:

#### `DisasterSessionSelector.js`
- รองรับทุก disaster type
- แสดง EOC sessions
- โหมดเรียลไทม์ / ย้อนหลัง
- ปรับสีและไอคอนตาม disaster type

#### `DisasterDashboard.js`
- แสดงสถานะทุก disaster modules
- Real-time active sessions
- สถิติรวมรายปี
- Navigation ไปยังแต่ละ module

#### `SessionStats.js`
- แสดงสถิติของ session
- รองรับหลาย disaster types
- คำนวณข้อมูลตาม metrics

### 3. **Dynamic API Routes**
API แบบ dynamic ที่รองรับทุก disaster type:

```
/api/eoc/[type]/sessions-summary
```

**ตัวอย่าง:**
- `/api/eoc/flood/sessions-summary`
- `/api/eoc/drought/sessions-summary`
- `/api/eoc/disease/sessions-summary`

---

## 📁 โครงสร้างไฟล์

```
stn-eoc/
├── lib/
│   └── disasterConfig.js              # Configuration ทุก disaster modules
│
├── components/
│   ├── DisasterSessionSelector.js     # Generic session selector
│   ├── DisasterDashboard.js           # Dashboard แสดงทุก modules
│   ├── FloodSessionSelector.js        # (Legacy - specific for flood)
│   └── SessionStats.js                # Generic statistics display
│
├── app/
│   ├── dashboard/
│   │   └── page.js                    # Dashboard หลักพร้อม DisasterDashboard
│   │
│   ├── api/eoc/
│   │   ├── [type]/                    # Dynamic route สำหรับทุก disaster
│   │   │   └── sessions-summary/
│   │   │       └── route.js
│   │   │
│   │   ├── flood/                     # Flood-specific APIs
│   │   │   ├── sessions-summary/
│   │   │   ├── daily-risk/
│   │   │   └── daily-flood-village/
│   │   │
│   │   ├── drought/                   # Drought-specific APIs (ใหม่)
│   │   ├── disease/                   # Disease-specific APIs (ใหม่)
│   │   ├── tsunami/                   # Tsunami-specific APIs (ใหม่)
│   │   └── earthquake/                # Earthquake-specific APIs (ใหม่)
│   │
│   └── eoc/
│       ├── flood/                     # Flood module
│       │   ├── page.js
│       │   ├── daily-risk/
│       │   └── gistda.js
│       │
│       ├── drought/                   # Drought module (พร้อมขยาย)
│       │   └── page.js
│       │
│       ├── disease/                   # Disease module (พร้อมขยาย)
│       │   └── page.js
│       │
│       ├── tsunami/                   # Tsunami module (พร้อมขยาย)
│       │   └── page.js
│       │
│       └── earthquake/                # Earthquake module (พร้อมขยาย)
│           └── page.js
```

---

## 🚀 การใช้งาน

### 1. ใช้ Disaster Configuration

```javascript
import { getDisasterConfig, getDisasterIcon } from '@/lib/disasterConfig';

// ดึง config ของ flood
const config = getDisasterConfig('flood');
console.log(config.name);        // "น้ำท่วม"
console.log(config.icon);        // "💧"
console.log(config.routes.main); // "/eoc/flood"

// ดึงไอคอน
const icon = getDisasterIcon('drought'); // "🌵"
```

### 2. ใช้ DisasterSessionSelector

```javascript
import DisasterSessionSelector from '@/components/DisasterSessionSelector';

// สำหรับหน้าน้ำท่วม
<DisasterSessionSelector 
    disasterType="flood"
    currentMode="realtime"
    onSessionChange={(session, year) => {
        // Handle session change
    }}
/>

// สำหรับหน้าภัยแล้ง
<DisasterSessionSelector 
    disasterType="drought"
    currentMode="historical"
    onSessionChange={handleChange}
/>
```

### 3. ใช้ DisasterDashboard

```javascript
import DisasterDashboard from '@/components/DisasterDashboard';

// แสดงในหน้า dashboard
<DisasterDashboard />
```

### 4. เรียก Generic API

```javascript
// ดึง sessions ของ flood
fetch('/api/eoc/flood/sessions-summary?year=2025')

// ดึง sessions ของ disease
fetch('/api/eoc/disease/sessions-summary?year=2025')
```

---

## 🎨 Color Schemes ของแต่ละ Module

| Module | Icon | Primary Color | Gradient |
|--------|------|--------------|----------|
| Flood | 💧 | Blue | from-blue-500 to-blue-600 |
| Drought | 🌵 | Orange | from-orange-500 to-red-500 |
| Disease | 🦠 | Red | from-red-500 to-pink-600 |
| Tsunami | 🌊 | Cyan | from-cyan-500 to-blue-700 |
| Earthquake | 🏚️ | Brown | from-yellow-700 to-red-700 |

---

## 📊 Risk Levels ของแต่ละ Module

### Flood (น้ำท่วม)
- 🔴 **Severe** - รุนแรงมาก
- 🟡 **Moderate** - ปานกลาง
- 🔵 **Mild** - เล็กน้อย
- 🟢 **Safe** - ปลอดภัย

### Drought (ภัยแล้ง)
- 🔴 **Critical** - วิกฤต
- 🟠 **Severe** - รุนแรง
- 🟡 **Moderate** - ปานกลาง
- 🟢 **Normal** - ปกติ

### Disease (โรคระบาด)
- 🔴 **Pandemic** - ระบาดใหญ่
- 🟠 **Epidemic** - ระบาด
- 🟡 **Outbreak** - เฝ้าระวัง
- 🟢 **Controlled** - ควบคุมได้

### Tsunami (คลื่นสึนามิ)
- 🔴 **Extreme** - อันตรายสูงสุด
- 🟠 **High** - อันตรายสูง
- 🟡 **Watch** - เฝ้าระวัง
- 🟢 **Safe** - ปลอดภัย

### Earthquake (แผ่นดินไหว)
- 🔴 **Major** - รุนแรงมาก (≥7.0)
- 🟠 **Strong** - รุนแรง (6.0-6.9)
- 🟡 **Moderate** - ปานกลาง (5.0-5.9)
- 🟢 **Minor** - เล็กน้อย (<5.0)

---

## 🔧 การเพิ่ม Module ใหม่

### ขั้นตอนที่ 1: เพิ่ม Configuration

แก้ไข `lib/disasterConfig.js`:

```javascript
export const DISASTER_CONFIG = {
    // ... existing modules
    
    wildfire: {
        id: 'wildfire',
        name: 'ไฟป่า',
        nameEn: 'Wildfire',
        icon: '🔥',
        color: {
            primary: 'red',
            gradient: 'from-red-600 to-orange-600',
            // ...
        },
        routes: {
            main: '/eoc/wildfire',
            // ...
        },
        riskLevels: [
            // ระดับความเสี่ยง
        ],
        metrics: [
            // ตัวชี้วัด
        ]
    }
};
```

### ขั้นตอนที่ 2: สร้างตาราง Database

```sql
-- สำหรับข้อมูลรายวัน
CREATE TABLE daily_wildfire_data (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    record_date DATE NOT NULL,
    area VARCHAR(255) NOT NULL,
    risk_level ENUM('extreme', 'high', 'moderate', 'low'),
    burned_area DECIMAL(10,2),
    -- ... fields อื่นๆ
);
```

### ขั้นตอนที่ 3: สร้างหน้า Module

สร้างไฟล์ `app/eoc/wildfire/page.js`:

```javascript
"use client";
import DisasterSessionSelector from '@/components/DisasterSessionSelector';
// ... imports อื่นๆ

export default function WildfirePage() {
    return (
        <EOCLayout>
            <DisasterSessionSelector 
                disasterType="wildfire"
                currentMode="realtime"
            />
            {/* แผนที่และข้อมูลอื่นๆ */}
        </EOCLayout>
    );
}
```

### ขั้นตอนที่ 4: สร้าง API (Optional)

Generic API `/api/eoc/[type]/sessions-summary` จะทำงานอัตโนมัติ
หากต้องการ API เฉพาะ สร้าง `app/api/eoc/wildfire/daily-data/route.js`

---

## ✅ ข้อดีของ Modular Architecture

### 1. **Code Reusability**
- Components ใช้ซ้ำได้กับทุก module
- ลด code duplication
- ง่ายต่อการ maintain

### 2. **Scalability**
- เพิ่ม module ใหม่ได้ง่าย
- ไม่ต้องแก้ไข code เดิมมาก
- Configuration-driven

### 3. **Consistency**
- UI/UX สอดคล้องกันทุก module
- Color scheme มาตรฐาน
- Navigation pattern เหมือนกัน

### 4. **Maintainability**
- แยก concerns ชัดเจน
- แก้ไขที่เดียว ส่งผลทุก module
- ง่ายต่อการ debug

### 5. **Flexibility**
- แต่ละ module ปรับแต่งได้อิสระ
- Override configuration ตามต้องการ
- รองรับ specific features

---

## 🔄 Migration จาก Legacy Code

### Flood Module (เดิม)
```javascript
import FloodSessionSelector from '@/components/FloodSessionSelector';

<FloodSessionSelector 
    currentMode="realtime"
    onSessionChange={handleChange}
/>
```

### Flood Module (ใหม่)
```javascript
import DisasterSessionSelector from '@/components/DisasterSessionSelector';

<DisasterSessionSelector 
    disasterType="flood"
    currentMode="realtime"
    onSessionChange={handleChange}
/>
```

**หมายเหตุ:** Legacy components ยังคงใช้งานได้ แต่แนะนำให้ migrate ไปใช้ generic components

---

## 📝 Best Practices

### 1. ใช้ Configuration
```javascript
// ❌ Hard-code
const icon = '💧';
const name = 'น้ำท่วม';

// ✅ ใช้ config
import { getDisasterIcon, getDisasterName } from '@/lib/disasterConfig';
const icon = getDisasterIcon(disasterType);
const name = getDisasterName(disasterType);
```

### 2. Dynamic Routing
```javascript
// ❌ Fixed
<Link href="/eoc/flood">

// ✅ Dynamic
const config = getDisasterConfig(disasterType);
<Link href={config.routes.main}>
```

### 3. Consistent Colors
```javascript
// ❌ Manual
className="bg-blue-500 text-white"

// ✅ ใช้ config
const colorClass = getDisasterColor(disasterType);
className={`bg-linear-to-r ${colorClass.gradient} text-white`}
```

---

## 🎯 ต่อไปนี้

### Phase 1: ✅ เสร็จแล้ว
- ✅ Configuration system
- ✅ Generic components
- ✅ Dynamic API
- ✅ Dashboard integration

### Phase 2: 📋 กำลังพัฒนา
- [ ] Drought module (pages + APIs)
- [ ] Disease module (pages + APIs)
- [ ] Tsunami module (pages + APIs)
- [ ] Earthquake module (pages + APIs)

### Phase 3: 🔮 แผนอนาคต
- [ ] Generic reporting system
- [ ] Shared analytics dashboard
- [ ] Cross-module comparison
- [ ] Unified notification system

---

## 📞 การสนับสนุน

หากมีคำถามหรือต้องการความช่วยเหลือ:
1. อ่าน documentation นี้
2. ดูตัวอย่างใน flood module
3. ตรวจสอบ `lib/disasterConfig.js`
4. ทดสอบกับ mock data

---

**สร้างโดย:** GitHub Copilot  
**วันที่:** 22 ธันวาคม 2568  
**Version:** 2.0.0 - Modular Architecture
