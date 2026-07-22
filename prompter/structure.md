คุณเป็น Senior Software Architect และ Senior Next.js Developer ผู้เชี่ยวชาญด้าน Modular Architecture, Feature-based Architecture และการปรับโครงสร้างระบบขนาดใหญ่โดยไม่กระทบการทำงานเดิม

โปรเจกต์นี้เป็นระบบ Emergency Operations Center: EOC พัฒนาด้วย Next.js และใช้ JavaScript/JSX เป็นหลัก

ปัจจุบันโครงสร้างโฟลเดอร์ยังไม่เป็นมาตรฐาน มีไฟล์ Component, Page, Service, API และ Business Logic กระจายอยู่หลายตำแหน่ง และยังแยกไม่ชัดเจนระหว่าง:

* สิ่งที่ใช้ร่วมกันทั้งระบบ EOC
* สิ่งที่เป็นความสามารถกลางของแต่ละทีม
* สิ่งที่แตกต่างตามประเภท EOC
* สิ่งที่แตกต่างเฉพาะทีมภายในประเภท EOC
* เช็คก่อนว่ามีส่วนไหนที่สร้างไปแล้วบ้าง 

ระบบมีเจ้าหน้าที่ทั้งหมด 23 ทีม และในอนาคตจะมี EOC Type เพิ่มเติม เช่น:
ทีม คือ กลุ่มภารกิจ ที่มีในระบบอยู่แล้ว

* `dengue` — ไข้เลือดออก
* `flood` — อุทกภัย
* `storm` — วาตภัย
* `drought` — ภัยแล้ง
* `epidemic` — โรคระบาด
* `fire` — อัคคีภัย
* EOC Type อื่นที่เพิ่มในอนาคต

จงวิเคราะห์และปรับโครงสร้างโปรเจกต์ให้รองรับการเพิ่ม EOC Type และทีมใหม่ได้โดยไม่ต้องคัดลอกโค้ดจำนวนมาก

## 1. ข้อกำหนดด้านภาษา

ระบบปัจจุบันใช้ JavaScript และ JSX

ดังนั้น:

* ไฟล์ Component ให้ใช้ `.jsx`
* ไฟล์ Service, Config, Registry, Resolver และ Utility ให้ใช้ `.js`
* ห้ามบังคับเปลี่ยนทั้งระบบเป็น TypeScript หรือ TSX
* ห้ามเปลี่ยนนามสกุลไฟล์เดิมเป็น `.ts` หรือ `.tsx` โดยอัตโนมัติ
* สามารถออกแบบโครงสร้างให้รองรับการ Migration เป็น TypeScript ในอนาคตได้
* หากจำเป็นต้องกำหนดโครงสร้างข้อมูล ให้ใช้ JSDoc แทน TypeScript

ตัวอย่าง:

```js
/**
 * @typedef {"flood"|"dengue"|"storm"|"drought"|"epidemic"} EocType
 */

/**
 * @typedef {"sat"|"it"|"logistics"|"medical"} TeamCode
 */
```

## 2. แนวคิดสถาปัตยกรรม

ให้ใช้แนวคิด:

```text
EOC Shared Layer
        ↓
Base Team Modules
        ↓
EOC Type-specific Overrides
        ↓
Registry และ Resolver
        ↓
Dynamic Route
```

หลักการจัดตำแหน่งไฟล์:

```text
ใช้ร่วมกันทั้งระบบ EOC
→ features/eoc/shared

ใช้ร่วมกันทุก EOC Type ของทีมเดียว
→ features/eoc/teams/{teamCode}

ใช้ร่วมกันทุกทีมภายใน EOC Type เดียว
→ features/eoc/eoc-types/{eocType}/shared

ใช้เฉพาะ EOC Type และทีม
→ features/eoc/eoc-types/{eocType}/{teamCode}
```

## 3. โครงสร้างเป้าหมาย

```text
src/
├── app/
│   └── eoc/
│       └── [eocType]/
│           └── teams/
│               └── [teamCode]/
│                   ├── dashboard/
│                   │   ├── page.jsx
│                   │   ├── loading.jsx
│                   │   └── error.jsx
│                   ├── records/
│                   │   ├── page.jsx
│                   │   ├── create/
│                   │   │   └── page.jsx
│                   │   └── [recordId]/
│                   │       └── page.jsx
│                   └── members/
│                       └── page.jsx
│
├── features/
│   └── eoc/
│       ├── shared/
│       │   ├── components/
│       │   ├── charts/
│       │   ├── forms/
│       │   ├── tables/
│       │   ├── hooks/
│       │   ├── services/
│       │   ├── constants/
│       │   └── utils/
│       │
│       ├── teams/
│       │   ├── sat/
│       │   ├── it/
│       │   ├── logistics/
│       │   ├── medical/
│       │   └── เพิ่มจนครบ 23 ทีม
│       │
│       ├── eoc-types/
│       │   ├── flood/
│       │   ├── dengue/
│       │   ├── storm/
│       │   ├── drought/
│       │   ├── epidemic/
│       │   └── registry.js
│       │
│       ├── registries/
│       │   ├── team.registry.js
│       │   ├── eoc-type.registry.js
│       │   ├── dashboard.registry.js
│       │   ├── records.registry.js
│       │   └── navigation.registry.js
│       │
│       └── resolvers/
│           ├── team-module.resolver.js
│           ├── dashboard.resolver.js
│           ├── records.resolver.js
│           └── navigation.resolver.js
│
└── config/
    └── navigation/
        └── eoc-navigation.js
```

## 4. Base Team Module

แต่ละทีมให้มีโมดูลกลางที่:

```text
features/eoc/teams/{teamCode}
```

ตัวอย่างทีม SAT:

```text
features/eoc/teams/sat/
├── components/
│   ├── sat-dashboard-layout.jsx
│   ├── sat-dashboard-header.jsx
│   ├── sat-summary-card.jsx
│   ├── sat-member-list.jsx
│   ├── sat-report-table.jsx
│   ├── sat-filter-bar.jsx
│   └── sat-loading-skeleton.jsx
├── services/
│   └── sat.service.js
├── schemas/
│   └── sat.schema.js
├── permissions/
│   └── sat.permissions.js
├── constants/
│   └── sat.constants.js
├── config.js
└── index.js
```

ให้เก็บเฉพาะสิ่งที่ใช้เหมือนกันในทุก EOC Type เช่น:

* Layout ของทีม
* Header ของทีม
* สมาชิกทีม
* Permission
* ตารางพื้นฐาน
* Filter กลาง
* Loading State
* Empty State
* Service กลาง
* Navigation Configuration

ห้ามใส่ Metric หรือข้อมูลเฉพาะอุทกภัย ไข้เลือดออก หรือ EOC Type อื่นใน Base Team Module

## 5. EOC Type-specific Override

หากทีมมีข้อมูลแตกต่างตาม EOC Type ให้สร้างเฉพาะส่วนที่แตกต่างที่:

```text
features/eoc/eoc-types/{eocType}/{teamCode}
```

ตัวอย่างทีม SAT:

```text
features/eoc/eoc-types/
├── flood/
│   ├── shared/
│   └── sat/
│       ├── components/
│       │   ├── flood-sat-dashboard.jsx
│       │   ├── water-level-chart.jsx
│       │   ├── affected-area-chart.jsx
│       │   └── flood-sat-report-form.jsx
│       ├── config.js
│       ├── schema.js
│       ├── service.js
│       └── index.js
│
└── dengue/
    ├── shared/
    └── sat/
        ├── components/
        │   ├── dengue-sat-dashboard.jsx
        │   ├── weekly-case-chart.jsx
        │   ├── district-case-chart.jsx
        │   └── dengue-sat-report-form.jsx
        ├── config.js
        ├── schema.js
        ├── service.js
        └── index.js
```

EOC Type-specific Override ให้เก็บเฉพาะ:

* Metric เฉพาะ EOC Type
* Chart เฉพาะ EOC Type
* Form เฉพาะ EOC Type
* Validation เฉพาะ EOC Type
* Business Logic เฉพาะ EOC Type
* Workflow เฉพาะ EOC Type

ห้ามคัดลอก Base Team Module มาทั้งชุด

## 6. การเพิ่ม EOC Type ใหม่

การเพิ่ม EOC Type ใหม่ต้องทำได้โดย:

1. เพิ่มรายการใน `eoc-type.registry.js`
2. สร้างโฟลเดอร์ใหม่ใน `eoc-types/{eocType}`
3. สร้างเฉพาะ Team Override ที่แตกต่างจริง
4. ใช้ Team Base Module สำหรับทีมที่ข้อมูลเหมือนเดิม
5. ไม่ต้องสร้างโฟลเดอร์ครบทั้ง 23 ทีม

ตัวอย่างเพิ่ม EOC Type `storm`:

```text
features/eoc/eoc-types/storm/
├── shared/
├── sat/
└── logistics/
```

หากทีม IT ใช้ Dashboard และ Records เหมือนทุก EOC Type ไม่ต้องสร้าง:

```text
features/eoc/eoc-types/storm/it
```

ให้ Resolver ใช้:

```text
features/eoc/teams/it
```

## 7. EOC Type Registry

สร้าง Registry เช่น:

```js
export const EOC_TYPES = [
  "flood",
  "dengue",
  "storm",
  "drought",
  "epidemic",
];

export const eocTypeRegistry = {
  flood: {
    code: "flood",
    name: "อุทกภัย",
    enabled: true,
  },
  dengue: {
    code: "dengue",
    name: "ไข้เลือดออก",
    enabled: true,
  },
  storm: {
    code: "storm",
    name: "วาตภัย",
    enabled: true,
  },
};
```

ห้ามกระจายค่า EOC Type แบบ Hard-code ในหลาย Component

## 8. Team Registry

สร้าง Team Registry สำหรับ 23 ทีม:

```js
export const teamRegistry = {
  sat: {
    code: "sat",
    name: "ทีมตระหนักรู้สถานการณ์",
    shortName: "SAT",
    menus: [
      {
        key: "dashboard",
        label: "Dashboard",
      },
      {
        key: "records",
        label: "รายงานผล",
      },
    ],
  },

  it: {
    code: "it",
    name: "ทีมเทคโนโลยีสารสนเทศ",
    shortName: "IT",
    menus: [
      {
        key: "dashboard",
        label: "Dashboard",
      },
      {
        key: "records",
        label: "รายงานผล",
      },
      {
        key: "members",
        label: "สมาชิก",
      },
    ],
  },
};
```

Sidebar ต้องสร้างจาก Registry ไม่เขียนเมนูซ้ำ 23 ชุดใน JSX

## 9. Dashboard Registry

สร้าง Base Dashboard Registry:

```js
export const baseTeamDashboardRegistry = {
  sat: SatBaseDashboard,
  it: ItBaseDashboard,
  logistics: LogisticsBaseDashboard,
};
```

สร้าง EOC Type Override Registry:

```js
export const eocTypeTeamDashboardRegistry = {
  "flood:sat": FloodSatDashboard,
  "flood:logistics": FloodLogisticsDashboard,
  "dengue:sat": DengueSatDashboard,
  "dengue:medical": DengueMedicalDashboard,
};
```

## 10. Resolver

สร้าง Resolver ให้เลือกโมดูลตามลำดับ:

```text
ค้นหา EOC Type-specific Team Override
        ↓
ถ้าพบ ให้ใช้ Override
        ↓
ถ้าไม่พบ ให้ใช้ Base Team Module
```

ตัวอย่าง:

```js
export function resolveTeamDashboard(eocType, teamCode) {
  const overrideKey = `${eocType}:${teamCode}`;

  return (
    eocTypeTeamDashboardRegistry[overrideKey] ||
    baseTeamDashboardRegistry[teamCode] ||
    null
  );
}
```

ต้อง Validate ว่า `eocType` และ `teamCode` มีอยู่จริงก่อนเรียก Resolver

## 11. Dynamic Route

ห้ามสร้าง Route แยกครบ 23 ทีมและทุก EOC Type

ใช้ Dynamic Route:

```text
app/eoc/[eocType]/teams/[teamCode]/
├── dashboard/page.jsx
├── records/page.jsx
└── members/page.jsx
```

ตัวอย่าง URL:

```text
/eoc/flood/teams/sat/dashboard
/eoc/flood/teams/it/dashboard
/eoc/dengue/teams/sat/dashboard
/eoc/dengue/teams/medical/records
/eoc/storm/teams/logistics/dashboard
```

`page.jsx` ต้องมีหน้าที่เพียง:

1. ตรวจ Session
2. ตรวจ Permission
3. Validate `eocType`
4. Validate `teamCode`
5. เรียก Resolver
6. Render Component

ห้ามใส่ Business Logic ขนาดใหญ่ใน `page.jsx`

## 12. Route เดิม

ระบบมี Route เดิม เช่น:

```text
/stn-eoc/eoc/disease/dashboard
/stn-eoc/eoc/disease/records
```

ห้ามลบ Route เดิมทันที

ให้ Route เดิมเป็น Wrapper หรือ Compatibility Route เช่น:

```jsx
export default function DiseaseDashboardPage() {
  return (
    <TeamDashboardEntry
      eocType="dengue"
      teamCode="sat"
    />
  );
}
```

หรือทำ Redirect หลังจากตรวจสอบผลกระทบแล้ว

## 13. JavaScript Validation

เนื่องจากยังไม่ใช้ TypeScript ให้ใช้เครื่องมือดังนี้:

* Zod สำหรับ Runtime Validation
* JSDoc สำหรับ Type Hint
* ESLint สำหรับตรวจโค้ด
* PropTypes เฉพาะ Component ที่ยังไม่ใช้ Zod หรือ JSDoc
* หลีกเลี่ยง Object ที่ไม่มี Schema
* ห้ามเชื่อถือข้อมูลจาก Route, Search Params หรือ API โดยตรง

ตัวอย่าง:

```js
import { z } from "zod";

export const routeParamsSchema = z.object({
  eocType: z.string().min(1),
  teamCode: z.string().min(1),
});
```

## 14. Import Boundary

กำหนดกฎ:

```text
shared
→ ห้าม Import จาก teams หรือ eoc-types

teams
→ Import จาก shared ได้
→ ห้าม Import จาก eoc-types

eoc-types
→ Import จาก shared และ teams ได้

app
→ Import จาก features และ server ได้

server
→ ห้าม Import UI Component
```

Incident Override หรือ EOC Type Override เป็นฝ่ายดึง Base Team Component มาใช้ ไม่ให้ Base Team Import กลับเข้า EOC Type

## 15. Migration Plan

ห้ามจัดโครงสร้างใหม่ทั้งหมดในครั้งเดียว

แบ่งเป็น Phase:

### Phase 1: วิเคราะห์

* สร้าง Folder Tree ปัจจุบัน
* ตรวจ Route
* ตรวจ Import
* ตรวจ Component ซ้ำ
* ตรวจ Business Logic

### Phase 2: Shared Layer

* ย้าย Component ที่ใช้ร่วมกัน
* ย้าย Utility
* ย้าย Chart และ Table กลาง

### Phase 3: Base Team Module

เริ่มจาก:

1. ทีม SAT
2. ทีม IT
3. ทีมอื่นทีละทีม

### Phase 4: EOC Type Override

เริ่มจาก:

1. `dengue/sat`
2. `flood/sat`
3. ทีมที่แตกต่างจริง

### Phase 5: Registry และ Resolver

* Team Registry
* EOC Type Registry
* Dashboard Registry
* Records Registry
* Resolver

### Phase 6: Dynamic Route

* เพิ่ม Dynamic Route
* รักษา Route เดิม
* ทดสอบ Compatibility

### Phase 7: Cleanup

* ลบไฟล์ซ้ำหลังตรวจสอบ
* แก้ Import
* ลบ Dead Code
* ตรวจ Circular Dependency

## 16. สิ่งที่ต้องส่งมอบก่อนแก้ไข

ก่อนแก้ไขโค้ด ให้แสดง:

1. Current Folder Tree
2. ปัญหาโครงสร้างปัจจุบัน
3. Component หรือ Service ที่ซ้ำ
4. Route ที่ได้รับผลกระทบ
5. Proposed Folder Tree
6. Migration Mapping
7. Migration Plan
8. Risk และผลกระทบ

ห้ามเริ่มย้ายไฟล์จนกว่าจะวิเคราะห์ครบ

## 17. Acceptance Criteria

งานถือว่าเสร็จเมื่อ:

1. ระบบยังใช้ JSX และ JavaScript ได้ตามเดิม
2. ไม่มีการบังคับ Migration เป็น TypeScript
3. มี Shared EOC Layer
4. มี Base Team Module
5. มี EOC Type-specific Override
6. ไม่สร้างครบ `23 ทีม × ทุก EOC Type`
7. Sidebar สร้างจาก Registry
8. Dashboard เลือกผ่าน Resolver
9. Dynamic Route รองรับ EOC Type ใหม่
10. Route เดิมยังใช้งานได้
11. ไม่มี Import Path เสีย
12. ไม่มี Circular Dependency
13. ผ่าน ESLint
14. ผ่าน Production Build
15. เพิ่ม EOC Type ใหม่ได้โดยเพิ่ม Registry และ Override เฉพาะที่จำเป็น

## 18. ข้อห้าม

* ห้ามเปลี่ยน JSX เป็น TSX ในงานนี้
* ห้ามสร้าง Route ซ้ำครบทุกทีม
* ห้ามสร้างโฟลเดอร์ครบ 23 ทีมในทุก EOC Type
* ห้ามคัดลอก Dashboard หรือ Form ทั้งชุด
* ห้าม Hard-code EOC Type ใน Component
* ห้าม Hard-code Team Code ใน Sidebar
* ห้ามลบ Route เดิมทันที
* ห้ามย้ายไฟล์โดยไม่ตรวจ Dependency
* ห้ามเปลี่ยน UI โดยไม่เกี่ยวข้องกับการจัดโครงสร้าง
* ห้ามสรุปว่างานเสร็จหาก Build ยังไม่ผ่าน

เป้าหมายคือทำให้ระบบ JSX ปัจจุบันมีโครงสร้างที่ชัดเจน รองรับทีม 23 ทีม รองรับ EOC Type ใหม่ในอนาคต ลดโค้ดซ้ำ และสามารถ Migration แบบทีละส่วนภายหลังได้
