# 🚀 Quick Start Guide: ระบบทีมงาน EOC แบบยืดหยุ่น

## 📋 ขั้นตอนการติดตั้ง

### 1. รัน SQL Script

```bash
# เข้า MySQL
mysql -u root -p stneoc

# รัน script สร้างโครงสร้างทีมงาน
source create_eoc_team_system.sql
```

**ผลลัพธ์ที่ได้:**
- ✅ ตาราง `eoc_teams` (ข้อมูลทีมงาน 7 ทีม)
- ✅ ตาราง `eoc_type_modules` (Modules ตัวอย่างสำหรับ flood, disease, drought)
- ✅ ตาราง `eoc_session_teams` (เชื่อม Session กับทีม)
- ✅ ตาราง `eoc_team_members` (สมาชิกในทีม)
- ✅ ตาราง `module_permissions` (สิทธิ์การเข้าถึง)
- ✅ View `vw_session_team_summary` และ `vw_officer_team_assignments`

---

## 🎯 การใช้งานพื้นฐาน

### **Scenario 1: เปิด EOC น้ำท่วมและมอบหมายทีม**

#### ขั้นตอนที่ 1: เปิด EOC Session (ทำผ่าน Admin)

```javascript
// หน้า Admin: จัดการ EOC Sessions
// URL: /admin/eoc-management

// 1. คลิก "เปิด EOC"
// 2. เลือกประเภท: น้ำท่วม (flood)
// 3. ระบุเหตุผล: "ฝนตกหนักบริเวณลุ่มน้ำสตูล"
// 4. คลิก "เปิด EOC"

// ระบบจะสร้าง eoc_sessions ใหม่ เช่น id = 31
```

#### ขั้นตอนที่ 2: มอบหมายทีมงาน

```javascript
// หน้า: จัดการทีมงาน EOC
// URL: /admin/eoc-sessions/31/teams

// ใช้ Component: <EOCTeamManager sessionId={31} />

// 1. คลิก "➕ เพิ่มทีม"
// 2. เลือกทีม MCAT
// 3. เลือกหัวหน้าทีม: นางสาวสมหญิง
// 4. คลิก "เพิ่มทีม"

// 5. เพิ่มทีม RISKCOM (หัวหน้า: นายสมชาย)
// 6. เพิ่มทีม SAT (หัวหน้า: ร.ต.ประเสริฐ)
```

#### ขั้นตอนที่ 3: เพิ่มสมาชิกในทีม

```javascript
// ที่การ์ดของทีม MCAT
// 1. คลิก "➕ เพิ่มสมาชิก"
// 2. เลือกเจ้าหน้าที่: นายสมศักดิ์
// 3. บทบาท: สมาชิก
// 4. คลิก "เพิ่มสมาชิก"

// เพิ่มสมาชิก 4-5 คนในทีม MCAT
```

---

### **Scenario 2: เจ้าหน้าที่ Login และเห็นหน้า Dashboard**

```javascript
// นางสาวสมหญิง Login เข้าระบบ
// ระบบตรวจสอบว่าเธออยู่ทีมไหน ของ Session ไหนบ้าง

// API Call (Auto)
GET /api/user/my-assignments

// Response:
{
  "success": true,
  "assignments": [
    {
      "session_id": 31,
      "eoc_type": "flood",
      "eoc_name": "น้ำท่วม",
      "session_number": 3,
      "team_code": "MCAT",
      "team_name": "ทีมประเมินสถานการณ์",
      "role_in_team": "หัวหน้าทีม",
      "modules": [
        {
          "module_code": "flood_map",
          "module_name": "แผนที่น้ำท่วม",
          "route": "/eoc/flood/map",
          "can_view": true,
          "can_create": true,
          "can_edit": true
        },
        {
          "module_code": "daily_report",
          "module_name": "รายงานประจำวัน",
          "route": "/eoc/flood/daily-report",
          "can_view": true,
          "can_create": true,
          "can_edit": true
        }
      ]
    }
  ]
}

// Dashboard จะแสดง:
// [💧 น้ำท่วม #31] - ทีม MCAT (หัวหน้าทีม)
//   ├─ 🗺️ แผนที่น้ำท่วม [เปิด]
//   └─ 📝 รายงานประจำวัน [เปิด]
```

---

### **Scenario 3: เปลี่ยนเจ้าหน้าที่จากทีม RISKCOM → MCAT**

```sql
-- Admin ถอด นายสมชาย ออกจากทีม RISKCOM
-- API: DELETE /api/admin/eoc-teams/{sessionTeamId}/members?memberId=5

UPDATE eoc_team_members 
SET is_active = FALSE, removed_at = NOW()
WHERE id = 5;

-- Admin เพิ่ม นายสมชาย เข้าทีม MCAT
-- API: POST /api/admin/eoc-teams/{sessionTeamId}/members

INSERT INTO eoc_team_members (session_team_id, officer_id, role_in_team, assigned_by)
VALUES (2, 12, 'สมาชิก', 1);

-- นายสมชาย Login ใหม่ → เห็นเมนู MCAT แทน RISKCOM
```

---

## 📝 ตัวอย่างหน้า Admin

### หน้า 1: Admin - จัดการทีมงาน EOC Session

**URL:** `/admin/eoc-sessions/31/teams`

**Code:**
```jsx
// app/admin/eoc-sessions/[sessionId]/teams/page.jsx
import EOCTeamManager from '@/components/EOCTeamManager';

export default function EOCSessionTeamsPage({ params }) {
    return (
        <div className="container mx-auto p-6">
            <EOCTeamManager 
                sessionId={params.sessionId}
                onTeamUpdated={() => {
                    // Refresh data or show notification
                    console.log('Teams updated');
                }}
            />
        </div>
    );
}
```

---

## 🔧 API Endpoints ที่ต้องเพิ่ม

### 1. **GET /api/admin/eoc-teams** - ดึงรายชื่อทีมทั้งหมด

```javascript
// app/api/admin/eoc-teams/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const active = searchParams.get('active');

        let query = 'SELECT * FROM eoc_teams';
        if (active === 'true') {
            query += ' WHERE is_active = TRUE';
        }
        query += ' ORDER BY sort_order';

        const [teams] = await pool.query(query);

        return NextResponse.json({
            success: true,
            teams: teams
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด'
        }, { status: 500 });
    }
}
```

### 2. **GET /api/admin/officers** - ดึงรายชื่อเจ้าหน้าที่

```javascript
// app/api/admin/officers/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';

export async function GET(request) {
    try {
        const [officers] = await pool.query(`
            SELECT id, username, full_name, role 
            FROM officer 
            WHERE active = TRUE 
            ORDER BY full_name
        `);

        return NextResponse.json({
            success: true,
            officers: officers
        });
    } catch (error) {
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด'
        }, { status: 500 });
    }
}
```

### 3. **GET /api/user/my-assignments** - ดึงข้อมูลทีมที่ user ปฏิบัติงาน

```javascript
// app/api/user/my-assignments/route.js
import { NextResponse } from 'next/server';
import pool from '@/lib/db';
import { getServerSession } from 'next-auth';

export async function GET(request) {
    try {
        const session = await getServerSession();
        const userId = session?.user?.id;

        if (!userId) {
            return NextResponse.json({
                success: false,
                message: 'Unauthorized'
            }, { status: 401 });
        }

        // ดึงข้อมูลจาก view
        const [assignments] = await pool.query(`
            SELECT * FROM vw_officer_team_assignments
            WHERE officer_id = ? AND is_active = TRUE
        `, [userId]);

        // ดึง modules ที่แต่ละทีมสามารถเข้าถึงได้
        for (let assignment of assignments) {
            const [modules] = await pool.query(`
                SELECT 
                    m.module_code,
                    m.module_name_th,
                    m.route_path,
                    m.icon,
                    p.can_view,
                    p.can_create,
                    p.can_edit,
                    p.can_delete,
                    p.can_approve
                FROM eoc_type_modules m
                JOIN module_permissions p ON m.id = p.module_id
                WHERE m.eoc_type = ? 
                  AND p.team_id = (SELECT id FROM eoc_teams WHERE team_code = ?)
                  AND m.is_active = TRUE
                ORDER BY m.sort_order
            `, [assignment.eoc_type, assignment.team_code]);

            assignment.modules = modules;
        }

        return NextResponse.json({
            success: true,
            assignments: assignments
        });

    } catch (error) {
        return NextResponse.json({
            success: false,
            message: 'เกิดข้อผิดพลาด'
        }, { status: 500 });
    }
}
```

---

## 🎨 Component ที่ต้องสร้าง/แก้ไข

### 1. **User Dashboard - แสดงทีมที่รับผิดชอบ**

```jsx
// components/UserEOCDashboard.jsx
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function UserEOCDashboard() {
    const [assignments, setAssignments] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        loadAssignments();
    }, []);

    const loadAssignments = async () => {
        try {
            const response = await fetch('/api/user/my-assignments');
            const data = await response.json();
            if (data.success) {
                setAssignments(data.assignments);
            }
        } catch (error) {
            console.error('Error loading assignments:', error);
        } finally {
            setLoading(false);
        }
    };

    if (loading) return <div>Loading...</div>;

    if (assignments.length === 0) {
        return (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 text-center">
                <p className="text-yellow-800">
                    ⚠️ คุณยังไม่ได้รับมอบหมายให้ปฏิบัติงานใน EOC Session ใด
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <h2 className="text-2xl font-bold">📌 EOC ที่คุณรับผิดชอบ</h2>

            {assignments.map((assignment) => (
                <div key={`${assignment.session_id}-${assignment.team_code}`} 
                     className="bg-white rounded-lg shadow-md border-l-4 border-blue-500 p-6">
                    
                    {/* Session Info */}
                    <div className="mb-4">
                        <h3 className="text-xl font-bold">
                            {assignment.eoc_name} #{assignment.session_number}
                        </h3>
                        <p className="text-gray-600">
                            ทีม: {assignment.team_name_th} ({assignment.team_code})
                            {assignment.role_in_team && ` • ${assignment.role_in_team}`}
                        </p>
                    </div>

                    {/* Modules */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        {assignment.modules.map((module) => (
                            <Link 
                                key={module.module_code}
                                href={module.route_path}
                                className="flex items-center space-x-3 p-3 border rounded-lg hover:bg-gray-50 transition"
                            >
                                <span className="text-2xl">{module.icon}</span>
                                <div className="flex-1">
                                    <div className="font-medium">{module.module_name_th}</div>
                                    <div className="text-sm text-gray-500">
                                        {module.can_create && '✏️ สร้าง '}
                                        {module.can_edit && '📝 แก้ไข '}
                                        {module.can_delete && '🗑️ ลบ '}
                                        {module.can_approve && '✅ อนุมัติ'}
                                        {!module.can_create && !module.can_edit && '👁️ ดูอย่างเดียว'}
                                    </div>
                                </div>
                            </Link>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    );
}
```

### 2. **เพิ่มลิงก์ใน Admin Menu**

```jsx
// components/Sidebar.jsx หรือ Navbar.jsx

// เพิ่มเมนู Admin
{user?.role === 'admin' && (
    <Link href="/admin/eoc-sessions">
        🏢 จัดการ EOC Sessions
    </Link>
)}
```

---

## ✅ Checklist การติดตั้ง

- [ ] รัน `create_eoc_team_system.sql`
- [ ] สร้างไฟล์ API:
  - [ ] `/api/admin/eoc-teams/route.js`
  - [ ] `/api/admin/officers/route.js`
  - [ ] `/api/admin/eoc-sessions/[sessionId]/teams/route.js`
  - [ ] `/api/admin/eoc-teams/[sessionTeamId]/members/route.js`
  - [ ] `/api/user/my-assignments/route.js`
- [ ] สร้าง Component:
  - [ ] `components/EOCTeamManager.jsx`
  - [ ] `components/UserEOCDashboard.jsx`
- [ ] สร้างหน้า Admin:
  - [ ] `app/admin/eoc-sessions/[sessionId]/teams/page.jsx`
- [ ] แก้ไข Dashboard ของ User ให้แสดง `<UserEOCDashboard />`
- [ ] เพิ่มเมนู "จัดการทีมงาน" ใน Sidebar/Navbar

---

## 🧪 การทดสอบ

### Test Case 1: เปิด EOC และมอบหมายทีม
1. Login ด้วย admin
2. เปิด EOC น้ำท่วมครั้งใหม่
3. มอบหมาย 3 ทีม (MCAT, RISKCOM, SAT)
4. เพิ่มสมาชิก 3-5 คนในแต่ละทีม

### Test Case 2: User เห็นเฉพาะทีมของตัวเอง
1. Login ด้วย user ที่อยู่ในทีม MCAT
2. ดู Dashboard → ควรเห็นเฉพาะ modules ของ MCAT
3. ลอง access module ของทีมอื่น → ควรถูก block

### Test Case 3: เปลี่ยนทีมกลางคัน
1. Admin ถอด user ออกจากทีม MCAT
2. Admin เพิ่ม user เข้าทีม RISKCOM
3. User refresh หน้า → เห็น modules ของ RISKCOM แทน

---

## 📞 สรุป

ระบบนี้ช่วยให้:
- ✅ มอบหมายทีมงานแบบยืดหยุ่นในแต่ละ Session
- ✅ เจ้าหน้าที่เห็นเฉพาะเมนูที่ตัวเองรับผิดชอบ
- ✅ เปลี่ยนบทบาทได้ง่าย ไม่ต้องแก้โค้ด
- ✅ รองรับหลาย EOC Type ที่มีเมนูต่างกัน
- ✅ มี History การเปลี่ยนแปลงทีมงาน

---

**คำแนะนำเพิ่มเติม:**
- ใช้ `EOCContext` ร่วมกับ API เพื่อ cache ข้อมูล
- เพิ่ม Notification เมื่อได้รับมอบหมายทีมใหม่
- สร้าง Report แสดงสถิติการทำงานของแต่ละทีม
