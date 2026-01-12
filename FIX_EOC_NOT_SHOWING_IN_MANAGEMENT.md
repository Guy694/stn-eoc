# แก้ไข EOC ใหม่ไม่แสดงในหน้าจัดการศูนย์ EOC

## 🐛 ปัญหาที่พบ

หลังจากแก้ไขตาราง `eoc_status` จาก ENUM เป็น VARCHAR และเพิ่ม EOC ใหม่ (covid19) แล้ว พบว่า:
- ❌ EOC covid19 ไม่แสดงในหน้าจัดการศูนย์ EOC (`/admin/eoc-management`)
- ❌ ระบบยังแสดงแค่ EOC 5 ประเภทเดิม (flood, drought, tsunami, earthquake, disease)

## 🔍 สาเหตุ

### 1. EOCContext.jsx มีปัญหา 3 จุด:
```jsx
// ❌ Initial state hardcode
const [eocStatus, setEocStatus] = useState({
    flood: { is_active: false, ... },
    drought: { is_active: false, ... },
    // ... แค่ 5 ประเภทเดิม
});

// ❌ getEOCDisplayName() hardcode
const getEOCDisplayName = (eocType) => {
    const names = {
        flood: 'น้ำท่วม',
        drought: 'ภัยแล้ง',
        // ... แค่ 5 ประเภทเดิม
    };
    return names[eocType] || eocType;
};

// ❌ ไม่มี state สำหรับเก็บรายการ EOC Types
```

### 2. API /api/eoc/status ไม่ส่งข้อมูลครบ:
```javascript
// ❌ ไม่มีฟิลด์ name_th, name_en, icon
SELECT 
    es.id,
    es.eoc_type,
    es.is_active,
    // ... ไม่มี name_th, name_en, icon
FROM eoc_status es
```

### 3. API มีการ validate แบบ hardcode:
```javascript
// ❌ จำกัดเฉพาะ 5 ประเภท
const validTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
if (!validTypes.includes(eocType)) {
    // reject
}
```

## ✅ การแก้ไข

### 1. แก้ไข context/EOCContext.jsx

#### เปลี่ยน Initial State
```jsx
// ✅ ใช้ empty object แทน
const [eocStatus, setEocStatus] = useState({});
const [eocTypes, setEocTypes] = useState([]);
```

#### แก้ไข fetchEOCStatus()
```jsx
const fetchEOCStatus = async () => {
    const data = await fetch('/api/eoc/status');
    const statusMap = {};
    const typesList = [];
    
    data.data.forEach(item => {
        statusMap[item.eoc_type] = {
            is_active: Boolean(item.is_active),
            description: item.description,
            // ✅ เพิ่มข้อมูลจาก database
            name_th: item.name_th,
            name_en: item.name_en,
            icon: item.icon,
            color_primary: item.color_primary,
            color_gradient: item.color_gradient,
            // ... อื่นๆ
        };
        typesList.push(item.eoc_type);
    });
    
    setEocStatus(statusMap);
    setEocTypes(typesList);
};
```

#### แก้ไข getEOCDisplayName()
```jsx
const getEOCDisplayName = (eocType) => {
    // ✅ ดึงจาก eocStatus ที่โหลดจาก database
    if (eocStatus[eocType]?.name_th) {
        return eocStatus[eocType].name_th;
    }
    // Fallback สำหรับ EOC เดิม
    const fallbackNames = {
        flood: 'น้ำท่วม',
        drought: 'ภัยแล้ง',
        tsunami: 'สึนามิ',
        earthquake: 'แผ่นดินไหว',
        disease: 'โรคระบาด'
    };
    return fallbackNames[eocType] || eocType;
};
```

### 2. แก้ไข app/api/eoc/status/route.js

#### เพิ่มฟิลด์ใน SELECT Query
```javascript
let query = `
    SELECT 
        es.id,
        es.eoc_type,
        es.name_th,          -- ✅ เพิ่ม
        es.name_en,          -- ✅ เพิ่ม
        es.icon,             -- ✅ เพิ่ม
        es.color_primary,    -- ✅ เพิ่ม
        es.color_gradient,   -- ✅ เพิ่ม
        es.is_active,
        // ... ฟิลด์อื่นๆ
    FROM eoc_status es
    // ...
`;
```

#### เพิ่ม formatted fields
```javascript
const formattedRows = rows.map(row => ({
    ...row,
    activated_by_name: row.activated_by_title && row.activated_by_given_name 
        ? `${row.activated_by_title}${row.activated_by_given_name} ${row.activated_by_family_name}`
        : null,
    deactivated_by_name: row.deactivated_by_title && row.deactivated_by_given_name
        ? `${row.deactivated_by_title}${row.deactivated_by_given_name} ${row.deactivated_by_family_name}`
        : null
}));
```

#### แก้ไข Validation
```javascript
// ❌ เดิม - hardcode
const validTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
if (!validTypes.includes(eocType)) {
    return NextResponse.json({ success: false, message: 'ประเภท EOC ไม่ถูกต้อง' });
}

// ✅ ใหม่ - ตรวจสอบจาก database
const [existingType] = await connection.execute(
    'SELECT eoc_type FROM eoc_status WHERE eoc_type = ?',
    [eocType]
);

if (existingType.length === 0) {
    return NextResponse.json({ 
        success: false, 
        message: 'ประเภท EOC ไม่ถูกต้องหรือไม่มีในระบบ' 
    });
}
```

### 3. ตั้งค่า sort_order
```sql
UPDATE eoc_status SET sort_order = 6 WHERE eoc_type = 'covid19';
```

## 📊 ผลลัพธ์

### ข้อมูลในฐานข้อมูล
```
+----+------------+-------------+------------+
| id | eoc_type   | name_th     | sort_order |
+----+------------+-------------+------------+
|  1 | flood      | น้ำท่วม     |          1 |
|  2 | drought    | ภัยแล้ง     |          2 |
|  3 | tsunami    | คลื่นสึนามิ |          3 |
|  4 | earthquake | แผ่นดินไหว  |          4 |
|  5 | disease    | โรคระบาด    |          5 |
|  7 | covid19    | โควิด19     |          6 | ✅ แสดงแล้ว
+----+------------+-------------+------------+
```

### การทำงานของระบบ
- ✅ EOC covid19 แสดงในหน้า `/admin/eoc-management`
- ✅ สามารถเปิด/ปิด EOC covid19 ได้
- ✅ แสดงชื่อภาษาไทยถูกต้อง "โควิด19"
- ✅ รองรับการเพิ่ม EOC ประเภทใหม่ได้โดยอัตโนมัติ

## 🎯 ประโยชน์

1. **ไม่ต้อง hardcode** - ดึงข้อมูล EOC Types จาก database ทั้งหมด
2. **เพิ่ม EOC ใหม่ง่าย** - แค่เพิ่มใน database ระบบจะแสดงอัตโนมัติ
3. **แสดงชื่อถูกต้อง** - ใช้ข้อมูล name_th จาก database
4. **ยืดหยุ่น** - รองรับ EOC หลายประเภทได้ไม่จำกัด

## 📁 ไฟล์ที่แก้ไข

1. [context/EOCContext.jsx](context/EOCContext.jsx)
   - แก้ไข initial state
   - แก้ไข fetchEOCStatus()
   - แก้ไข getEOCDisplayName()
   - เพิ่ม eocTypes state

2. [app/api/eoc/status/route.js](app/api/eoc/status/route.js)
   - เพิ่มฟิลด์ name_th, name_en, icon, color_primary, color_gradient
   - เพิ่มฟิลด์ activated_by_name, deactivated_by_name
   - แก้ไข validation จาก hardcode เป็น query database

## 🧪 วิธีทดสอบ

### 1. ตรวจสอบ API Response
```bash
# ทดสอบ API
curl http://localhost:3000/api/eoc/status

# ควรได้ response ที่มี covid19 รวมอยู่ด้วย
{
  "success": true,
  "data": [
    {
      "eoc_type": "flood",
      "name_th": "น้ำท่วม",
      "name_en": "Flood",
      "icon": "💧",
      ...
    },
    {
      "eoc_type": "covid19",
      "name_th": "โควิด19",
      "name_en": "covid",
      "icon": "🦠",
      ...
    }
  ]
}
```

### 2. ตรวจสอบหน้า Web
1. เปิดหน้า `http://localhost:3000/admin/eoc-management`
2. ควรเห็น EOC card ทั้งหมด 6 ประเภท
3. EOC โควิด19 ควรแสดงอยู่ในลำดับท้ายสุด

### 3. ทดสอบเพิ่ม EOC ใหม่
```sql
INSERT INTO eoc_status 
(eoc_type, name_th, name_en, icon, color_primary, color_gradient, is_active, sort_order) 
VALUES 
('wildfire', 'ไฟป่า', 'Wildfire', '🔥', 'red', 'from-red-600 to-orange-600', 0, 7);
```

รีเฟรชหน้า - ควรเห็น "ไฟป่า" แสดงในหน้าจัดการทันที!

## ⚠️ หมายเหตุ

1. **ต้อง refresh หน้า** หลังเพิ่ม EOC ใหม่ในฐานข้อมูล (หรือรอ 30 วินาที ระบบจะ refresh อัตโนมัติ)
2. **ชื่อต้องถูกต้อง** - ตรวจสอบว่า name_th, name_en ไม่เป็น NULL
3. **eoc_type ต้องไม่ซ้ำ** - มี UNIQUE KEY constraint

---

**แก้ไขเมื่อ:** 12 มกราคม 2026  
**ทดสอบแล้ว:** ✅ สำเร็จ  
**สถานะ:** 🟢 พร้อมใช้งาน
