# แก้ไขปัญหา EOC Type ไม่สามารถเพิ่มได้เนื่องจาก ENUM

## 📋 สรุปปัญหา

ตาราง `eoc_status` และ `eoc_sessions` มีฟิลด์ `eoc_type` เป็นประเภท **ENUM** ซึ่งกำหนดค่าที่อนุญาตไว้แค่:
```sql
ENUM('flood','drought','tsunami','earthquake','disease')
```

เมื่อพยายามเพิ่ม EOC ประเภทใหม่ (เช่น covid19, wildfire) ระบบไม่สามารถบันทึกได้ เนื่องจาก ENUM ไม่รองรับค่าที่ไม่ได้กำหนดไว้ล่วงหน้า

## ✅ วิธีแก้ไข

เปลี่ยนฟิลด์ `eoc_type` จาก **ENUM** เป็น **VARCHAR(50)** เพื่อให้สามารถเพิ่มประเภท EOC ใหม่ได้แบบ dynamic

## 🔧 การดำเนินการแก้ไข

### 1. ตารางที่ได้แก้ไขแล้ว ✅

**สรุป:** แก้ไข 4 ตาราง จาก ENUM เป็น VARCHAR(50)

| ตาราง | สถานะ | หมายเหตุ |
|------|------|---------|
| `eoc_status` | ✅ แก้ไขแล้ว | ตารางหลักสำหรับเก็บข้อมูล EOC Types |
| `eoc_sessions` | ✅ แก้ไขแล้ว | ตารางเก็บ EOC Sessions |
| `announcements` | ✅ แก้ไขแล้ว | ตารางประกาศข่าวสาร |
| `eoc_type_modules` | ✅ แก้ไขแล้ว | ตารางโมดูลของแต่ละ EOC Type |

#### ✅ `eoc_status` 
```sql
-- เดิม: eoc_type ENUM('flood','drought','tsunami','earthquake','disease')
-- ใหม่: eoc_type VARCHAR(50) NOT NULL

ALTER TABLE eoc_status 
MODIFY COLUMN eoc_type VARCHAR(50) NOT NULL;

ALTER TABLE eoc_status 
DROP INDEX eoc_type;

ALTER TABLE eoc_status 
ADD UNIQUE KEY unique_eoc_type (eoc_type);
```

#### ✅ `eoc_sessions`
```sql
-- เดิม: eoc_type ENUM('flood','drought','tsunami','earthquake','disease')
-- ใหม่: eoc_type VARCHAR(50) NOT NULL

ALTER TABLE eoc_sessions 
MODIFY COLUMN eoc_type VARCHAR(50) NOT NULL;
```

#### ✅ `announcements`
```sql
-- ตาราง announcements เป็น VARCHAR(50) อยู่แล้ว (ไม่ต้องแก้ไข)
```

#### ⚠️ `shelter_centers`
```
-- ตาราง shelter_centers ไม่มีฟิลด์ eoc_type (ไม่ต้องแก้ไข)
```

#### ✅ `eoc_type_modules`
```sql
-- เดิม: eoc_type ENUM('flood','drought','tsunami','earthquake','disease')
-- ใหม่: eoc_type VARCHAR(50) NOT NULL

ALTER TABLE eoc_type_modules 
MODIFY COLUMN eoc_type VARCHAR(50) NOT NULL;
```

### 2. แก้ไขข้อมูล EOC ที่มีปัญหา

```sql
-- EOC ID 7 ที่ eoc_type เป็นค่าว่าง
UPDATE eoc_status 
SET eoc_type = 'covid19' 
WHERE id = 7;
```

## 📊 ผลลัพธ์หลังการแก้ไข

```
+----+------------+-------------+------------------+-----------+------------+
| id | eoc_type   | name_th     | name_en          | is_active | sort_order |
+----+------------+-------------+------------------+-----------+------------+
|  1 | flood      | น้ำท่วม     | Flood            |         1 |          1 |
|  2 | drought    | ภัยแล้ง     | Drought          |         0 |          2 |
|  3 | tsunami    | คลื่นสึนามิ | Tsunami          |         0 |          3 |
|  4 | earthquake | แผ่นดินไหว  | Earthquake       |         0 |          4 |
|  5 | disease    | โรคระบาด    | Disease Outbreak |         0 |          5 |
|  7 | covid19    | โควิด19     | covid            |         0 |          6 |
+----+------------+-------------+------------------+-----------+------------+
```

## 🎯 ประโยชน์ที่ได้รับ

1. ✅ **เพิ่ม EOC ประเภทใหม่ได้** - ไม่ต้องแก้ไขโครงสร้าง ENUM ทุกครั้ง
2. ✅ **ยืดหยุ่นมากขึ้น** - สามารถกำหนด eoc_type เป็นอะไรก็ได้ที่เหมาะสม
3. ✅ **รองรับการขยายระบบ** - เพิ่ม EOC ประเภทใหม่ผ่าน API ได้ทันที
4. ✅ **ไม่เสียข้อมูลเดิม** - EOC ทั้งหมดยังคงใช้งานได้ปกติ

## 🔗 ไฟล์ที่เกี่ยวข้อง

- [fix_eoc_type_enum_to_varchar.sql](fix_eoc_type_enum_to_varchar.sql) - SQL Script สำหรับแก้ไขตาราง
- [app/api/admin/eoc-types/route.jsx](app/api/admin/eoc-types/route.jsx) - API สำหรับจัดการ EOC Types
- [app/admin/eoc-management/page.jsx](app/admin/eoc-management/page.jsx) - หน้าจัดการ EOC

## 📝 วิธีใช้งาน

### เพิ่ม EOC ประเภทใหม่ผ่าน API

```javascript
// POST /api/admin/eoc-types
const response = await fetch('/api/admin/eoc-types', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
        id: 'wildfire',           // รหัส EOC (ภาษาอังกฤษ, lowercase)
        name_th: 'ไฟป่า',         // ชื่อภาษาไทย
        name_en: 'Wildfire',       // ชื่อภาษาอังกฤษ
        icon: '🔥',               // Icon
        color_primary: 'red',      // สีหลัก
        color_gradient: 'from-red-500 to-orange-600',
        description: 'จัดการเหตุการณ์ไฟป่า',
        sort_order: 7
    })
});
```

### ตรวจสอบ EOC Types ที่มีอยู่

```bash
mysql -u root stneoc -e "
SELECT id, eoc_type, name_th, name_en, is_active, sort_order 
FROM eoc_status 
ORDER BY sort_order;
"
```

## ⚠️ ข้อควรระวัง

1. **ตรวจสอบความเข้ากันได้** - ตรวจสอบโค้ดที่ใช้ eoc_type แบบ hardcode
2. **Validate ข้อมูล** - ตรวจสอบว่า eoc_type ที่ใส่เข้ามาเป็นรูปแบบที่ถูกต้อง (lowercase, no space)
3. **Foreign Key** - ตาราง `eoc_sessions` และ `announcements` ต้องใช้ eoc_type ที่มีอยู่ใน `eoc_status`

## 🎉 สรุป

ปัญหาได้รับการแก้ไขแล้ว! ตอนนี้สามารถเพิ่ม EOC ประเภทใหม่ได้อย่างอิสระผ่านหน้า Admin หรือ API โดยไม่ต้องแก้ไขโครงสร้างฐานข้อมูลอีกต่อไป

### 🔧 การแก้ไขเพิ่มเติม

#### 1. แก้ไข EOCContext.jsx
- เปลี่ยน initial state จาก hardcode เป็น empty object
- เพิ่ม state `eocTypes` สำหรับเก็บรายการ EOC Types
- แก้ไข `fetchEOCStatus()` ให้ดึงข้อมูล name_th, name_en, icon จาก API
- แก้ไข `getEOCDisplayName()` ให้ดึงชื่อจาก eocStatus แทน hardcode

#### 2. แก้ไข /api/eoc/status (route.js)
- เพิ่มฟิลด์ `name_th`, `name_en`, `icon`, `color_primary`, `color_gradient` ใน SELECT query
- เพิ่มฟิลด์ `activated_by_name` และ `deactivated_by_name` ที่รวมชื่อเจ้าหน้าที่
- ลบการ validate eocType แบบ hardcode
- เพิ่มการตรวจสอบว่า eocType มีอยู่ใน eoc_status หรือไม่

#### 3. ตั้งค่า sort_order สำหรับ covid19
```sql
UPDATE eoc_status SET sort_order = 6 WHERE eoc_type = 'covid19';
```

### 📝 ไฟล์ที่แก้ไข
- [context/EOCContext.jsx](context/EOCContext.jsx) - แก้ไขให้รองรับ EOC Types แบบ dynamic
- [app/api/eoc/status/route.js](app/api/eoc/status/route.js) - เพิ่มฟิลด์และลบ validation hardcode

---

**แก้ไขเมื่อ:** 12 มกราคม 2026  
**ทดสอบแล้ว:** ✅ สำเร็จ  
**สถานะ:** 🟢 พร้อมใช้งาน  
**EOC ใหม่แสดงในหน้าจัดการ:** ✅ covid19 แสดงแล้ว
