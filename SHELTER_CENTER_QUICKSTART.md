# 🚀 Quick Start - ศูนย์พักพิงชั่วคราว

## การเริ่มต้นใช้งานอย่างรวดเร็ว

### 1. สร้างฐานข้อมูล

เปิด phpMyAdmin หรือ MySQL client และรันคำสั่ง:

```bash
mysql -u root -p your_database < create_shelter_centers_table.sql
```

หรือคัดลอก SQL ด้านล่างไปรันใน phpMyAdmin:

```sql
-- Create table for Shelter Centers
CREATE TABLE IF NOT EXISTS shelter_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sheltername VARCHAR(255) NOT NULL,
    lat DECIMAL(10, 7) NOT NULL,
    lon DECIMAL(10, 7) NOT NULL,
    address TEXT,
    tambon VARCHAR(100) NOT NULL,
    district_name VARCHAR(100),
    is_active TINYINT(1) DEFAULT 1,
    shelter_capacity INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_tambon (tambon),
    INDEX idx_district (district_name),
    INDEX idx_active (is_active)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Create occupancy tracking table
CREATE TABLE IF NOT EXISTS shelter_occupancy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelter_id INT NOT NULL,
    eoc_session_id INT NOT NULL,
    current_occupancy INT DEFAULT 0,
    max_occupancy_reached INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY unique_shelter_session (shelter_id, eoc_session_id),
    FOREIGN KEY (shelter_id) REFERENCES shelter_centers(id) ON DELETE CASCADE,
    INDEX idx_session (eoc_session_id),
    INDEX idx_occupancy (current_occupancy)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert sample data
INSERT INTO shelter_centers (sheltername, lat, lon, address, tambon, district_name, is_active, shelter_capacity) VALUES
('ศูนย์พักพิงชั่วคราวโรงเรียนบ้านควนกาหลง', 6.7234, 100.0823, '123 หมู่ 1', 'ควนกาหลง', 'เมืองสตูล', 1, 500),
('ศูนย์พักพิงชั่วคราววัดประจำตำบล', 6.6845, 100.0512, '89 หมู่ 3', 'คลองขุด', 'เมืองสตูล', 1, 300),
('ศูนย์พักพิงชั่วคราวโรงเรียนบ้านตันหยงโป', 6.5234, 100.1234, '45 หมู่ 2', 'ตันหยงโป', 'เมืองสตูล', 1, 400),
('ศูนย์พักพิงชั่วคราวหอประชุมอำเภอ', 6.6238, 100.0673, '12 ถนนสตูล-ควนโดน', 'พิมาน', 'เมืองสตูล', 1, 800),
('ศูนย์พักพิงชั่วคราวโรงเรียนบ้านทุ่งนุ้ย', 6.7845, 100.1523, '67 หมู่ 4', 'ทุ่งนุ้ย', 'ควนโดน', 1, 350);
```

### 2. ติดตั้ง Package

```bash
npm install leaflet
```

### 3. เปิดใช้งานหน้า Admin

เข้าถึงผ่าน URL:
```
http://localhost:3000/admin/shelter-center
```

## ✅ ฟีเจอร์ที่พร้อมใช้งาน

- ✅ เพิ่ม/แก้ไข/ลบศูนย์พักพิง
- ✅ เลือกตำแหน่งบนแผนที่ (Interactive Map)
- ✅ แสดงสถิติรวม
- ✅ ค้นหาและกรอง
- ✅ API สำหรับ EOC Session
- ✅ ติดตามจำนวนผู้พักพิง

## 📂 ไฟล์ที่สร้างขึ้น

```
app/
├── admin/shelter-center/
│   └── page.jsx                    ✅ หน้าจัดการศูนย์พักพิง
├── api/admin/shelter-center/
│   └── route.js                    ✅ CRUD API
└── api/eoc/shelter-centers/
    └── route.js                    ✅ EOC Session API

components/
└── MapSelector.jsx                 ✅ Map Component

create_shelter_centers_table.sql    ✅ SQL Schema
SHELTER_CENTER_README.md            ✅ เอกสารฉบับเต็ม
SHELTER_CENTER_QUICKSTART.md        ✅ Quick Start
```

## 🎯 การใช้งานเบื้องต้น

### 1. เพิ่มศูนย์พักพิงใหม่
1. คลิกปุ่ม "➕ เพิ่มศูนย์พักพิงชั่วคราว"
2. กรอกข้อมูล:
   - ชื่อศูนย์พักพิง *
   - ตำบล *
   - ความจุ (คน) *
3. คลิกบนแผนที่เพื่อเลือกตำแหน่ง
4. คลิก "บันทึก"

### 2. แก้ไขข้อมูล
1. คลิกปุ่ม ✏️ ที่ต้องการแก้ไข
2. แก้ไขข้อมูลในฟอร์ม
3. คลิก "บันทึก"

### 3. ลบข้อมูล
1. คลิกปุ่ม 🗑️ ที่ต้องการลบ
2. ยืนยันการลบ

## 🗺️ ใช้งาน Map Component ในหน้าอื่น

```jsx
import dynamic from 'next/dynamic';

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false
});

function MyPage() {
    const [position, setPosition] = useState(null);

    return (
        <MapSelector 
            position={position}
            onPositionChange={setPosition}
        />
    );
}
```

## 📡 ใช้งาน API

### Get All Shelters
```javascript
const response = await fetch('/api/admin/shelter-center');
const data = await response.json();
```

### Get Shelters with EOC Session
```javascript
const response = await fetch('/api/eoc/shelter-centers?session_id=123');
const data = await response.json();
```

### Update Occupancy
```javascript
await fetch('/api/eoc/shelter-centers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        shelter_id: 1,
        eoc_session_id: 123,
        current_occupancy: 250
    })
});
```

## 🎨 สถานะการใช้งาน

- 🟢 **Available** (ว่าง): น้อยกว่า 80% ของความจุ
- 🟡 **Near Full** (ใกล้เต็ม): 80-99% ของความจุ
- 🔴 **Full** (เต็ม): 100% หรือมากกว่า

## 🔧 Troubleshooting

### แผนที่ไม่แสดง?
ตรวจสอบว่าได้ติดตั้ง `leaflet` แล้ว:
```bash
npm install leaflet
```

### Database Connection Error?
ตรวจสอบการตั้งค่าใน `lib/db.jsx`

### API Error?
ตรวจสอบว่าสร้างตารางในฐานข้อมูลเรียบร้อยแล้ว

## 📚 เอกสารเพิ่มเติม

อ่านเอกสารฉบับเต็มได้ที่: `SHELTER_CENTER_README.md`

## 🎉 เริ่มต้นใช้งาน

ระบบพร้อมใช้งานแล้ว! เข้าไปที่:
```
http://localhost:3000/admin/shelter-center
```

---

**หมายเหตุ:** หากพบปัญหาหรือต้องการความช่วยเหลือ กรุณาดูเอกสารเพิ่มเติมหรือติดต่อทีมพัฒนา
