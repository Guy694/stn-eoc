# ระบบแผนที่น้ำท่วมรายวัน (Daily Flood Timeline)

## คุณสมบัติหลัก

### 1. แสดงแผนที่รายวัน
- แสดงพื้นที่น้ำท่วมแบบ polygon สีสัน ตามระดับความรุนแรง
- Timeline เลือกวันที่ตั้งแต่เปิด EOC จนถึงปัจจุบัน
- อัพเดทแผนที่แบบเรียลไทม์เมื่อเลือกวันที่

### 2. ระดับความรุนแรง (Flood Levels)
- 🔴 **น้ำท่วมหนัก (Severe)** - สีแดง (#DC2626)
- 🟡 **น้ำท่วมปานกลาง (Moderate)** - สีเหลือง (#FBBF24)
- 🟢 **น้ำท่วมเล็กน้อย (Mild)** - สีเขียวอ่อน (#34D399)
- ✅ **ปลอดภัย (Safe)** - สีเขียว (#10B981)
- ⚪ **ไม่มีข้อมูล (No Data)** - สีเทา (#E5E7EB)

### 3. ดาวน์โหลดภาพแผนที่
- กดปุ่ม "ดาวน์โหลดภาพ" เพื่อบันทึกแผนที่เป็นไฟล์ PNG
- รองรับคุณภาพสูง (Scale 2x)
- ชื่อไฟล์: `flood-map-{วันที่}.png`

### 4. สถิติแบบเรียลไทม์
- จำนวนอำเภอที่น้ำท่วมหนัก
- จำนวนอำเภอที่น้ำท่วมปานกลาง
- จำนวนอำเภอที่น้ำท่วมเล็กน้อย
- จำนวนผู้ได้รับผลกระทบทั้งหมด

### 5. รายละเอียดอำเภอ
- แสดงรายชื่ออำเภอทั้งหมด
- ระดับน้ำท่วมแต่ละอำเภอ
- จำนวนประชากรได้รับผลกระทบ

## การติดตั้ง

### 1. ติดตั้ง Dependencies
```bash
npm install html2canvas
```

### 2. สร้างตารางฐานข้อมูล
```bash
# เชื่อมต่อ MySQL
mysql -u root -p

# สร้างตาราง
source create_daily_flood_tables.sql

# เพิ่มข้อมูลตัวอย่าง
source insert_daily_flood_sample.sql
```

### 3. นำ Component ไปใช้งาน

#### ในหน้า flood-map
```javascript
import DailyFloodTimeline from "@/components/DailyFloodTimeline";

// ใน component
<DailyFloodTimeline 
    startDate="2025-12-01" 
    polygons={polygons}
/>
```

#### ในหน้า drought-map
```javascript
import DailyFloodTimeline from "@/components/DailyFloodTimeline";

// ใน component
<DailyFloodTimeline 
    startDate="2025-12-01" 
    polygons={polygons}
/>
```

## API Endpoints

### GET /api/daily-flood
ดึงข้อมูลพื้นที่น้ำท่วมรายวัน

**Query Parameters:**
- `date` (optional) - วันที่ต้องการ (YYYY-MM-DD)

**Response:**
```json
{
  "date": "2025-12-09",
  "districts": [
    {
      "name": "เมืองสตูล",
      "level": "mild",
      "affectedArea": 15.0,
      "population": 3000
    }
  ],
  "summary": {
    "totalAffected": 1,
    "severeCount": 0,
    "moderateCount": 0,
    "mildCount": 1,
    "totalPopulation": 3000
  }
}
```

## โครงสร้างฐานข้อมูล

### ตาราง: daily_flood_status
เก็บข้อมูลสถานการณ์น้ำท่วมรายอำเภอ-รายวัน

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary Key |
| record_date | DATE | วันที่บันทึก |
| district_name | VARCHAR(100) | ชื่ออำเภอ |
| flood_level | ENUM | ระดับน้ำท่วม (safe, mild, moderate, severe) |
| affected_area | DECIMAL(10,2) | พื้นที่ได้รับผลกระทบ (ตร.กม.) |
| affected_population | INT | ประชากรได้รับผลกระทบ (คน) |
| water_level | DECIMAL(5,2) | ระดับน้ำ (เมตร) |

### ตาราง: daily_summary
สรุปสถานการณ์รายวัน

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary Key |
| record_date | DATE | วันที่บันทึก |
| total_affected_districts | INT | จำนวนอำเภอได้รับผลกระทบ |
| severe_count | INT | จำนวนอำเภอน้ำท่วมหนัก |
| moderate_count | INT | จำนวนอำเภอน้ำท่วมปานกลาง |
| mild_count | INT | จำนวนอำเภอน้ำท่วมเล็กน้อย |
| total_population | INT | ประชากรรวมได้รับผลกระทบ |
| notes | TEXT | หมายเหตุ |

### ตาราง: daily_flood_maps
เก็บภาพแผนที่รายวัน

| Column | Type | Description |
|--------|------|-------------|
| id | INT | Primary Key |
| record_date | DATE | วันที่บันทึก |
| map_image | LONGBLOB | ไฟล์ภาพแผนที่ |
| image_url | VARCHAR(255) | URL ภาพ (ถ้าเก็บแยก) |
| file_name | VARCHAR(255) | ชื่อไฟล์ |
| created_by | INT | officer_id ผู้บันทึก |

## การใช้งาน

### 1. เปิดหน้า flood-map หรือ drought-map
```
http://localhost:3000/flood-map
http://localhost:3000/drought-map
```

### 2. เลื่อนลงมาด้านล่างแผนที่หลัก
จะพบส่วน **"แผนที่สถานการณ์น้ำท่วมรายวัน"**

### 3. เลือกวันที่จาก Timeline
- กดปุ่มวันที่ที่ต้องการดู
- แผนที่จะอัพเดทตามข้อมูลของวันนั้น

### 4. ดาวน์โหลดภาพ
- กดปุ่ม "ดาวน์โหลดภาพ" ที่มุมขวาบน
- ไฟล์จะถูกบันทึกเป็น PNG

## คุณสมบัติเพิ่มเติม

### Responsive Design
- รองรับการแสดงผลบนมือถือ
- Timeline สามารถเลื่อนซ้าย-ขวาได้
- Grid layout ปรับขนาดอัตโนมัติ

### Real-time Updates
- ดึงข้อมูลจาก API ทุกครั้งที่เลือกวันที่
- แสดง Loading indicator ระหว่างโหลด

### Color Coding
- ใช้สีตามมาตรฐานการแจ้งเตือนภัย
- สอดคล้องกับภาพตัวอย่างที่แนบมา

## การพัฒนาต่อ

### เชื่อมต่อ Database จริง
ปรับแก้ไฟล์ `/app/api/daily-flood/route.js`:

```javascript
import mysql from 'mysql2/promise';

export async function GET(request) {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get('date');
    
    const connection = await mysql.createConnection({
        host: 'localhost',
        user: 'root',
        password: '',
        database: 'eoc_satun'
    });
    
    const [rows] = await connection.execute(
        'SELECT * FROM daily_flood_status WHERE record_date = ?',
        [date]
    );
    
    // จัดรูปแบบข้อมูลและส่งกลับ
    // ...
}
```

### เพิ่มการอัพโหลดภาพ
```javascript
// บันทึกภาพลง database
const saveImage = async (imageBlob, date) => {
    const formData = new FormData();
    formData.append('image', imageBlob);
    formData.append('date', date);
    
    await fetch('/api/daily-flood/upload', {
        method: 'POST',
        body: formData
    });
};
```

### เพิ่มการแจ้งเตือน
```javascript
// เมื่อระดับน้ำเพิ่มขึ้น
if (newLevel > previousLevel) {
    showNotification('⚠️ ระดับน้ำเพิ่มขึ้น!');
}
```

## ตัวอย่างข้อมูล

ระบบมีข้อมูลตัวอย่าง 9 วัน (1-9 ธ.ค. 2568):
- **วันที่ 1-2**: เริ่มมีน้ำท่วม
- **วันที่ 3-5**: สถานการณ์รุนแรงสูงสุด
- **วันที่ 6-9**: น้ำลดลงเรื่อยๆ

## การแก้ไขปัญหา

### ภาพไม่ดาวน์โหลด
- ตรวจสอบ permission ของ browser
- ลองใช้ browser อื่น

### แผนที่ไม่แสดง
- ตรวจสอบ Console ว่ามี error หรือไม่
- ตรวจสอบการเชื่อมต่อ API

### ข้อมูลไม่ถูกต้อง
- ตรวจสอบข้อมูลใน database
- ตรวจสอบ date format (ต้องเป็น YYYY-MM-DD)

## License
MIT

## ผู้พัฒนา
ศูนย์อำนวยการป้องกันและบรรเทาสาธารณภัย (EOC) จังหวัดสตูล
