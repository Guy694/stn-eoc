# ระบบจัดการศูนย์พักพิงชั่วคราว (Shelter Center Management System)

## 📋 ภาพรวม

ระบบจัดการศูนย์พักพิงชั่วคราวเพื่อใช้ในการจัดการและติดตามสถานที่พักพิงในสถานการณ์ภัยพิบัติ พร้อมการแสดงผลบนแผนที่และติดตามจำนวนผู้พักพิงในแต่ละ EOC Session

## 🎯 คุณสมบัติหลัก

### 1. การจัดการข้อมูลศูนย์พักพิง (Admin)
- ✅ เพิ่ม/แก้ไข/ลบข้อมูลศูนย์พักพิงชั่วคราว
- 📍 เลือกตำแหน่งบนแผนที่ด้วย Interactive Map
- 📊 แสดงสถิติภาพรวม (จำนวนศูนย์, ความจุรวม)
- 🔍 ค้นหาและกรองข้อมูล
- ✏️ จัดการสถานะเปิด/ปิดใช้งาน

### 2. การติดตามจำนวนผู้พักพิง (EOC Session)
- 📈 บันทึกจำนวนผู้พักพิงปัจจุบัน
- 🔴 แสดงสถานะความว่าง (Available/Near Full/Full)
- 📊 ติดตามจำนวนสูงสุดที่เคยมี
- 🗺️ แสดงศูนย์พักพิงบนแผนที่ตามแต่ละ Session

## 📁 โครงสร้างไฟล์

```
app/
├── admin/
│   └── shelter-center/
│       └── page.jsx                    # หน้าจัดการศูนย์พักพิง (Admin)
├── api/
│   ├── admin/
│   │   └── shelter-center/
│   │       └── route.js                # API สำหรับ CRUD ศูนย์พักพิง
│   └── eoc/
│       └── shelter-centers/
│           └── route.js                # API สำหรับ EOC Session
components/
└── MapSelector.jsx                      # Component แผนที่สำหรับเลือกตำแหน่ง
```

## 🗄️ Database Schema

### ตาราง `shelter_centers`
```sql
CREATE TABLE shelter_centers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    sheltername VARCHAR(255) NOT NULL,      -- ชื่อศูนย์พักพิง
    lat DECIMAL(10, 7) NOT NULL,            -- ละติจูด
    lon DECIMAL(10, 7) NOT NULL,            -- ลองจิจูด
    address TEXT,                           -- ที่อยู่
    tambon VARCHAR(100) NOT NULL,           -- ตำบล
    district_name VARCHAR(100),             -- อำเภอ
    is_active TINYINT(1) DEFAULT 1,         -- สถานะ (1=เปิด, 0=ปิด)
    shelter_capacity INT NOT NULL,          -- ความจุ (คน)
    created_at TIMESTAMP,
    updated_at TIMESTAMP
);
```

### ตาราง `shelter_occupancy`
```sql
CREATE TABLE shelter_occupancy (
    id INT AUTO_INCREMENT PRIMARY KEY,
    shelter_id INT NOT NULL,                -- รหัสศูนย์พักพิง
    eoc_session_id INT NOT NULL,            -- รหัส EOC Session
    current_occupancy INT DEFAULT 0,        -- จำนวนผู้พักพิงปัจจุบัน
    max_occupancy_reached INT DEFAULT 0,    -- จำนวนสูงสุดที่เคยมี
    created_at TIMESTAMP,
    last_updated TIMESTAMP,
    UNIQUE KEY (shelter_id, eoc_session_id)
);
```

## 🔧 การติดตั้ง

### 1. สร้างตารางในฐานข้อมูล
```bash
mysql -u root -p your_database < create_shelter_centers_table.sql
```

### 2. ติดตั้ง Package ที่จำเป็น
```bash
npm install leaflet
```

### 3. เพิ่ม CSS ใน layout
แก้ไขไฟล์ `app/layout.jsx`:
```jsx
import 'leaflet/dist/leaflet.css';
```

## 📡 API Endpoints

### Admin APIs (`/api/admin/shelter-center`)

#### GET - ดึงข้อมูลศูนย์พักพิงทั้งหมด
```javascript
fetch('/api/admin/shelter-center')
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sheltername": "ศูนย์พักพิงชั่วคราวโรงเรียนบ้านควนกาหลง",
      "lat": "6.7234000",
      "lon": "100.0823000",
      "address": "123 หมู่ 1",
      "tambon": "ควนกาหลง",
      "district_name": "เมืองสตูล",
      "is_active": 1,
      "shelter_capacity": 500
    }
  ]
}
```

#### POST - เพิ่มศูนย์พักพิงใหม่
```javascript
fetch('/api/admin/shelter-center', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    sheltername: "ศูนย์พักพิงชั่วคราวโรงเรียน...",
    lat: 6.7234,
    lon: 100.0823,
    address: "123 หมู่ 1",
    tambon: "ควนกาหลง",
    district_name: "เมืองสตูล",
    is_active: 1,
    shelter_capacity: 500
  })
})
```

#### PUT - แก้ไขข้อมูล
```javascript
fetch('/api/admin/shelter-center?id=1', {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ /* ข้อมูลที่จะแก้ไข */ })
})
```

#### DELETE - ลบศูนย์พักพิง
```javascript
fetch('/api/admin/shelter-center?id=1', {
  method: 'DELETE'
})
```

### EOC APIs (`/api/eoc/shelter-centers`)

#### GET - ดึงข้อมูลศูนย์พักพิงพร้อมสถานะการใช้งาน
```javascript
// ดึงข้อมูลทั้งหมด
fetch('/api/eoc/shelter-centers')

// ดึงข้อมูลตาม Session ID
fetch('/api/eoc/shelter-centers?session_id=123')
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sheltername": "ศูนย์พักพิงชั่วคราว...",
      "shelter_capacity": 500,
      "current_occupancy": 250,
      "max_occupancy_reached": 380,
      "occupancy_status": "available",  // available | near_full | full
      "lat": "6.7234000",
      "lon": "100.0823000"
    }
  ]
}
```

#### POST - อัพเดทจำนวนผู้พักพิง
```javascript
fetch('/api/eoc/shelter-centers', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    shelter_id: 1,
    eoc_session_id: 123,
    current_occupancy: 250
  })
})
```

## 💻 การใช้งาน

### 1. หน้าจัดการศูนย์พักพิง (Admin)

เข้าถึงผ่าน: `/admin/shelter-center`

**ฟีเจอร์:**
- 📊 Dashboard แสดงสถิติรวม
- ➕ เพิ่มศูนย์พักพิงใหม่
- 🗺️ เลือกตำแหน่งบนแผนที่แบบ Interactive
- ✏️ แก้ไขข้อมูล
- 🗑️ ลบข้อมูล
- 🔍 ค้นหาและกรอง

### 2. การใช้งานใน EOC Session

```jsx
import { useState, useEffect } from 'react';

function ShelterMap({ sessionId }) {
  const [shelters, setShelters] = useState([]);

  useEffect(() => {
    fetchShelters();
  }, [sessionId]);

  const fetchShelters = async () => {
    const response = await fetch(`/api/eoc/shelter-centers?session_id=${sessionId}`);
    const result = await response.json();
    if (result.success) {
      setShelters(result.data);
    }
  };

  const updateOccupancy = async (shelterId, occupancy) => {
    await fetch('/api/eoc/shelter-centers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        shelter_id: shelterId,
        eoc_session_id: sessionId,
        current_occupancy: occupancy
      })
    });
    fetchShelters(); // Refresh data
  };

  return (
    <div>
      {shelters.map(shelter => (
        <div key={shelter.id}>
          <h3>{shelter.sheltername}</h3>
          <p>ความจุ: {shelter.current_occupancy}/{shelter.shelter_capacity}</p>
          <p>สถานะ: {shelter.occupancy_status}</p>
        </div>
      ))}
    </div>
  );
}
```

## 🎨 MapSelector Component

Component สำหรับเลือกตำแหน่งบนแผนที่:

```jsx
import MapSelector from '@/components/MapSelector';

function MyForm() {
  const [position, setPosition] = useState(null);

  return (
    <MapSelector 
      position={position}
      onPositionChange={setPosition}
    />
  );
}
```

**Props:**
- `position`: `{ lat: number, lng: number }` - ตำแหน่งปัจจุบัน
- `onPositionChange`: `(position) => void` - Callback เมื่อตำแหน่งเปลี่ยน

## 📊 Occupancy Status Logic

```javascript
// available: น้อยกว่า 80% ของความจุ
// near_full: 80-99% ของความจุ
// full: 100% หรือมากกว่า

const status = current >= capacity ? 'full' 
             : current >= capacity * 0.8 ? 'near_full' 
             : 'available';
```

## 🎨 สีแสดงสถานะ

```javascript
const statusColors = {
  available: 'bg-green-100 text-green-800',    // เขียว - ว่าง
  near_full: 'bg-yellow-100 text-yellow-800',  // เหลือง - ใกล้เต็ม
  full: 'bg-red-100 text-red-800'              // แดง - เต็ม
};
```

## 🔐 Security Considerations

1. **Authentication**: ควรเพิ่ม middleware ตรวจสอบสิทธิ์สำหรับ Admin APIs
2. **Validation**: ตรวจสอบข้อมูลที่รับเข้ามาทุกครั้ง
3. **SQL Injection**: ใช้ Prepared Statements (ทำแล้ว)
4. **Authorization**: จำกัดการเข้าถึงตาม Role

## 🚀 ฟีเจอร์ที่สามารถเพิ่มเติม

1. **Real-time Updates**: ใช้ WebSocket สำหรับ real-time tracking
2. **Mobile App**: พัฒนา Mobile App สำหรับเจ้าหน้าที่ในพื้นที่
3. **QR Code**: สร้าง QR Code สำหรับลงทะเบียนผู้พักพิง
4. **Reports**: สร้างรายงานสถิติการใช้งาน
5. **Notifications**: แจ้งเตือนเมื่อศูนย์พักพิงใกล้เต็ม
6. **Photos**: เพิ่มรูปภาพศูนย์พักพิง
7. **Amenities**: ระบุสิ่งอำนวยความสะดวก (น้ำ, ไฟฟ้า, ห้องน้ำ)
8. **Route Planning**: ระบบนำทางไปยังศูนย์พักพิง

## 🐛 การแก้ไขปัญหา

### แผนที่ไม่แสดง
```javascript
// ตรวจสอบว่าได้ import CSS แล้ว
import 'leaflet/dist/leaflet.css';

// หรือใช้ dynamic import
const MapSelector = dynamic(() => import('@/components/MapSelector'), {
  ssr: false
});
```

### Marker ไม่แสดง
```javascript
// ตรวจสอบ Icon configuration ใน MapSelector.jsx
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  // ...
});
```

### Database Connection Error
```javascript
// ตรวจสอบการตั้งค่าใน lib/db.jsx
// ตรวจสอบว่า MySQL service ทำงานอยู่
```

## 📝 License

MIT License - ใช้งานได้อย่างอิสระในโครงการ EOC

## 👥 Support

หากมีปัญหาหรือข้อสงสัย กรุณาติดต่อทีมพัฒนา

---

**Version**: 1.0.0  
**Last Updated**: January 2026  
**Developed for**: STN-EOC System
