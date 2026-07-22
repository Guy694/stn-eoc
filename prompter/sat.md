คุณเป็น Senior Next.js Developer และ UX/UI Designer ผู้เชี่ยวชาญด้านการพัฒนาระบบ Emergency Operations Center: EOC

จงปรับปรุง Sidebar Menu ของระบบ EOC โดยเพิ่มเมนูหลักสำหรับเจ้าหน้าที่ **ทีม SAT — Situation Awareness Team หรือทีมตระหนักรู้สถานการณ์**

ก่อนแก้ไขโค้ด ให้ตรวจสอบโครงสร้างโปรเจกต์เดิม รวมถึง Sidebar, Navigation Configuration, Route, Layout, Authentication และ Permission ที่ระบบใช้อยู่ ห้ามสร้างระบบ Navigation ซ้ำ หากระบบเดิมมี Component หรือ Configuration สำหรับ Sidebar ให้แก้ไขและนำของเดิมกลับมาใช้

## 1. เมนูหลักทีม SAT

เพิ่มเมนูหลักใน Sidebar ดังนี้

```text
ทีม SAT
├── Dashboard
└── รายงานผล
```

รายละเอียดเมนู:

### เมนู Dashboard

* ชื่อเมนู: `Dashboard`
* ไอคอน: `LayoutDashboard`
* Route:

```text
/stn-eoc/eoc/disease/dashboard
```

### เมนูรายงานผล

* ชื่อเมนู: `รายงานผล`
* ไอคอน: `ClipboardList` หรือ `FileText`
* Route:

```text
/stn-eoc/eoc/disease/records
```

### เมนูหลักทีม SAT

* ชื่อเมนู: `ทีม SAT`
* ไอคอน: `Activity`, `Radar` หรือ `ChartNoAxesCombined`
* รองรับการย่อและขยายเมนู
* แสดงลูกศรขึ้นหรือลงตามสถานะการเปิดเมนู
* เมื่ออยู่ใน Route ภายใต้ทีม SAT ให้เมนูหลักเปิดอยู่โดยอัตโนมัติ
* เมนูย่อยที่ตรงกับ Route ปัจจุบันต้องมี Active State ชัดเจน
* เมื่อ Sidebar ถูกย่อ ให้แสดง Tooltip ชื่อเมนู
* ใช้ Component และรูปแบบเดียวกับ Sidebar เดิมของระบบ

## 2. โครงสร้าง Navigation Configuration

หากระบบใช้ Navigation Configuration ให้เพิ่มข้อมูลในรูปแบบใกล้เคียงดังนี้

```tsx
import {
  Activity,
  ClipboardList,
  LayoutDashboard,
} from "lucide-react";

export const satTeamMenu = {
  title: "ทีม SAT",
  icon: Activity,
  requiredPermissions: ["sat:view"],
  items: [
    {
      title: "Dashboard",
      href: "/stn-eoc/eoc/disease/dashboard",
      icon: LayoutDashboard,
      requiredPermissions: ["sat:dashboard:view"],
    },
    {
      title: "รายงานผล",
      href: "/stn-eoc/eoc/disease/records",
      icon: ClipboardList,
      requiredPermissions: ["sat:records:view"],
    },
  ],
};
```

ให้ปรับชื่อ Property ให้ตรงกับโครงสร้าง Navigation ที่โปรเจกต์เดิมใช้งานจริง ห้ามสร้าง Interface ใหม่ที่ซ้ำกับของเดิมโดยไม่จำเป็น

## 3. หน้า Dashboard ทีม SAT

ใช้ Route เดิม:

```text
/stn-eoc/eoc/disease/dashboard
```

ให้ตรวจสอบและปรับหน้า Dashboard เดิมให้แสดงข้อมูลสำหรับทีม SAT โดยไม่ทำลาย Function เดิม

หน้า Dashboard ต้องมีองค์ประกอบดังนี้

### 3.1 Header

แสดงข้อมูล:

* ชื่อหน้าว่า `Dashboard ทีม SAT`
* ชื่อเหตุการณ์หรือโรคที่กำลังเปิด EOC
* สถานะ EOC
* วันที่และเวลาเปิด EOC
* รอบรายงานปัจจุบัน
* วันที่และเวลาอัปเดตข้อมูลล่าสุด
* ปุ่ม Refresh
* ตัวกรองช่วงวันที่
* ตัวกรองพื้นที่หรืออำเภอ
* ตัวกรองรอบรายงาน

ตัวอย่างข้อความ:

```text
Dashboard ทีม SAT
ศูนย์ปฏิบัติการภาวะฉุกเฉินด้านโรคไข้เลือดออก

สถานะ: เปิด EOC
รอบรายงาน: ก่อนเวลา 15:00 น.
อัปเดตล่าสุด: 22 กรกฎาคม 2569 เวลา 14:30 น.
```

### 3.2 Summary Cards

แสดง Summary Cards อย่างน้อย 4–6 รายการ เช่น

1. จำนวนผู้ป่วยรายใหม่
2. จำนวนผู้ป่วยสะสม
3. จำนวนพื้นที่หรืออำเภอที่พบผู้ป่วย
4. จำนวนพื้นที่ระบาด
5. จำนวนรายงานที่ได้รับ
6. ความครบถ้วนของข้อมูล

แต่ละ Card ต้องมี:

* ชื่อตัวชี้วัด
* ค่าปัจจุบัน
* หน่วย
* เปรียบเทียบกับรอบก่อนหน้า
* ไอคอน
* สถานะเพิ่มขึ้น ลดลง หรือคงที่
* Skeleton ขณะโหลดข้อมูล

### 3.3 Chart แนวโน้มสถานการณ์

สร้าง Chart ด้วย Recharts โดยใช้ `ResponsiveContainer`

กราฟหลักให้แสดง:

* จำนวนผู้ป่วยรายใหม่ตามสัปดาห์
* จำนวนผู้ป่วยสะสมตามสัปดาห์

สามารถใช้ `LineChart`, `AreaChart` หรือ `ComposedChart` ตามความเหมาะสม

Chart ต้องมี:

* ชื่อกราฟ
* คำอธิบาย
* แกน X เป็นสัปดาห์ระบาดหรือช่วงวันที่
* แกน Y เป็นจำนวนผู้ป่วย
* Tooltip
* Legend
* Responsive
* Empty State
* Error State
* Skeleton Loading
* รองรับข้อความภาษาไทย
* แสดงเวลาที่อัปเดตข้อมูล

หากมีข้อมูลหลายปี ให้สามารถเลือกปีงบประมาณหรือปี พ.ศ. ได้

### 3.4 Chart แยกรายอำเภอ

สร้าง Bar Chart แสดงจำนวนผู้ป่วยแยกรายอำเภอ ได้แก่

* เมืองสตูล
* ควนโดน
* ควนกาหลง
* ท่าแพ
* ละงู
* ทุ่งหว้า
* มะนัง

เมื่อคลิกแท่งกราฟ ให้กรองข้อมูล Dashboard หรือนำผู้ใช้ไปยังรายละเอียดของอำเภอนั้น หากระบบเดิมรองรับ

### 3.5 สถานะการรายงาน

แสดงข้อมูลความครบถ้วนของการรายงาน เช่น

```text
รายงานแล้ว 18 หน่วยงาน
ยังไม่รายงาน 5 หน่วยงาน
ความครบถ้วน 78.26%
```

สามารถแสดงเป็น Progress Bar, Donut Chart หรือ Summary Card ได้ แต่ต้องอ่านง่ายและไม่ใช้สีมากเกินความจำเป็น

## 4. แสดงกลุ่มสมาชิกทีม SAT

ภายในหน้า Dashboard ให้เพิ่มส่วน:

```text
สมาชิกทีม SAT
```

แสดงสมาชิกในรูปแบบ Card หรือ List โดยมีข้อมูล:

* รูปประจำตัวหรือ Avatar
* ชื่อ–นามสกุล
* ตำแหน่ง
* หน่วยงาน
* บทบาทในทีม SAT
* ช่องทางติดต่อ หากผู้ใช้มีสิทธิ์เข้าถึง
* สถานะการใช้งาน
* เวลาที่เข้าใช้งานล่าสุด หรือเวลาที่ส่งรายงานล่าสุด

ตัวอย่างบทบาท:

```text
หัวหน้าทีม SAT
รองหัวหน้าทีม
ผู้วิเคราะห์สถานการณ์
ผู้รวบรวมข้อมูล
ผู้บันทึกข้อมูล
ผู้ประสานงาน
```

ส่วนสมาชิกต้องรองรับ:

* Responsive Grid
* ค้นหาสมาชิก
* กรองตามบทบาท
* Empty State เมื่อยังไม่มีสมาชิก
* จำกัดการแสดงข้อมูลส่วนบุคคลตาม Permission
* ห้ามแสดงเบอร์โทรศัพท์หรือข้อมูลติดต่อแก่ผู้ไม่มีสิทธิ์

หากจำนวนสมาชิกมาก ให้แสดงสมาชิกส่วนหนึ่งใน Dashboard และมีปุ่ม:

```text
ดูสมาชิกทั้งหมด
```

หากระบบมีหน้าจัดการสมาชิกเดิม ให้นำทางไปยังหน้าเดิม ห้ามสร้างข้อมูลสมาชิกซ้ำ

## 5. หน้า “รายงานผล”

ใช้ Route เดิม:

```text
/stn-eoc/eoc/disease/records
```

เพิ่มเมนู `รายงานผล` ให้เชื่อมไปยัง Route นี้โดยตรง

ให้ตรวจสอบหน้าเดิมและปรับชื่อหรือองค์ประกอบให้สอดคล้องกับทีม SAT โดยหน้า Records ต้องใช้สำหรับ:

* ดูรายการรายงานสถานการณ์ทั้งหมด
* ค้นหารายงาน
* กรองตามวันที่
* กรองตามสัปดาห์ระบาด
* กรองตามพื้นที่หรืออำเภอ
* กรองตามหน่วยงาน
* กรองตามสถานะ
* ดูรายละเอียดรายงาน
* เพิ่มรายงานใหม่ หากผู้ใช้มีสิทธิ์
* แก้ไขรายงานที่ยังเป็นฉบับร่าง
* ส่งรายงาน
* ส่งกลับแก้ไข
* อนุมัติรายงานตามสิทธิ์
* Export Excel หรือ PDF หากระบบรองรับ

คอลัมน์ในตารางควรประกอบด้วย:

```text
ลำดับ
วันที่รายงาน
สัปดาห์ระบาด
พื้นที่
หน่วยงานผู้รายงาน
ประเภทข้อมูล
จำนวนผู้ป่วย
สถานะ
ผู้บันทึก
อัปเดตล่าสุด
การจัดการ
```

สถานะรายงาน:

```text
DRAFT
SUBMITTED
UNDER_REVIEW
APPROVED
REJECTED
LATE
```

แสดงสถานะเป็น Badge ภาษาไทย:

```text
ฉบับร่าง
ส่งรายงานแล้ว
รอตรวจสอบ
อนุมัติแล้ว
ส่งกลับแก้ไข
ล่าช้า
```

ใช้ TanStack Table หากโปรเจกต์มีการใช้งานอยู่แล้ว

## 6. Active Route

กำหนด Active State ให้ถูกต้อง:

```text
/stn-eoc/eoc/disease/dashboard
```

ให้ Active ที่:

```text
ทีม SAT > Dashboard
```

และ Route ที่ขึ้นต้นด้วย:

```text
/stn-eoc/eoc/disease/records
```

เช่น:

```text
/stn-eoc/eoc/disease/records
/stn-eoc/eoc/disease/records/create
/stn-eoc/eoc/disease/records/123
/stn-eoc/eoc/disease/records/123/edit
```

ให้ Active ที่:

```text
ทีม SAT > รายงานผล
```

อย่าใช้การตรวจสอบ Route แบบเทียบข้อความตรงเพียงอย่างเดียวในกรณีที่มี Route ย่อย ให้ใช้ `startsWith` หรือ Utility Function ที่ระบบเดิมมีอยู่

ตัวอย่าง:

```tsx
const isDashboardActive =
  pathname === "/stn-eoc/eoc/disease/dashboard";

const isRecordsActive =
  pathname.startsWith("/stn-eoc/eoc/disease/records");

const isSatActive =
  isDashboardActive || isRecordsActive;
```

## 7. Permission

สร้างหรือใช้ Permission เดิมของระบบ:

```text
sat:view
sat:dashboard:view
sat:records:view
sat:records:create
sat:records:update
sat:records:submit
sat:records:approve
sat:members:view
sat:members:contact:view
```

เงื่อนไข:

* ผู้ใช้ไม่มี `sat:view` ห้ามแสดงเมนูทีม SAT
* ผู้ใช้ไม่มี `sat:dashboard:view` ห้ามเปิด Dashboard
* ผู้ใช้ไม่มี `sat:records:view` ห้ามเปิดหน้ารายงานผล
* ผู้ใช้ไม่มี `sat:members:view` ห้ามแสดงรายชื่อสมาชิก
* ผู้ใช้ไม่มี `sat:members:contact:view` ห้ามแสดงข้อมูลติดต่อ
* ผู้ดูแลระบบสามารถเข้าถึงทุกเมนู
* ผู้บัญชาการเหตุการณ์สามารถดู Dashboard และรายงานผล
* ตรวจสอบ Permission ที่ Server ทุกครั้ง ห้ามป้องกันเฉพาะใน Sidebar

เมื่อไม่มีสิทธิ์ ให้แสดงหน้า `403 Forbidden` หรือข้อความที่สอดคล้องกับระบบเดิม

## 8. Folder Structure ที่แนะนำ

ให้ตรวจสอบโครงสร้างเดิมก่อน หากยังไม่มีโครงสร้าง Feature สำหรับทีม SAT ให้ใช้แนวทางดังนี้:

```text
src/
├── app/
│   └── stn-eoc/
│       └── eoc/
│           └── disease/
│               ├── dashboard/
│               │   ├── page.tsx
│               │   ├── loading.tsx
│               │   └── error.tsx
│               │
│               └── records/
│                   ├── page.tsx
│                   ├── loading.tsx
│                   ├── error.tsx
│                   ├── create/
│                   │   └── page.tsx
│                   └── [recordId]/
│                       ├── page.tsx
│                       └── edit/
│                           └── page.tsx
│
├── features/
│   └── eoc/
│       └── teams/
│           └── sat/
│               ├── components/
│               │   ├── sat-dashboard.tsx
│               │   ├── sat-dashboard-header.tsx
│               │   ├── sat-summary-cards.tsx
│               │   ├── sat-trend-chart.tsx
│               │   ├── sat-district-chart.tsx
│               │   ├── sat-reporting-progress.tsx
│               │   ├── sat-member-group.tsx
│               │   ├── sat-record-table.tsx
│               │   └── sat-dashboard-skeleton.tsx
│               │
│               ├── queries/
│               │   ├── get-sat-dashboard.ts
│               │   ├── get-sat-records.ts
│               │   └── get-sat-members.ts
│               │
│               ├── schemas/
│               │   ├── sat-dashboard.schema.ts
│               │   └── sat-record-filter.schema.ts
│               │
│               ├── services/
│               │   └── sat.service.ts
│               │
│               ├── types/
│               │   └── sat.types.ts
│               │
│               └── index.ts
│
└── config/
    └── navigation/
        └── sat-team-menu.ts
```

ถ้าโปรเจกต์มีโครงสร้างอื่นอยู่แล้ว ให้รักษารูปแบบเดิมและเพิ่มเฉพาะไฟล์ที่จำเป็น

## 9. TypeScript

ไฟล์ใหม่ทั้งหมดต้องเป็น TypeScript หรือ TSX

ห้ามใช้:

```ts
any
```

ให้สร้าง Type ที่ชัดเจน เช่น:

```tsx
export type SatTeamMember = {
  id: string;
  fullName: string;
  position: string;
  organization: string;
  teamRole: string;
  avatarUrl?: string | null;
  phone?: string | null;
  email?: string | null;
  isActive: boolean;
  lastActiveAt?: string | null;
};

export type SatDashboardMetric = {
  key: string;
  label: string;
  value: number;
  unit?: string;
  previousValue?: number;
  trend?: "up" | "down" | "stable";
};

export type SatTrendPoint = {
  epidemiologicalWeek: string;
  newCases: number;
  cumulativeCases: number;
};

export type SatDistrictData = {
  districtCode: string;
  districtName: string;
  caseCount: number;
};

export type SatDashboardData = {
  metrics: SatDashboardMetric[];
  trend: SatTrendPoint[];
  districtData: SatDistrictData[];
  members: SatTeamMember[];
  reportingProgress: {
    expected: number;
    submitted: number;
    pending: number;
    completenessPercentage: number;
  };
  updatedAt: string;
};
```

## 10. การจัดการข้อมูล

ห้ามเขียน Mock Data ไว้ภายใน JSX Component

หากยังไม่มี API ให้แยก Mock Data ไว้ใน:

```text
src/features/eoc/teams/sat/mocks/
├── sat-dashboard.mock.ts
├── sat-records.mock.ts
└── sat-members.mock.ts
```

ออกแบบ Service ให้สามารถเปลี่ยนจาก Mock Data ไปเป็น Database หรือ API จริงภายหลังได้โดยไม่ต้องแก้ UI Component

## 11. UI/UX

ใช้รูปแบบ UI เดิมของระบบเป็นหลัก โดยมีข้อกำหนดเพิ่มเติม:

* รูปแบบ Government EOC Dashboard
* โทนสีกรมท่า น้ำเงิน ฟ้า ขาว
* ใช้สีแดงเฉพาะ Critical หรือ Error
* ใช้สีเหลืองหรือส้มสำหรับ Warning
* ใช้สีเขียวสำหรับสถานะปกติหรือรายงานครบ
* Visual hierarchy ชัดเจน
* Chart อ่านง่าย
* ไม่ใช้ Gradient หรือ Animation มากเกินไป
* Responsive สำหรับ Desktop, Laptop และ Tablet
* รองรับ Dark Mode หากระบบเดิมมี
* ไม่สร้าง Card ซ้อน Card มากเกินความจำเป็น
* ใช้ภาษาไทยที่ถูกต้องและเป็นทางการ

Desktop Layout:

```text
Header Dashboard

Summary Card | Summary Card | Summary Card
Summary Card | Summary Card | Summary Card

Trend Chart                    | ความครบถ้วนการรายงาน
พื้นที่รายอำเภอ                 | ประเด็นเฝ้าระวัง

สมาชิกทีม SAT

รายงานล่าสุด
```

Tablet Layout:

```text
Header Dashboard

Summary Cards 2 คอลัมน์

Trend Chart

ความครบถ้วนการรายงาน

Chart รายอำเภอ

สมาชิกทีม SAT

รายงานล่าสุด
```

## 12. Loading, Error และ Empty State

สร้างสถานะให้ครบ:

* Loading Skeleton
* Error State
* Empty State
* Unauthorized State
* ปุ่ม Refresh หรือ Retry

ตัวอย่างข้อความ Empty State:

```text
ยังไม่มีข้อมูลรายงานสำหรับรอบปัจจุบัน
เมื่อหน่วยงานส่งรายงาน ข้อมูลจะปรากฏใน Dashboard โดยอัตโนมัติ
```

ตัวอย่างสมาชิกว่าง:

```text
ยังไม่มีการกำหนดสมาชิกทีม SAT
กรุณาติดต่อผู้ดูแลระบบเพื่อเพิ่มสมาชิกทีม
```

## 13. Security

ดำเนินการดังนี้:

* ตรวจสอบ Session ที่ Server
* ตรวจสอบ Permission ที่ Server
* Validate Query Parameters ด้วย Zod
* ป้องกันการเข้าถึงข้อมูลผ่านการแก้ URL
* จำกัดข้อมูลสมาชิกตามสิทธิ์
* ไม่ส่งข้อมูลติดต่อของสมาชิกไปยัง Client หากผู้ใช้ไม่มีสิทธิ์
* บันทึก Audit Log สำหรับการดูหรือ Export ข้อมูลสำคัญ
* ห้ามเชื่อถือ Role หรือ Permission ที่ส่งมาจาก Client
* ใช้ Database Query ที่จำกัดตามขอบเขตเหตุการณ์และหน่วยงาน

## 14. Acceptance Criteria

งานถือว่าเสร็จเมื่อ:

1. Sidebar มีเมนูหลัก `ทีม SAT`
2. เมนูทีม SAT ย่อและขยายได้
3. มีเมนูย่อย `Dashboard`
4. Dashboard เชื่อมไปยัง `/stn-eoc/eoc/disease/dashboard`
5. มีเมนูย่อย `รายงานผล`
6. รายงานผลเชื่อมไปยัง `/stn-eoc/eoc/disease/records`
7. Active State ทำงานทั้ง Route หลักและ Route ย่อย
8. หน้า Dashboard มี Summary Cards
9. หน้า Dashboard มี Chart แนวโน้มผู้ป่วย
10. หน้า Dashboard มี Chart รายอำเภอ
11. หน้า Dashboard แสดงกลุ่มสมาชิกทีม SAT
12. มีข้อมูลความครบถ้วนของการรายงาน
13. หน้า Records ใช้ข้อมูลและ Function เดิมได้
14. Permission ทำงานทั้ง Sidebar และ Server
15. Responsive สำหรับ Desktop และ Tablet
16. มี Loading, Error และ Empty State
17. ไม่มีการใช้ `any`
18. ไม่มี Mock Data ฝังอยู่ใน Component
19. ผ่าน TypeScript Type Check
20. ผ่าน ESLint และ Production Build
21. ไม่กระทบเมนูหรือ Route อื่นของระบบ

## 15. ขั้นตอนดำเนินงาน

ก่อนเขียนโค้ด ให้ดำเนินการตามลำดับ:

1. ตรวจสอบโครงสร้างโปรเจกต์
2. ค้นหา Sidebar หรือ Navigation Configuration เดิม
3. ตรวจสอบ Route Dashboard เดิม
4. ตรวจสอบ Route Records เดิม
5. ตรวจสอบระบบ Authentication และ Permission
6. ตรวจสอบ Component Chart และ Table ที่มีอยู่แล้ว
7. สรุปรายการไฟล์ที่จะสร้างหรือแก้ไข
8. ดำเนินการแก้ไขโดยใช้ของเดิมให้มากที่สุด
9. แสดง Folder Tree หลังแก้ไข
10. ตรวจสอบ Active Route และ Permission
11. รัน Type Check, Lint และ Build
12. สรุปผลการเปลี่ยนแปลงและข้อควรระวัง

ใช้คำสั่งตรวจสอบตาม Package Manager ของโปรเจกต์ เช่น:

```bash
pnpm type-check
pnpm lint
pnpm build
```

หรือ:

```bash
npm run type-check
npm run lint
npm run build
```

ห้ามลบ เปลี่ยนชื่อ หรือย้าย Route เดิมโดยไม่จำเป็น และห้ามเขียนทับ Business Logic เดิมของหน้า Dashboard และ Records โดยไม่ตรวจสอบผลกระทบก่อน
