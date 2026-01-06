# 🦠 ระบบติดตามสถานการณ์โรครายวัน

## 📋 ภาพรวม

ระบบสำหรับบันทึกและติดตามสถานการณ์โรคจากหน่วยบริการสาธารณสุขรายวัน พร้อมสรุปข้อมูลเป็นกราฟแยกตามอำเภอ

## ✨ คุณสมบัติ

### 1. **บันทึกข้อมูลรายวัน**
- เลือกวันที่รายงาน
- เลือกหน่วยบริการ (โรงพยาบาล/รพ.สต.)
- เลือกโรค (ไข้เลือดออก, โควิด-19, มือเท้าปาก, ฯลฯ)
- กรอกจำนวนผู้ป่วย
- เพิ่มหมายเหตุ

### 2. **กราฟและสถิติ**
- 📊 **กราฟแท่งตามอำเภอ** - แสดงจำนวนผู้ป่วยแยกตามอำเภอ (ข้อมูลวันที่เลือก)
- 🥧 **กราฟวงกลมรายโรค** - แสดงสัดส่วนผู้ป่วยแต่ละโรค (ข้อมูลสะสม)
- 📈 **Stats Cards**:
  - รายงานวันนี้
  - สะสมทั้งหมด
  - จำนวนโรคที่รายงาน
  - จำนวนหน่วยบริการ

### 3. **Filter & Search**
- กรองตามวันที่
- กรองตามอำเภอ
- แสดงข้อมูลแบบ Real-time

### 4. **CRUD Operations**
- ✅ เพิ่มรายงานใหม่
- ✏️ แก้ไขรายงาน
- 🗑️ ลบรายงาน
- 🔄 อัพเดทอัตโนมัติ

## 📁 ไฟล์ที่สร้าง

```
stn-eoc/
├── create_disease_reports_table.sql          # Database schema
├── app/
│   ├── admin/
│   │   └── disease-reports/
│   │       └── page.jsx                       # หน้าหลัก
│   └── api/
│       └── admin/
│           └── disease-reports/
│               └── route.js                   # API endpoints
└── components/
    └── Sidebar.jsx                            # เพิ่มเมนู
```

## 🗄️ Database Schema

### ตาราง `disease_reports`

| Field | Type | Description |
|-------|------|-------------|
| id | INT (PK) | รหัสรายงาน |
| report_date | DATE | วันที่รายงาน |
| health_facility_id | INT (FK) | รหัสหน่วยบริการ |
| disease_name | VARCHAR(255) | ชื่อโรค |
| patient_count | INT | จำนวนผู้ป่วย |
| notes | TEXT | หมายเหตุ |
| reported_by | INT (FK) | ผู้รายงาน |
| created_at | TIMESTAMP | วันที่สร้าง |
| updated_at | TIMESTAMP | วันที่แก้ไข |

**Indexes:**
- `idx_report_date` - ค้นหาตามวันที่เร็วขึ้น
- `idx_health_facility` - ค้นหาตามหน่วยบริการ
- `idx_disease` - ค้นหาตามโรค
- `unique_daily_report` - ป้องกันข้อมูลซ้ำ (วันที่+หน่วยบริการ+โรค)

### Views

**1. `disease_summary_by_district`** - สรุปตามอำเภอรายวัน
```sql
SELECT 
    district_name, disease_name, report_date,
    total_patients, facilities_count
FROM disease_summary_by_district;
```

**2. `disease_cumulative_summary`** - สรุปสะสมรายอำเภอ
```sql
SELECT 
    district_name, disease_name,
    cumulative_patients, report_days, last_report_date
FROM disease_cumulative_summary;
```

## 🚀 การติดตั้ง

### 1. สร้างฐานข้อมูล

```bash
mysql -u root -p stneoc < create_disease_reports_table.sql
```

หรือรันใน phpMyAdmin:
- คัดลอกโค้ดจาก `create_disease_reports_table.sql`
- วางใน SQL tab และรัน

### 2. ติดตั้ง Chart.js

```bash
npm install chart.js react-chartjs-2
```

### 3. เข้าใช้งาน

1. เข้าสู่ระบบ
2. คลิกเมนู **🦠 โรคระบาด → สถานการณ์โรค**
3. URL: `/admin/disease-reports`

## 📖 การใช้งาน

### เพิ่มรายงานโรคใหม่

1. คลิกปุ่ม **"➕ เพิ่มรายงานโรค"**
2. กรอกข้อมูล:
   - **วันที่รายงาน** - เลือกวันที่
   - **หน่วยบริการ** - เลือกโรงพยาบาล/รพ.สต.
   - **โรค** - เลือกจากรายการหรือระบุเอง
   - **จำนวนผู้ป่วย** - กรอกตัวเลข
   - **หมายเหตุ** - (ถ้ามี)
3. คลิก **"➕ บันทึก"**

### แก้ไขรายงาน

1. คลิกปุ่ม **"✏️ แก้ไข"** ที่แถวที่ต้องการ
2. แก้ไขข้อมูล
3. คลิก **"💾 บันทึกการแก้ไข"**

### ลบรายงาน

1. คลิกปุ่ม **"🗑️ ลบ"**
2. ยืนยันการลบ

### ดูสถิติ

**กราฟแท่งตามอำเภอ:**
- แสดงจำนวนผู้ป่วยแยกตามอำเภอ
- สีแยกตามโรค
- เปลี่ยนวันที่ได้จาก Filter

**กราฟวงกลมรายโรค:**
- แสดงสัดส่วนผู้ป่วยสะสมทั้งหมด
- คลิก Legend เพื่อซ่อน/แสดงข้อมูล

### Filter ข้อมูล

**ตามวันที่:**
- เลือกวันที่ต้องการดู
- กราฟและตารางจะอัพเดทอัตโนมัติ

**ตามอำเภอ:**
- เลือกอำเภอจาก dropdown
- แสดงเฉพาะข้อมูลอำเภอนั้น

## 📊 API Endpoints

### GET `/api/admin/disease-reports`

ดึงรายงานโรค

**Query Parameters:**
- `date` - วันที่ (YYYY-MM-DD)
- `facility_id` - รหัสหน่วยบริการ
- `disease` - ชื่อโรค (LIKE search)
- `start_date` & `end_date` - ช่วงวันที่

**Response:**
```json
{
  "success": true,
  "data": [...],
  "summary": {
    "today": [...],
    "cumulative": [...],
    "byDisease": [...]
  }
}
```

### POST `/api/admin/disease-reports`

บันทึกรายงานใหม่

**Body:**
```json
{
  "report_date": "2025-01-06",
  "health_facility_id": 1,
  "disease_name": "ไข้เลือดออก",
  "patient_count": 5,
  "notes": "หมายเหตุ"
}
```

### PUT `/api/admin/disease-reports?id=1`

แก้ไขรายงาน

### DELETE `/api/admin/disease-reports?id=1`

ลบรายงาน

## 💡 โรคที่รองรับ

รายการโรคทั่วไป:
- ไข้เลือดออก (Dengue Fever)
- โควิด-19 (COVID-19)
- มือเท้าปาก (Hand, Foot and Mouth Disease)
- ไข้หวัดใหญ่ (Influenza)
- อุจจาระร่วง (Diarrhea)
- โรคผิวหนัง (Skin Disease)
- อื่นๆ (ระบุเอง)

## 🎨 Features

### Auto-complete
- ป้อนข้อมูลซ้ำจะอัพเดทแทนการสร้างใหม่
- Unique constraint: วันที่ + หน่วยบริการ + โรค

### Responsive Design
- ใช้งานได้บนมือถือ
- กราฟปรับขนาดอัตโนมัติ

### Real-time Updates
- กราฟอัพเดททันทีหลังบันทึก
- Stats อัพเดทแบบ Dynamic

## 🔧 Troubleshooting

### ปัญหา: ตารางไม่มี
**แก้ไข**: รัน `create_disease_reports_table.sql`

### ปัญหา: Chart.js ไม่แสดง
**แก้ไข**: 
```bash
npm install chart.js react-chartjs-2
npm run dev
```

### ปัญหา: ข้อมูลไม่อัพเดท
**แก้ไข**: Refresh หน้าหรือเปลี่ยนวันที่ Filter

## 📈 การใช้งานจริง

### Workflow รายวัน

1. **เช้า (08:00)**
   - หน่วยบริการแต่ละแห่งรายงานผู้ป่วยใหม่
   - เจ้าหน้าที่ EOC บันทึกเข้าระบบ

2. **กลางวัน (12:00)**
   - ตรวจสอบและรวบรวมข้อมูล
   - ดูกราฟเพื่อวิเคราะห์แนวโน้ม

3. **บ่าย (16:00)**
   - สรุปรายงานประจำวัน
   - ส่งรายงานให้ผู้บังคับบัญชา

### การวิเคราะห์

**แนวโน้มรายสัปดาห์:**
- เปรียบเทียบข้อมูลย้อนหลัง 7 วัน
- ดูอำเภอที่มีผู้ป่วยเพิ่มขึ้น

**Hotspot:**
- ระบุพื้นที่ที่มีการระบาดสูง
- วางแผนเตรียมทรัพยากร

## 🎯 ประโยชน์

1. ✅ **ติดตามแบบ Real-time** - ทราบสถานการณ์ทันที
2. 📊 **วิเคราะห์ได้ง่าย** - กราฟชัดเจน
3. 🎯 **ระบุ Hotspot** - รู้พื้นที่เสี่ยง
4. 📈 **เตรียมรับมือ** - วางแผนล่วงหน้า
5. 📋 **รายงานง่าย** - ข้อมูลครบถ้วน

---

**เวอร์ชัน**: 1.0  
**อัพเดทล่าสุด**: January 2026  
**สำหรับ**: STN-EOC System
