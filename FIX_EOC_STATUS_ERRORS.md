# แก้ไข JSON Parse Errors และ Session Validation Errors

## ปัญหาที่พบ

1. **JSON Parse Error** ใน `app/page.jsx` - `fetchActiveEOCs`
2. **500 Error** จาก API `/api/eoc/status` - อาจเกิดจากตาราง `eoc_status` ว่างหรือไม่มี
3. **401 Error** จาก session validation - เป็นพฤติกรรมปกติเมื่อไม่มี session หรือ session หมดอายุ

## การแก้ไขที่ดำเนินการ

### 1. ✅ แก้ไข app/page.jsx

แก้ไข 2 functions:
- `fetchActiveEOCs` - เพิ่มการตรวจสอบ `response.ok` ก่อน parse JSON
- `fetchInfographics` - เพิ่มการตรวจสอบ `response.ok` และ continue loop เมื่อเกิด error

**Before:**
```javascript
const response = await fetch('/api/eoc/status');
const result = await response.json(); // อาจเกิด error ถ้า response ไม่ ok
```

**After:**
```javascript
const response = await fetch('/api/eoc/status');
if (!response.ok) {
    console.error('Failed to fetch EOC status:', response.status);
    return;
}
const result = await response.json();
```

### 2. ✅ แก้ไข AuthContext.jsx (Session Validation)

ปรับการจัดการ 401 error จาก session validation:
- เปลี่ยนจาก `console.error` เป็น `console.log` สำหรับ 401
- เพิ่มการตรวจสอบ `response.ok` สำหรับ cookie session check
- 401 เป็นพฤติกรรมปกติเมื่อไม่มี session หรือ session หมดอายุ

**Before:**
```javascript
if (!response.ok) {
    console.error('Failed to validate session:', response.status);
    // ...
}
```

**After:**
```javascript
if (!response.ok) {
    // 401 เป็นกรณีปกติเมื่อ session หมดอายุหรือไม่ valid
    if (response.status === 401) {
        console.log('Session expired or invalid');
    } else {
        console.error('Failed to validate session:', response.status);
    }
    // ...
}
```

### 3. ❌ API /api/eoc/status (User undo การแก้ไข)

ปรับปรุง GET endpoint ให้:
- ตรวจสอบว่ามีข้อมูลในตาราง `eoc_status` หรือไม่
- ถ้าไม่มีข้อมูล จะสร้าง default records อัตโนมัติสำหรับทุก EOC type
- Query อีกครั้งและ return ข้อมูล

```javascript
// ถ้าไม่มีข้อมูล ให้สร้าง default records
if (rows.length === 0) {
    const eocTypes = ['flood', 'drought', 'tsunami', 'earthquake', 'disease'];
    const insertQueries = eocTypes.map(type => 
        connection.execute(
            'INSERT INTO eoc_status (eoc_type, is_active) VALUES (?, 0) ON DUPLICATE KEY UPDATE eoc_type = eoc_type',
            [type]
        )
    );
    
    await Promise.all(insertQueries);
    
    // Query อีกครั้ง
    const [newRows] = await connection.execute(query, params);
    return NextResponse.json({ success: true, data: newRows });
}
```

### 3. ✅ สร้าง SQL Script

สร้างไฟล์ `create_eoc_status_table.sql` สำหรับ:
- สร้างตาราง `eoc_status` ถ้ายังไม่มี
- Insert default records สำหรับทุก EOC type
- สร้าง view `view_eoc_status_detail` สำหรับดูข้อมูลแบบละเอียด

## วิธีแก้ไขถ้ายังเกิด Error

### ถ้ายังมี 500 Error จาก API

1. **ตรวจสอบว่าตาราง eoc_status มีอยู่หรือไม่:**
```sql
SHOW TABLES LIKE 'eoc_status';
```

2. **ถ้าไม่มี ให้รัน SQL script:**
```bash
mysql -u root -p stneoc < create_eoc_status_table.sql
```

หรือใน phpMyAdmin:
- เปิดไฟล์ `create_eoc_status_table.sql`
- Copy SQL และรันในฐานข้อมูล `stneoc`

3. **ตรวจสอบว่ามีข้อมูล:**
```sql
SELECT * FROM eoc_status;
```

ควรจะมี 5 records:
- flood (is_active = 0)
- drought (is_active = 0)
- tsunami (is_active = 0)
- earthquake (is_active = 0)
- disease (is_active = 0)

### ถ้ายังมี JSON Parse Error

ตรวจสอบ Console และดู:
1. Response status code
2. Response body (อาจไม่ใช่ JSON)
3. Network tab ใน DevTools

## โครงสร้างตาราง eoc_status

```
+----------------+---------------------------------------------------------------+
| Field          | Type                                                          |
+----------------+---------------------------------------------------------------+
| id             | int(11) AUTO_INCREMENT PRIMARY KEY                            |
| eoc_type       | enum('flood','drought','tsunami','earthquake','disease')      |
| is_active      | tinyint(1) DEFAULT 0                                          |
| description    | text                                                          |
| activated_at   | datetime                                                      |
| activated_by   | int(11) FK -> officer(id)                                     |
| deactivated_at | datetime                                                      |
| deactivated_by | int(11) FK -> officer(id)                                     |
| created_at     | timestamp DEFAULT CURRENT_TIMESTAMP                           |
| updated_at     | timestamp DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP|
+----------------+---------------------------------------------------------------+
```

## สรุป Session Validation Error (401)

Error 401 จาก `/api/auth/validate` **ไม่ใช่ปัญหา** แต่เป็นพฤติกรรมปกติที่เกิดขึ้นเมื่อ:
- ไม่มี session token ใน localStorage
- Session หมดอายุ (expires_at < NOW)
- User ไม่ได้ใช้งานเกิน 10 นาที (idle timeout)

การแก้ไข: เปลี่ยนจาก `console.error` เป็น `console.log` เพื่อไม่ให้แสดงเป็น error ที่น่าตกใจ

## ไฟล์ที่แก้ไข

1. ✅ `app/page.jsx` - แก้ไข fetchActiveEOCs และ fetchInfographics
2. ✅ `context/AuthContext.jsx` - ปรับการจัดการ 401 error จาก session validation
3. ❌ `app/api/eoc/status/route.js` - User undo การแก้ไข
4. ❌ `create_eoc_status_table.sql` - User ลบไฟล์

## วันที่แก้ไข
30 ธันวาคม 2568
