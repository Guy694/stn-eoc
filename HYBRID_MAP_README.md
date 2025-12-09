# แผนที่ภัยพิบัติแบบ Hybrid - ระบบ EOC จังหวัดสตูล

## ภาพรวม

ระบบแผนที่ภัยพิบัติแบบ Hybrid ที่รวม Polygon Layer สำหรับแสดงพื้นที่เสี่ยงและ Event Markers สำหรับแสดงจุดเกิดเหตุ รองรับทั้งแผนที่น้ำท่วมและแผนที่ภัยแล้ง

## 🗺️ หน้าแผนที่ที่มีในระบบ

### 1. แผนที่น้ำท่วม (`/flood-map`)
แสดงข้อมูลพื้นที่เสี่ยงน้ำท่วมและเหตุการณ์น้ำท่วมในจังหวัดสตูล

**คุณสมบัติ:**
- 💧 แสดง Polygon พื้นที่เสี่ยงน้ำท่วมพร้อมระดับความเสี่ยง
- 📍 จุด Marker เหตุการณ์น้ำท่วมจริง
- 🎨 3 โหมดการแสดงสี: ความเสี่ยง, อำเภอ, ประชากร
- 🔍 ฟิลเตอร์ครบถ้วน: เวลา, ความรุนแรง, พื้นที่
- 📊 Dashboard สถิติแบบเรียลไทม์

**ระดับความเสี่ยงน้ำท่วม:**
- 🔴 สูงมาก: แดงเข้ม (#DC2626)
- 🟠 สูง: ส้ม (#F59E0B)
- 🟡 ปานกลาง: เหลือง (#FCD34D)
- 🟢 ต่ำ: เขียว (#10B981)
- 💚 ปลอดภัย: เขียวอ่อน (#6EE7B7)

### 2. แผนที่ภัยแล้ง (`/drought-map`)
แสดงข้อมูลพื้นที่ประสบภัยแล้งและพื้นที่ขาดแคลนน้ำ

**คุณสมบัติ:**
- ☀️ แสดง Polygon พื้นที่เสี่ยงภัยแล้งพร้อมระดับความรุนแรง
- 📍 จุด Marker พื้นที่ประสบภัยแล้ง
- 🎨 3 โหมดการแสดงสี: ความเสี่ยง, อำเภอ, ประชากร
- 🔍 ฟิลเตอร์ครบถ้วน: เวลา, ความรุนแรง, พื้นที่
- 📊 Dashboard สถิติแบบเรียลไทม์

**ระดับความเสี่ยงภัยแล้ง:**
- 🟤 สูงมาก: น้ำตาลเข้ม (#7C2D12)
- 🔶 สูง: ส้มแดง (#EA580C)
- 🟠 ปานกลาง: ส้มอ่อน (#FB923C)
- 🟡 ต่ำ: เหลือง (#FDE047)
- 💚 ปลอดภัย: เขียวอ่อน (#86EFAC)

### 3. แผนที่หมู่บ้าน (`/village-map`)
แสดงขอบเขตหมู่บ้านและข้อมูลประชากร (เดิม)

### 4. แผนที่ภัยพิบัติทั่วไป (`/public/disaster-map`)
แสดงเหตุการณ์ภัยพิบัติทุกประเภท (เดิม)

## 🎯 ฟีเจอร์หลัก

### Hybrid Map System
- **Polygon Layer**: แสดงพื้นที่เสี่ยงแบบ polygon
- **Event Markers**: แสดงจุดเกิดเหตุแบบ circle markers
- **Interactive**: คลิก hover ดูข้อมูลรายละเอียด
- **Real-time Filtering**: กรองข้อมูลแบบเรียลไทม์

### 3 โหมดการแสดงสี

#### 1. โหมดความเสี่ยง (Risk Mode)
แสดงสีตามระดับความเสี่ยงของพื้นที่
- น้ำท่วม: ใช้โทนสีน้ำเงิน-แดง
- ภัยแล้ง: ใช้โทนสีน้ำตาล-ส้ม

#### 2. โหมดอำเภอ (District Mode)
แสดงสีตามอำเภอ 7 อำเภอของสตูล
- เมืองสตูล: น้ำเงิน
- ควนโดน: เขียว
- ควนกาหลง: ส้ม
- ท่าแพ: ม่วง
- ละงู: ชมพู
- ทุ่งหว้า: เขียวอมฟ้า
- มะนัง: ส้มแก่

#### 3. โหมดประชากร (Population Mode)
แสดงสีตามจำนวนครัวเรือน
- 0-50: เหลืองอ่อน
- 51-100: เหลือง
- 101-150: ส้ม
- 151+: แดง

### ระบบฟิลเตอร์

**6 ตัวกรองหลัก:**
1. **ช่วงเวลา**: วันนี้, 7 วัน, 30 วัน, ทั้งหมด
2. **ความรุนแรง**: สูงมาก, สูง, ปานกลาง, ต่ำ
3. **อำเภอ**: ทั้ง 7 อำเภอ
4. **ตำบล**: กรองตามตำบล (ขึ้นกับอำเภอที่เลือก)
5. **หมู่บ้าน**: กรองตามหมู่บ้าน (ขึ้นกับตำบลที่เลือก)
6. **สถานะ**: กำลังดำเนินการ, เสร็จสิ้น

**Cascading Filter**: ตำบลและหมู่บ้านจะอัพเดทอัตโนมัติตามอำเภอที่เลือก

### Dashboard สถิติ

**4 กล่องสถิติหลัก:**
1. 📊 เหตุการณ์/พื้นที่ทั้งหมด
2. ⚠️ ความรุนแรงสูง
3. 👥 ผู้ได้รับผลกระทบ (คน)
4. 🔄 กำลังดำเนินการ

## 📁 โครงสร้างไฟล์

```
app/
├── flood-map/
│   └── page.js                  # หน้าแผนที่น้ำท่วม
├── drought-map/
│   └── page.js                  # หน้าแผนที่ภัยแล้ง
└── api/
    └── village-polygons/
        └── route.js             # API ข้อมูล polygon

components/
├── HybridDisasterMap.js         # Component แผนที่ Hybrid
├── PolygonMap.js                # Component แผนที่ Polygon
├── DisasterMap.js               # Component แผนที่เหตุการณ์
└── Navbar.js                    # เมนูนำทาง (อัพเดท)

data/
├── satunData.js                 # ข้อมูลภัยพิบัติและพื้นที่
└── villagePolygonData.js        # ข้อมูล polygon หมู่บ้าน
```

## 🚀 การใช้งาน

### 1. เข้าถึงแผนที่น้ำท่วม
```
http://localhost:3000/flood-map
```

### 2. เข้าถึงแผนที่ภัยแล้ง
```
http://localhost:3000/drought-map
```

### 3. การใช้งานแผนที่

#### เปลี่ยนโหมดการแสดงสี
คลิกปุ่มที่แถบควบคุม:
- **ความเสี่ยง**: แสดงตามระดับความเสี่ยง
- **อำเภอ**: แสดงตามอำเภอ
- **ประชากร**: แสดงตามจำนวนครัวเรือน

#### กรองข้อมูล
เลือกตัวกรองที่ต้องการ:
1. เลือกช่วงเวลา
2. เลือกความรุนแรง
3. เลือกพื้นที่ (อำเภอ > ตำบล > หมู่บ้าน)
4. เลือกสถานะ

#### ดูข้อมูลรายละเอียด
- **คลิก Polygon**: ดูข้อมูลพื้นที่
- **คลิก Marker**: ดูข้อมูลเหตุการณ์
- **Hover**: เน้น polygon/marker

#### นำทางแผนที่
- **Zoom**: ใช้ scroll mouse หรือปุ่ม +/-
- **Pan**: คลิกลากเพื่อเลื่อน
- **Auto Fit**: แผนที่ปรับ bounds อัตโนมัติ

## 🎨 การปรับแต่ง

### เปลี่ยนสีความเสี่ยงน้ำท่วม
แก้ไขใน `components/HybridDisasterMap.js`:
```javascript
const getFloodRiskColor = (riskLevel) => {
    const colors = {
        'สูงมาก': '#DC2626',  // เปลี่ยนสีที่นี่
        'สูง': '#F59E0B',
        // ...
    };
    return colors[riskLevel] || '#6B7280';
};
```

### เปลี่ยนสีความเสี่ยงภัยแล้ง
แก้ไขใน `components/HybridDisasterMap.js`:
```javascript
const getDroughtRiskColor = (riskLevel) => {
    const colors = {
        'สูงมาก': '#7C2D12',  // เปลี่ยนสีที่นี่
        'สูง': '#EA580C',
        // ...
    };
    return colors[riskLevel] || '#6B7280';
};
```

### เพิ่มข้อมูลเหตุการณ์ภัยแล้ง
แก้ไขใน `app/drought-map/page.js`:
```javascript
const mockDroughtEvents = [
    {
        id: 101,
        type: "ภัยแล้ง",
        severity: "สูง",
        district: "ทุ่งหว้า",
        // ... เพิ่มข้อมูลที่นี่
    },
];
```

### ปรับปรุงการคำนวณความเสี่ยง
แก้ไขฟังก์ชัน `calculateRiskLevel` ใน `components/HybridDisasterMap.js`:
```javascript
const calculateRiskLevel = (polygon) => {
    // ใช้ข้อมูลจริงจาก database หรือ algorithm
    // ตัวอย่าง: พิจารณาจากระดับน้ำ, ประวัติน้ำท่วม, ฯลฯ
    return polygon.riskLevel;
};
```

## 📊 การเชื่อมต่อฐานข้อมูล

### เพิ่ม API สำหรับข้อมูลความเสี่ยง
สร้างไฟล์ `app/api/risk-assessment/route.js`:
```javascript
import { NextResponse } from 'next/server';
import mysql from 'mysql2/promise';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type'); // 'flood' or 'drought'
    
    // ดึงข้อมูลจาก database
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'stnEOC'
    });
    
    const [rows] = await connection.execute(
        'SELECT * FROM risk_assessment WHERE type = ?',
        [type]
    );
    
    return NextResponse.json(rows);
}
```

### สร้างตารางฐานข้อมูล
```sql
CREATE TABLE risk_assessment (
    id INT AUTO_INCREMENT PRIMARY KEY,
    polygon_id INT,
    risk_type VARCHAR(50), -- 'flood' or 'drought'
    risk_level VARCHAR(50),
    assessment_date DATE,
    details TEXT,
    FOREIGN KEY (polygon_id) REFERENCES satun_village_polygon(id)
);
```

## 🔧 การพัฒนาต่อ

### ฟีเจอร์ที่แนะนำ:

#### 1. ระบบพยากรณ์อากาศ
- เชื่อมต่อ Weather API
- แสดงพยากรณ์ฝน
- คำนวณความเสี่ยงล่วงหน้า

#### 2. การแจ้งเตือนอัตโนมัติ
- ส่ง SMS/LINE เมื่อความเสี่ยงสูง
- แจ้งเตือนตามพื้นที่
- ประวัติการแจ้งเตือน

#### 3. ระบบรายงานผล
- Export PDF/Excel
- สร้างรายงานสรุป
- กราฟและชาร์ต

#### 4. Historical Data
- เปรียบเทียบข้อมูลย้อนหลัง
- Trend analysis
- Heatmap แบบ timeline

#### 5. Mobile App
- Responsive design
- Geolocation
- Push notifications

#### 6. AI/ML Integration
- ทำนายความเสี่ยง
- Pattern recognition
- Anomaly detection

## 🐛 การแก้ปัญหา

### แผนที่ไม่แสดง Polygon
- ตรวจสอบ API `/api/village-polygons` ทำงานปกติ
- ตรวจสอบ console browser มี error
- ตรวจสอบ format coordinates

### สีไม่แสดงตามที่กำหนด
- ตรวจสอบค่า `riskLevel` ใน polygon data
- ตรวจสอบฟังก์ชัน `getPolygonColor`
- ตรวจสอบ `colorMode` state

### Filter ไม่ทำงาน
- ตรวจสอบ state `filters`
- ตรวจสอบ `useMemo` dependencies
- ตรวจสอบ event handlers

### Performance ช้า
- ลดจำนวน polygon points
- ใช้ React.memo สำหรับ components
- Implement virtualization
- ใช้ Web Workers

## 📝 หมายเหตุ

### ข้อมูลตัวอย่าง
- ข้อมูลภัยแล้งใน `/drought-map` เป็นข้อมูลตัวอย่าง (mock data)
- ควรแทนที่ด้วยข้อมูลจริงจาก database
- ข้อมูล `riskLevel` ควรมาจากระบบประเมินความเสี่ยงจริง

### การพัฒนาต่อ
- เพิ่มข้อมูลภัยแล้งใน `data/satunData.js`
- สร้าง API สำหรับดึงข้อมูลความเสี่ยง
- เพิ่มระบบประเมินความเสี่ยงอัตโนมัติ

## 📄 License
MIT License - ใช้งานได้อย่างอิสระ

## 👥 Credits
- ระบบ EOC จังหวัดสตูล
- React Leaflet
- OpenStreetMap
- Tailwind CSS
