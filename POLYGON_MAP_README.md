# แผนที่ Polygon - ระบบ ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข

## คุณสมบัติ

ระบบแสดงแผนที่หมู่บ้านจังหวัดสตูลแบบ Polygon พร้อมฟีเจอร์ต่างๆ ดังนี้:

### 1. การแสดงผล Polygon
- แสดงขอบเขตหมู่บ้านแบบ Polygon บนแผนที่
- รองรับข้อมูลจากไฟล์ CSV
- แสดงข้อมูลครบถ้วนทั้ง 7 อำเภอของจังหวัดสตูล

### 2. ระบบสีแบบ Dynamic
- **โหมดแสดงสีตามอำเภอ**: แต่ละอำเภอมีสีเฉพาะตัว
  - เมืองสตูล: น้ำเงิน (#3B82F6)
  - ควนโดน: เขียว (#10B981)
  - ควนกาหลง: ส้ม (#F59E0B)
  - ท่าแพ: ม่วง (#8B5CF6)
  - ละงู: ชมพู (#EC4899)
  - ทุ่งหว้า: เขียวอมฟ้า (#14B8A6)
  - มะนัง: ส้มแก่ (#F97316)

- **โหมดแสดงสีตามจำนวนครัวเรือน**: แบ่งตามช่วง
  - 0-50 ครัวเรือน: เหลืองอ่อน (#FEF3C7)
  - 51-100 ครัวเรือน: เหลือง (#FCD34D)
  - 101-150 ครัวเรือน: ส้ม (#F59E0B)
  - 151+ ครัวเรือน: แดง (#DC2626)

### 3. การโต้ตอบกับแผนที่
- **Hover Effect**: เมื่อนำเมาส์ไปวางจะเปลี่ยนสีและเน้นขอบ
- **Click**: คลิกที่ polygon เพื่อดูข้อมูลโดยละเอียด
- **Popup**: แสดงข้อมูลเมื่อคลิก รวมถึง:
  - ชื่อหมู่บ้าน
  - ตำบล/อำเภอ/จังหวัด
  - จำนวนครัวเรือน
  - จำนวนอาคาร
  - หน่วยปกครอง

### 4. Dashboard สถิติ
- จำนวนหมู่บ้านทั้งหมด
- จำนวนครัวเรือนรวม
- จำนวนอาคารรวม
- จำนวนอำเภอ

### 5. Legend (คำอธิบาย)
- แสดงคำอธิบายสีแบบ real-time ตาม mode ที่เลือก
- อัพเดทอัตโนมัติเมื่อสลับ mode

## โครงสร้างไฟล์

```
app/
├── api/
│   └── village-polygons/
│       └── route.js              # API สำหรับดึงข้อมูล polygon
└── village-map/
    └── page.js                   # หน้าแสดงแผนที่หมู่บ้าน

components/
└── PolygonMap.js                 # Component แผนที่ polygon

data/
└── villagePolygonData.js         # ฟังก์ชันประมวลผลข้อมูล polygon

satun_village.csv                 # ไฟล์ข้อมูลหมู่บ้าน (CSV)
create_table.sql                  # SQL สำหรับสร้างตารางฐานข้อมูล
import.py                         # Script Python สำหรับ import ข้อมูลเข้า MySQL
```

## การใช้งาน

### 1. เข้าถึงแผนที่
เปิดเบราว์เซอร์และไปที่:
```
http://localhost:3000/village-map
```

### 2. สลับโหมดการแสดงสี
- คลิกปุ่ม **"อำเภอ"** เพื่อแสดงสีตามอำเภอ
- คลิกปุ่ม **"จำนวนครัวเรือน"** เพื่อแสดงสีตามจำนวนประชากร

### 3. ดูข้อมูลรายละเอียด
- คลิกที่ polygon บนแผนที่
- ข้อมูลจะแสดงใน popup และกล่องด้านขวาบน

### 4. นำทางแผนที่
- **Zoom**: ใช้ scroll mouse หรือปุ่ม +/- บนแผนที่
- **Pan**: คลิกลากเพื่อเลื่อนแผนที่
- **Auto Fit**: แผนที่จะปรับ bounds อัตโนมัติเพื่อแสดง polygon ทั้งหมด

## การ Import ข้อมูลเข้าฐานข้อมูล (ถ้าต้องการ)

### 1. สร้างตารางในฐานข้อมูล
```sql
-- รันคำสั่งใน create_table.sql
CREATE TABLE IF NOT EXISTS satun_village_polygon (
    id INT AUTO_INCREMENT PRIMARY KEY,
    fid INT,
    area_name VARCHAR(255),
    regname VARCHAR(100),
    num_hh INT,
    villcode VARCHAR(50),
    num_build INT,
    distname VARCHAR(100),
    ea_code_15 VARCHAR(50),
    subdistnam VARCHAR(100),
    area_type INT,
    areacode INT,
    provname VARCHAR(100),
    mun_tao_na VARCHAR(255),
    provcode VARCHAR(10),
    villname VARCHAR(100),
    moo VARCHAR(10),
    regcode INT,
    ea_no VARCHAR(50),
    muntaocode VARCHAR(50),
    shape_length DOUBLE,
    shape_area DOUBLE,
    geom GEOMETRY NOT NULL,
    SPATIAL INDEX(geom)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

### 1.1 เพิ่มเลขหมู่จาก villages.sql
หลัง import `villages.sql` แล้ว ให้รัน migration:

```bash
mysql -u root -p stneoc < migrations/add_moo_to_satun_village_polygon.sql
```

### 2. Import ข้อมูลด้วย Python
```bash
# ติดตั้ง dependencies
pip install pymysql

# รัน import script
python import.py
```

## เทคโนโลยีที่ใช้

- **Next.js 16**: React Framework
- **React Leaflet 5**: ไลบรารีสำหรับแสดงแผนที่
- **Leaflet 1.9**: JavaScript library สำหรับ interactive maps
- **Tailwind CSS 4**: CSS Framework
- **MySQL 2**: Database (ถ้าต้องการใช้ฐานข้อมูล)

## API Endpoints

### GET /api/village-polygons
ดึงข้อมูล polygon ทั้งหมดจากไฟล์ CSV

**Response:**
```json
[
  {
    "id": 1,
    "fid": 4,
    "villname": "ชื่อหมู่บ้าน",
    "moo": "1",
    "subdistnam": "ชื่อตำบล",
    "distname": "ชื่ออำเภอ",
    "provname": "สตูล",
    "num_hh": 115,
    "num_build": 188,
    "area_type": 1,
    "mun_tao_na": "เทศบาลตำบล...",
    "regname": "ใต้",
    "coordinates": [[6.634919, 100.070985], ...]
  }
]
```

## การปรับแต่ง

### เปลี่ยนสีของอำเภอ
แก้ไขในไฟล์ `components/PolygonMap.js`:
```javascript
const getColorByDistrict = (distname) => {
    const colors = {
        'เมืองสตูล': '#3B82F6', // เปลี่ยนสีตรงนี้
        'ควนโดน': '#10B981',
        // ...
    };
    return colors[distname] || '#6B7280';
};
```

### เปลี่ยนช่วงจำนวนครัวเรือน
แก้ไขในไฟล์ `components/PolygonMap.js`:
```javascript
const getColorByPopulation = (numHH) => {
    if (numHH <= 50) return '#FEF3C7';    // 0-50
    if (numHH <= 100) return '#FCD34D';   // 51-100
    if (numHH <= 150) return '#F59E0B';   // 101-150
    return '#DC2626';                      // 151+
};
```

### เปลี่ยนศูนย์กลางแผนที่
แก้ไขในไฟล์ `components/PolygonMap.js`:
```javascript
const satunCenter = [6.6238, 100.0673]; // [latitude, longitude]
```

## การพัฒนาต่อ

### เพิ่มฟีเจอร์ที่แนะนำ:
1. **Search/Filter**: ค้นหาหมู่บ้านตามชื่อ
2. **Layer Control**: เปิด/ปิด layer ต่างๆ
3. **Export**: ส่งออกข้อมูลเป็น PDF หรือ Image
4. **Statistics Chart**: แสดงกราฟสถิติประชากร
5. **Database Integration**: ดึงข้อมูลจาก MySQL แทน CSV
6. **Real-time Update**: อัพเดทข้อมูลแบบ real-time

## ปัญหาที่อาจพบ

### แผนที่ไม่แสดง
- ตรวจสอบ console browser มี error หรือไม่
- ตรวจสอบไฟล์ `satun_village.csv` อยู่ใน root directory
- ตรวจสอบ format ข้อมูล coordinates ใน CSV

### ข้อมูลไม่ครบถ้วน
- ตรวจสอบ CSV file มีข้อมูลครบทุก column
- ตรวจสอบ encoding ของไฟล์เป็น UTF-8

### Performance ช้า
- ลด polygon points ด้วย simplification algorithm
- ใช้ clustering สำหรับ polygon จำนวนมาก
- พิจารณาใช้ Vector Tiles

## License
MIT License - ใช้งานได้อย่างอิสระ
