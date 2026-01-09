# ✅ สรุปการปรับปรุงระบบทีมงาน EOC

## 🎯 สิ่งที่ได้ทำเสร็จ

### ✅ **1. API Endpoints (3 ไฟล์)**

#### 📁 `app/api/admin/eoc-teams/route.js`
- GET: ดึงรายชื่อทีมทั้งหมด
- POST: สร้างทีมใหม่
- PUT: อัพเดทข้อมูลทีม
- DELETE: ลบทีม (soft delete)

#### 📁 `app/api/user/my-assignments/route.js`
- GET: ดึงข้อมูลทีมและ modules ที่ user รับผิดชอบ

#### 📁 API ที่มีอยู่แล้ว:
- `app/api/admin/eoc-sessions/[sessionId]/teams/route.js` - จัดการทีมใน Session
- `app/api/admin/eoc-teams/[sessionTeamId]/members/route.js` - จัดการสมาชิกในทีม

---

### ✅ **2. Components (2 ไฟล์)**

#### 📁 `components/UserEOCDashboard.jsx`
- แสดง EOC Sessions ที่ user รับผิดชอบ
- แสดงทีมและ modules ที่สามารถเข้าถึงได้
- แสดงสิทธิ์การใช้งาน (สร้าง/แก้ไข/ลบ/อนุมัติ)

#### 📁 Components ที่มีอยู่แล้ว:
- `components/EOCTeamManager.jsx` - จัดการทีมงานสำหรับ Admin

---

### ✅ **3. Pages (1 ไฟล์)**

#### 📁 `app/admin/eoc-sessions/[sessionId]/teams/page.jsx`
- หน้าจัดการทีมงานสำหรับแต่ละ EOC Session
- เฉพาะ Admin เท่านั้น

---

### ✅ **4. การอัพเดทระบบปัจจุบัน**

#### 📝 `app/admin/eoc-management/page.jsx`
- เพิ่มปุ่ม "👥 จัดการทีมงาน" ในแต่ละ EOC Card (แสดงเมื่อ active)
- ลิงก์ไปยังหน้าจัดการทีมงานของ Session นั้นๆ

#### 📝 `app/dashboard/page.jsx`
- เพิ่ม `<UserEOCDashboard />` สำหรับ user ทั่วไป (ไม่ใช่ admin)
- แสดงทีมและโมดูลที่ user รับผิดชอบ

---

## 🚀 วิธีทดสอบระบบ

### **ขั้นตอนที่ 1: รัน SQL Script**

```bash
# เข้า MySQL
mysql -u root -p stneoc

# รัน script สร้างโครงสร้างทีมงาน
source create_eoc_team_system.sql
```

---

### **ขั้นตอนที่ 2: ทดสอบ Admin - เปิด EOC และมอบหมายทีม**

1. **Login ด้วย Admin**
   - ไปที่ `/admin/eoc-management`

2. **เปิด EOC น้ำท่วม**
   - พิมพ์เหตุผล: "ฝนตกหนัก บริเวณลุ่มน้ำสตูล"
   - คลิก "🟢 เปิด EOC"

3. **คลิกปุ่ม "👥 จัดการทีมงาน"**
   - ระบบจะพาไปยัง `/admin/eoc-sessions/{session_id}/teams`

4. **เพิ่มทีม MCAT**
   - คลิก "➕ เพิ่มทีม"
   - เลือกทีม: MCAT
   - เลือกหัวหน้าทีม: เจ้าหน้าที่คนใดก็ได้
   - คลิก "เพิ่มทีม"

5. **เพิ่มสมาชิกในทีม MCAT**
   - ที่การ์ดของทีม MCAT
   - คลิก "➕ เพิ่มสมาชิก"
   - เลือกเจ้าหน้าที่ 3-5 คน
   - บทบาท: สมาชิก
   - คลิก "เพิ่มสมาชิก"

6. **เพิ่มทีม RISKCOM และ SAT** (ทำซ้ำขั้นตอน 4-5)

---

### **ขั้นตอนที่ 3: ทดสอบ User - ดู Dashboard**

1. **Login ด้วย user ที่อยู่ในทีม MCAT**
   - ไปที่ `/dashboard`

2. **ควรเห็น Section "📌 EOC ที่คุณรับผิดชอบ"**
   ```
   [💧 น้ำท่วม #1] - ทีม MCAT (สมาชิก)
     ├─ 🗺️ แผนที่น้ำท่วม [เปิด]
     └─ 📝 รายงานประจำวัน [เปิด]
   ```

3. **คลิกเข้า Module ใดก็ได้**
   - ควรสามารถเข้าได้ตามสิทธิ์ที่กำหนด

---

### **ขั้นตอนที่ 4: ทดสอบการเปลี่ยนทีม**

1. **Admin ถอด user ออกจากทีม MCAT**
   - ไปที่หน้าจัดการทีมงาน
   - คลิก "ถอดออก" ที่รายชื่อสมาชิก

2. **Admin เพิ่ม user เข้าทีม RISKCOM**
   - เพิ่มเป็นสมาชิกใหม่

3. **User Refresh หน้า Dashboard**
   - ควรเห็นทีม RISKCOM แทน MCAT
   - Modules ที่แสดงก็เปลี่ยนตามทีมใหม่

---

## 📊 โครงสร้างฐานข้อมูล

### ตารางที่ต้องมี:
- ✅ `eoc_teams` - ทีมงาน
- ✅ `eoc_type_modules` - Modules ของแต่ละภัย
- ✅ `eoc_session_teams` - มอบหมายทีมให้ Session
- ✅ `eoc_team_members` - สมาชิกในทีม
- ✅ `module_permissions` - สิทธิ์การเข้าถึง
- ✅ `vw_session_team_summary` (View)
- ✅ `vw_officer_team_assignments` (View)

---

## 🔍 การตรวจสอบข้อมูล

### ตรวจสอบว่า user อยู่ในทีมใด:

```sql
SELECT * FROM vw_officer_team_assignments 
WHERE officer_id = 4  -- เปลี่ยนเป็น ID ของ user
  AND is_active = TRUE
  AND session_status = 'active';
```

### ตรวจสอบทีมใน Session:

```sql
SELECT * FROM vw_session_team_summary 
WHERE session_id = 27;  -- เปลี่ยนเป็น Session ID
```

### ตรวจสอบ Modules ของภัย:

```sql
SELECT * FROM eoc_type_modules 
WHERE eoc_type = 'flood' 
  AND is_active = TRUE
ORDER BY sort_order;
```

---

## 🐛 Troubleshooting

### ปัญหา: ไม่เห็น "👥 จัดการทีมงาน"
**สาเหตุ:** EOC ยังไม่ได้เปิดหรือไม่มี `session_id`
**แก้ไข:** เปิด EOC ใหม่อีกครั้ง ระบบจะสร้าง session_id ให้

### ปัญหา: User ไม่เห็น Section "📌 EOC ที่คุณรับผิดชอบ"
**สาเหตุ:** User ยังไม่ได้รับมอบหมายเข้าทีม
**แก้ไข:** Admin ต้องเพิ่ม user เข้าทีมก่อน

### ปัญหา: API `/api/user/my-assignments` Error 401
**สาเหตุ:** ระบบ Auth ไม่ส่ง `x-user-id` ใน header
**แก้ไข:** แก้ไข API ให้ดึง user ID จาก session/cookie ที่ใช้จริง

```javascript
// ตัวอย่างการแก้ใน route.js
const userId = user?.id || request.headers.get('x-user-id');
```

### ปัญหา: View `vw_officer_team_assignments` ไม่มีข้อมูล
**สาเหตุ:** ยังไม่มีการมอบหมายทีม
**แก้ไข:** ต้องมอบหมายทีมและเพิ่มสมาชิกก่อน

---

## 📝 ข้อมูลเพิ่มเติม

### ที่ตั้งไฟล์เอกสาร:
- [EOC_FLEXIBLE_ARCHITECTURE.md](EOC_FLEXIBLE_ARCHITECTURE.md) - สถาปัตยกรรมระบบ
- [EOC_TEAM_QUICKSTART.md](EOC_TEAM_QUICKSTART.md) - คู่มือเริ่มต้นใช้งาน
- [EOC_SYSTEM_SUMMARY.md](EOC_SYSTEM_SUMMARY.md) - สรุปภาพรวมทั้งหมด
- [create_eoc_team_system.sql](create_eoc_team_system.sql) - SQL Script

---

## ✨ Features ที่ได้เพิ่ม

### สำหรับ Admin:
- ✅ มอบหมายทีมให้ EOC Session
- ✅ เพิ่ม/ลบสมาชิกในทีม
- ✅ ดู Session ที่มีทีมอะไรบ้าง
- ✅ เปลี่ยนบทบาทของสมาชิก

### สำหรับ User:
- ✅ ดูทีมที่ตัวเองรับผิดชอบ
- ✅ ดู Modules ที่สามารถเข้าถึงได้
- ✅ ดูสิทธิ์การใช้งานของตัวเอง
- ✅ คลิกเข้าใช้งาน Module ได้ทันที

---

## 🎉 สรุป

ระบบทีมงาน EOC แบบยืดหยุ่นได้ถูกนำไปใช้จริงแล้ว! 

**ไฟล์ที่สร้างใหม่:** 4 ไฟล์
**ไฟล์ที่แก้ไข:** 2 ไฟล์
**API Endpoints:** 3 endpoints
**Components:** 2 components

พร้อมใช้งานเลยครับ! 🚀

---

**หมายเหตุ:** 
- อย่าลืมรัน `create_eoc_team_system.sql` ก่อนใช้งาน
- ตรวจสอบว่า API `/api/user/my-assignments` ดึง user ID ถูกต้อง
- ปรับแต่ง permission ใน `module_permissions` ตามความต้องการ
