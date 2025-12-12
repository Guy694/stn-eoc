# โครงสร้างโปรเจค STN-EOC

## ภาพรวม
โปรเจคถูกจัดระเบียบตามหน้าที่การทำงานเพื่อความง่ายในการพัฒนาและบำรุงรักษา

## โครงสร้างโฟลเดอร์

### 📁 app/
โฟลเดอร์หลักของ Next.js App Router

#### 📂 app/eoc/ - ระบบศูนย์อำนวยการ EOC
หน้าต่างๆ สำหรับแสดงข้อมูลภัยพิบัติและสถานการณ์ฉุกเฉิน

- **flood/** - แผนที่น้ำท่วม
  - `page.js` - หน้าแผนที่น้ำท่วมพร้อมข้อมูล GISTDA
  - `gistda.js` - หน้าแผนที่น้ำท่วมจาก GISTDA แบบเฉพาะ
  
- **drought/** - แผนที่ภัยแล้ง
  - `page.js` - หน้าแผนที่ภัยแล้ง
  
- **tsunami/** - แผนที่เตือนภัยสึนามิ
  - `page.js` - หน้าแผนที่สึนามิ (กำลังพัฒนา)
  
- **earthquake/** - แผนที่เตือนภัยแผ่นดินไหว
  - `page.js` - หน้าแผนที่แผ่นดินไหว (กำลังพัฒนา)
  
- **disease/** - แผนที่เฝ้าระวังโรคระบาด
  - `page.js` - หน้าแผนที่โรคระบาด (กำลังพัฒนา)
  
- **village-map/** - แผนที่หมู่บ้าน
  - `page.js` - หน้าแผนที่แสดงข้อมูลระดับหมู่บ้าน

#### 📂 app/admin/ - ระบบจัดการหลังบ้าน
หน้าต่างๆ สำหรับผู้ดูแลระบบ

- **dashboard/** - แดชบอร์ดหลัก
  - `page.js` - หน้าแดชบอร์ดสำหรับผู้ดูแล
  
- **flood-records/** - จัดการข้อมูลน้ำท่วม
  - `page.js` - CRUD สำหรับบันทึกพื้นที่น้ำท่วมแต่ละปี
  
- **officers/** - จัดการข้อมูลเจ้าหน้าที่
  - `page.js` - CRUD สำหรับจัดการข้อมูลเจ้าหน้าที่

#### 📂 app/user/ - ระบบผู้ใช้งาน
หน้าต่างๆ สำหรับผู้ใช้ทั่วไป

- **profile/** - โปรไฟล์ผู้ใช้
- **reports/** - รายงานของผู้ใช้

#### 📂 app/api/ - API Routes
แบ่งตามหมวดหมู่เพื่อความชัดเจน

##### 📁 api/eoc/ - API สำหรับข้อมูล EOC
- **flood/**
  - `daily-flood/` - API สำหรับข้อมูลน้ำท่วมรายวัน
  - `daily-flood-village/` - API สำหรับข้อมูลน้ำท่วมระดับหมู่บ้าน
  
- **gistda/**
  - `flood/` - API Proxy สำหรับข้อมูลน้ำท่วมจาก GISTDA
  - `flood-freq/` - API Proxy สำหรับข้อมูลน้ำท่วมซ้ำซาก

##### 📁 api/admin/ - API สำหรับจัดการหลังบ้าน
- **flood-records/** - CRUD API สำหรับบันทึกพื้นที่น้ำท่วม
- **officers/** - CRUD API สำหรับจัดการเจ้าหน้าที่

##### 📁 api/common/ - API สำหรับข้อมูลที่ใช้ร่วมกัน
- **village-polygons/** - API สำหรับข้อมูล polygon หมู่บ้าน
- **tambon-boundaries/** - API สำหรับข้อมูลเขตตำบล
- **health-facilities/** - API สำหรับข้อมูลสถานพยาบาล

#### 📂 app/public/ - หน้าสาธารณะ
- **disaster-map/** - แผนที่ภัยพิบัติสำหรับประชาชนทั่วไป

#### 📂 app/login/ - ระบบเข้าสู่ระบบ
- `page.js` - หน้า Login

### 📁 components/ - React Components
Components ที่ใช้ร่วมกันทั้งโปรเจค

- `DisasterMap.js` - Component แผนที่ภัยพิบัติ
- `HybridDisasterMap.js` - Component แผนที่แบบผสม
- `Navbar.js` - Navigation bar
- `Sidebar.js` - Sidebar สำหรับเมนู
- `Header.js` - Header component
- `Footer.js` - Footer component
- **layouts/**
  - `EOCLayout.js` - Layout สำหรับหน้า EOC
  - `PublicLayout.js` - Layout สำหรับหน้าสาธารณะ

### 📁 data/ - ข้อมูลสถิต
- `satunData.js` - ข้อมูลจังหวัดสตูล

## การเข้าถึงหน้าต่างๆ

### EOC (Emergency Operations Center)
- `/eoc/flood` - แผนที่น้ำท่วม
- `/eoc/drought` - แผนที่ภัยแล้ง
- `/eoc/tsunami` - แผนที่สึนามิ
- `/eoc/earthquake` - แผนที่แผ่นดินไหว
- `/eoc/disease` - แผนที่โรคระบาด
- `/eoc/village-map` - แผนที่หมู่บ้าน

### Admin (ผู้ดูแลระบบ)
- `/admin/dashboard` - แดชบอร์ดหลัก
- `/admin/flood-records` - จัดการข้อมูลน้ำท่วม
- `/admin/officers` - จัดการเจ้าหน้าที่

### Public (สาธารณะ)
- `/public/disaster-map` - แผนที่ภัยพิบัติ
- `/login` - เข้าสู่ระบบ

## API Endpoints

### EOC APIs
- `GET /api/eoc/flood/daily-flood` - ข้อมูลน้ำท่วมรายวัน
- `POST /api/eoc/flood/daily-flood/upload` - อัพโหลดข้อมูลน้ำท่วม
- `GET /api/eoc/flood/daily-flood-village` - ข้อมูลน้ำท่วมระดับหมู่บ้าน
- `GET /api/eoc/gistda/flood` - ข้อมูลน้ำท่วมจาก GISTDA
- `GET /api/eoc/gistda/flood-freq` - ข้อมูลน้ำท่วมซ้ำซาก

### Admin APIs
- `GET/POST/PUT/DELETE /api/admin/flood-records` - CRUD บันทึกน้ำท่วม
- `GET/POST/PUT/DELETE /api/admin/officers` - CRUD เจ้าหน้าที่

### Common APIs
- `GET /api/common/village-polygons` - ข้อมูล polygon หมู่บ้าน
- `GET /api/common/tambon-boundaries` - ข้อมูลเขตตำบล
- `GET /api/common/health-facilities` - ข้อมูลสถานพยาบาล

## การพัฒนาต่อยอด

### เพิ่มหน้าภัยพิบัติใหม่
1. สร้างโฟลเดอร์ใหม่ใน `app/eoc/[disaster-type]/`
2. สร้าง `page.js` สำหรับหน้าแผนที่
3. เพิ่ม menu item ใน `components/Navbar.js`

### เพิ่ม API Route ใหม่
1. สำหรับ EOC: `app/api/eoc/[category]/`
2. สำหรับ Admin: `app/api/admin/[resource]/`
3. สำหรับข้อมูลทั่วไป: `app/api/common/[resource]/`

### เพิ่มหน้าจัดการใหม่
1. สร้างโฟลเดอร์ใหม่ใน `app/admin/[module]/`
2. สร้าง API route ที่สอดคล้องใน `app/api/admin/[module]/`
3. เพิ่ม menu item ใน `components/Sidebar.js`

## หมายเหตุ
- ใช้ Next.js 16.0.7 (App Router)
- ใช้ Turbopack สำหรับ build
- API Routes อยู่ใน `app/api/` และถูกจัดกลุ่มตามหมวดหมู่
- หน้าต่างๆ ใช้ Client Component (`'use client'`) สำหรับ interactive features
