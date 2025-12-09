# ระบบ Role-Based Access Control (RBAC)

## 📋 ตาราง Officer

ตารางเก็บข้อมูลเจ้าหน้าที่และบทบาท (Role) ใน 5 ระดับ:

### บทบาท (Roles):
1. **admin** - ผู้ดูแลระบบ (เข้าถึงได้ทุกเมนู)
2. **staff** - เจ้าหน้าที่ทั่วไป
3. **MCATT** - Medical Casualty Assessment and Treatment Team
4. **SAT** - Search and Rescue Team
5. **SeRHT** - Search and Rescue Helicopter Team

## 🔐 สิทธิ์การเข้าถึงเมนู

### Admin (เข้าถึงได้ทั้งหมด):
- ✅ แดชบอร์ด
- ✅ จัดการเหตุการณ์
- ✅ **ทรัพยากร** (บุคลากร, ยานพาหนะ, อุปกรณ์)
- ✅ **รายงาน** (สร้างรายงาน, รายงานทั้งหมด)
- ✅ แผนที่ทั้งหมด
- ✅ การแจ้งเตือน

### Staff, MCATT, SAT, SeRHT (เข้าถึงเหมือน admin ยกเว้น):
- ✅ แดชบอร์ด
- ✅ จัดการเหตุการณ์
- ❌ **ทรัพยากร** (ไม่สามารถเข้าถึง)
- ❌ **รายงาน** (ไม่สามารถเข้าถึง)
- ✅ แผนที่ทั้งหมด
- ✅ การแจ้งเตือน

## 📁 ไฟล์ที่สร้าง

1. **create_officer_table.sql** - สร้างตาราง officer
2. **insert_officer_data.sql** - ข้อมูลตัวอย่าง (รหัสผ่าน: password123)
3. **context/AuthContext.js** - จัดการ authentication และ role
4. **components/Sidebar.js** - อัพเดทให้กรองเมนูตาม role
5. **components/Navbar.js** - อัพเดทให้กรองเมนูตาม role
6. **app/layout.js** - เพิ่ม AuthProvider

## 🚀 วิธีใช้งาน

### 1. สร้างตารางและข้อมูล
```sql
-- รัน SQL ใน MySQL
source create_officer_table.sql;
source insert_officer_data.sql;
```

### 2. Login ในโค้ด
```javascript
import { useAuth } from "@/context/AuthContext";

function LoginPage() {
    const { login } = useAuth();
    
    // หลัง login สำเร็จ
    login({
        id: 1,
        username: 'admin',
        full_name: 'ผู้ดูแลระบบ',
        role: 'admin' // หรือ 'staff', 'MCATT', 'SAT', 'SeRHT'
    });
}
```

### 3. ตรวจสอบสิทธิ์ในหน้าต่างๆ
```javascript
import { useAuth } from "@/context/AuthContext";

function ResourcesPage() {
    const { canAccessResources, user } = useAuth();
    
    if (!canAccessResources()) {
        return <div>คุณไม่มีสิทธิ์เข้าถึงหน้านี้</div>;
    }
    
    return <div>หน้าจัดการทรัพยากร</div>;
}
```

## 📊 ตัวอย่าง User

| Username | Password | Role | Email |
|----------|----------|------|-------|
| admin | password123 | admin | admin@eoc.satun.go.th |
| staff01 | password123 | staff | staff01@eoc.satun.go.th |
| mcatt01 | password123 | MCATT | mcatt01@eoc.satun.go.th |
| sat01 | password123 | SAT | sat01@eoc.satun.go.th |
| serht01 | password123 | SeRHT | serht01@eoc.satun.go.th |

## 🔧 ฟังก์ชันใน AuthContext

- `login(userData)` - Login user
- `logout()` - Logout user
- `hasAccess(role)` - ตรวจสอบ role
- `canAccessResources()` - เช็คสิทธิ์เข้าถึงทรัพยากร (เฉพาะ admin)
- `canAccessReports()` - เช็คสิทธิ์เข้าถึงรายงาน (เฉพาะ admin)

## 🎯 การทำงาน

1. **Sidebar** และ **Navbar** จะแสดงเมนูตาม role อัตโนมัติ
2. Role **admin** เห็นเมนูทั้งหมด
3. Role **staff, MCATT, SAT, SeRHT** เห็นเมนูเหมือนกัน แต่ไม่มี "ทรัพยากร" และ "รายงาน"
4. ใช้ `canAccessResources()` และ `canAccessReports()` ป้องกันการเข้าถึงหน้าโดยตรง

## 🔒 Security Notes

⚠️ **สำคัญ**: ในการใช้งานจริง ควร:
1. Hash รหัสผ่านด้วย bcrypt
2. ใช้ JWT หรือ session authentication
3. Validate role ทั้งฝั่ง client และ server
4. เพิ่ม middleware ป้องกันการเข้าถึง API
