# 🏕️ ระบบศูนย์พักพิงแบบแบ่งตาม EOC

## 📋 ภาพรวมการอัพเดท

ระบบศูนย์พักพิงชั่วคราวได้รับการปรับปรุงให้รองรับการแบ่งตามประเภท EOC เพื่อให้การจัดการง่ายและชัดเจนขึ้น

## ✨ คุณสมบัติใหม่

### 1. **แบ่งตามประเภท EOC**
ศูนย์พักพิงแต่ละแห่งจะถูกจัดประเภทตามภัยพิบัติ:
- 💧 **น้ำท่วม (Flood)** - ศูนย์พักคนในพื้นที่น้ำท่วม
- 🌵 **ภัยแล้ง (Drought)** - ศูนย์บริการน้ำและอาหาร
- 🌊 **สึนามิ (Tsunami)** - ศูนย์พักพิงฉุกเฉินชายฝั่ง
- 🏚️ **แผ่นดินไหว (Earthquake)** - ศูนย์พักพิงหลังแผ่นดินไหว
- 🦠 **โรคระบาด (Disease)** - ศูนย์กักกัน/รักษา

### 2. **สถิติแยกตามประเภท**
- แสดงจำนวนศูนย์พักพิงแต่ละประเภท
- แสดงความจุรวมของแต่ละประเภท
- Dashboard แสดงภาพรวมทุกประเภท

### 3. **Filter ตามประเภท EOC**
- กรองข้อมูลตามประเภทภัยพิบัติ
- ค้นหาศูนย์พักพิงได้รวดเร็ว

### 4. **เลือกจากประวัติเมื่อเปิด EOC ใหม่**
- เมื่อเปิด EOC ใหม่ ระบบจะดึงข้อมูลศูนย์พักพิงตามประเภทที่เคยบันทึกไว้
- ไม่ต้องกรอกข้อมูลซ้ำ เลือกจากประวัติได้เลย

## 🗄️ การอัพเดทฐานข้อมูล

### สำหรับตารางเดิมที่มีข้อมูลอยู่แล้ว
รันไฟล์: `update_shelter_centers_add_eoc_type.sql`

```bash
mysql -u root -p your_database < update_shelter_centers_add_eoc_type.sql
```

หรือคัดลอก SQL ไปรันใน phpMyAdmin

### สำหรับตารางใหม่
รันไฟล์: `create_shelter_centers_table.sql` (ได้อัพเดทแล้ว)

```bash
mysql -u root -p your_database < create_shelter_centers_table.sql
```

## 📱 การใช้งาน

### หน้า Admin (`/admin/shelter-center`)

#### 1. เพิ่มศูนย์พักพิงใหม่
1. คลิกปุ่ม "➕ เพิ่มศูนย์พักพิงชั่วคราว"
2. กรอกข้อมูล:
   - **ชื่อศูนย์พักพิง** * (บังคับ)
   - **ประเภท EOC** * (บังคับ) - เลือกประเภทภัยพิบัติ
   - **ตำบล** * (บังคับ)
   - **ความจุ (คน)** * (บังคับ)
   - ที่อยู่, อำเภอ (ถ้ามี)
3. **คลิกบนแผนที่** เพื่อระบุตำแหน่ง
4. คลิก "บันทึก"

#### 2. กรองข้อมูล
- **ค้นหา**: พิมพ์ชื่อ, ที่อยู่, หรือตำบล
- **Filter ประเภท EOC**: เลือกประเภทจาก dropdown

#### 3. แก้ไขข้อมูล
1. คลิกปุ่ม ✏️ ที่ต้องการแก้ไข
2. แก้ไขข้อมูล (รวมถึงเปลี่ยนประเภท EOC ได้)
3. คลิก "บันทึก"

#### 4. ลบข้อมูล
1. คลิกปุ่ม 🗑️ ที่ต้องการลบ
2. ยืนยันการลบ

### การใช้งานใน EOC Session

#### API สำหรับดึงศูนย์พักพิงตามประเภท EOC

```javascript
// ดึงศูนย์พักพิงสำหรับ EOC น้ำท่วม
const response = await fetch('/api/eoc/shelter-centers?eoc_type=flood&session_id=123');
const data = await response.json();

// ผลลัพธ์
{
  "success": true,
  "data": [
    {
      "id": 1,
      "sheltername": "ศูนย์พักพิงน้ำท่วม - โรงเรียน...",
      "eoc_type": "flood",
      "current_occupancy": 250,
      "shelter_capacity": 500,
      "occupancy_status": "available", // available | near_full | full
      ...
    }
  ]
}
```

#### ตัวอย่างการใช้งานในหน้า EOC

```jsx
import { useState, useEffect } from 'react';
import { useEOC } from '@/context/EOCContext';

function FloodEOCPage() {
  const [shelters, setShelters] = useState([]);
  const { currentSession } = useEOC();

  useEffect(() => {
    fetchShelters();
  }, [currentSession]);

  const fetchShelters = async () => {
    // ดึงเฉพาะศูนย์พักพิงประเภทน้ำท่วม
    const response = await fetch(
      `/api/eoc/shelter-centers?eoc_type=flood&session_id=${currentSession.id}`
    );
    const result = await response.json();
    
    if (result.success) {
      setShelters(result.data);
    }
  };

  return (
    <div>
      <h1>ศูนย์พักพิงน้ำท่วม</h1>
      {shelters.map(shelter => (
        <div key={shelter.id}>
          <h3>{shelter.sheltername}</h3>
          <p>ความจุ: {shelter.current_occupancy}/{shelter.shelter_capacity}</p>
          <span className={`status-${shelter.occupancy_status}`}>
            {shelter.occupancy_status === 'available' && '🟢 ว่าง'}
            {shelter.occupancy_status === 'near_full' && '🟡 ใกล้เต็ม'}
            {shelter.occupancy_status === 'full' && '🔴 เต็ม'}
          </span>
        </div>
      ))}
    </div>
  );
}
```

## 📊 Dashboard และสถิติ

### สถิติที่แสดง

1. **ทั้งหมด** - จำนวนศูนย์พักพิงทั้งหมด
2. **เปิดใช้งาน** - จำนวนที่พร้อมใช้งาน
3. **ปิดใช้งาน** - จำนวนที่ปิดชั่วคราว
4. **ความจุรวม** - ความจุรวมทุกศูนย์
5. **แยกตามประเภท** - แต่ละประเภท EOC แสดง:
   - จำนวนศูนย์พักพิง
   - ความจุรวม (ในวงเล็บ)

## 🎨 สีประจำประเภท EOC

- 🔵 **น้ำท่วม** - สีน้ำเงิน (Blue)
- 🟡 **ภัยแล้ง** - สีเหลือง (Yellow)
- 🟦 **สึนามิ** - สีฟ้า (Cyan)
- 🟠 **แผ่นดินไหว** - สีส้ม (Orange)
- 🔴 **โรคระบาด** - สีแดง (Red)

## 🔄 Workflow การใช้งานจริง

### Scenario 1: เปิด EOC น้ำท่วมใหม่

1. ผู้ดูแลเปิด EOC Session ใหม่ประเภท "น้ำท่วม"
2. ระบบดึงรายการศูนย์พักพิงประเภทน้ำท่วมที่เคยบันทึกไว้
3. เจ้าหน้าที่เลือกศูนย์พักพิงที่ต้องการเปิดใช้งาน
4. เริ่มบันทึกจำนวนผู้พักพิง

### Scenario 2: เพิ่มศูนย์พักพิงใหม่

1. ไปที่ `/admin/shelter-center`
2. คลิก "เพิ่มศูนย์พักพิงชั่วคราว"
3. **เลือกประเภท EOC** ที่เหมาะสม
4. กรอกข้อมูลและปักหมุดบนแผนที่
5. บันทึก

### Scenario 3: ใช้งานในหลาย EOC

- ศูนย์พักพิงเดียวกันสามารถใช้ในหลาย EOC Session ได้
- ข้อมูลการใช้งานจะแยกตาม Session
- ประวัติการใช้งานจะถูกเก็บไว้

## 🔧 API Reference

### GET `/api/admin/shelter-center`
ดึงข้อมูลศูนย์พักพิงทั้งหมด (สำหรับ Admin)

**Query Parameters:**
- `eoc_type` (optional): กรองตามประเภท EOC

```javascript
// ดึงทั้งหมด
GET /api/admin/shelter-center

// ดึงเฉพาะน้ำท่วม
GET /api/admin/shelter-center?eoc_type=flood
```

### POST `/api/admin/shelter-center`
เพิ่มศูนย์พักพิงใหม่

**Body:**
```json
{
  "sheltername": "ศูนย์พักพิงน้ำท่วม...",
  "eoc_type": "flood",
  "lat": 6.7234,
  "lon": 100.0823,
  "address": "123 หมู่ 1",
  "tambon": "ควนกาหลง",
  "district_name": "เมืองสตูล",
  "is_active": 1,
  "shelter_capacity": 500
}
```

### PUT `/api/admin/shelter-center?id=1`
แก้ไขข้อมูลศูนย์พักพิง

### DELETE `/api/admin/shelter-center?id=1`
ลบศูนย์พักพิง

### GET `/api/eoc/shelter-centers`
ดึงศูนย์พักพิงสำหรับ EOC Session

**Query Parameters:**
- `session_id` (optional): รหัส EOC Session
- `eoc_type` (optional): กรองตามประเภท EOC

```javascript
// ดึงศูนย์พักพิงน้ำท่วมสำหรับ Session 123
GET /api/eoc/shelter-centers?eoc_type=flood&session_id=123

// ดึงศูนย์พักพิงทั้งหมดที่เปิดใช้งาน
GET /api/eoc/shelter-centers
```

### POST `/api/eoc/shelter-centers`
อัพเดทจำนวนผู้พักพิง

**Body:**
```json
{
  "shelter_id": 1,
  "eoc_session_id": 123,
  "current_occupancy": 250
}
```

## 💡 Tips และ Best Practices

### 1. การตั้งชื่อศูนย์พักพิง
- ควรระบุประเภท EOC ในชื่อ เช่น "ศูนย์พักพิงน้ำท่วม - โรงเรียน..."
- ช่วยให้แยกแยะได้ง่าย

### 2. การเลือกประเภท EOC
- **น้ำท่วม**: ศูนย์พักคนเมื่อเกิดน้ำท่วม (ส่วนใหญ่)
- **ภัยแล้ง**: จุดบริการน้ำ, อาหาร
- **สึนามิ**: จุดพักฉุกเฉินชายฝั่ง (ที่สูง)
- **แผ่นดินไหว**: พื้นที่รองรับหลังแผ่นดินไหว
- **โรคระบาด**: ศูนย์กักกัน, โรงพยาบาลสนาม

### 3. การจัดการความจุ
- ระบุความจุที่เป็นจริง
- อัพเดทสถานะเมื่อมีการเปลี่ยนแปลง
- ตรวจสอบสถานะก่อนส่งผู้พักพิงไป

### 4. การใช้แผนที่
- ปักหมุดให้ตรงกับตำแหน่งจริง
- อัพเดทพิกัดเมื่อมีการเปลี่ยนแปลง

## 🐛 Troubleshooting

### ปัญหา: ไม่สามารถบันทึกได้
**สาเหตุ**: ตารางยังไม่มีฟิลด์ `eoc_type`
**แก้ไข**: รัน `update_shelter_centers_add_eoc_type.sql`

### ปัญหา: ไม่เห็นข้อมูลเก่า
**สาเหตุ**: ข้อมูลเก่ายังไม่ได้กำหนดประเภท EOC
**แก้ไข**: แก้ไขข้อมูลเก่าและเลือกประเภท EOC

### ปัญหา: Filter ไม่ทำงาน
**สาเหตุ**: Browser cache
**แก้ไข**: Refresh หน้า (Ctrl+Shift+R)

## 📚 อ่านเพิ่มเติม

- [SHELTER_CENTER_README.md](SHELTER_CENTER_README.md) - เอกสารฉบับเต็ม
- [SHELTER_CENTER_QUICKSTART.md](SHELTER_CENTER_QUICKSTART.md) - Quick Start Guide

---

**เวอร์ชัน**: 2.0 (EOC Type Support)  
**อัพเดทล่าสุด**: January 2026  
**สำหรับ**: STN-EOC System
