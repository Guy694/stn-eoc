# 🚨 EOC (Emergency Operations Center) - ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล

ระบบบริหารจัดการภัยพิบัติและเหตุการณ์ฉุกเฉินสำหรับจังหวัดสตูล รองรับการจัดการหลายประเภทภัย พร้อมระบบยืนยันตัวตนด้วย **ThaiID**

## ✨ คุณสมบัติหลัก

### 🔐 Authentication & Authorization
- ✅ **Login แบบปกติ** (Username/Password)
- ✅ **Login ด้วย ThaiID** (OAuth 2.0 - DOPA) 🆕
- ✅ Role-Based Access Control (RBAC)
- ✅ Activity Logging

### 🌊 Disaster Management
- Flood (น้ำท่วม)
- Drought (ภัยแล้ง)
- Earthquake (แผ่นดินไหว)
- Tsunami (คลื่นยักษ์)
- Disease Outbreak (โรคระบาด)

### 🗺️ Interactive Maps
- แผนที่แบบ Polygon
- แผนที่แบบ Hybrid
- Village-level tracking
- Real-time updates

### 📊 Dashboard & Reports
- สถิติภัยพิบัติ
- รายงานสรุป EOC Sessions
- Activity Logs
- Role-based views

---

## 🚀 Quick Start

### 1. Installation

```bash
# Clone repository
git clone <repo-url>
cd stn-eoc

# Install dependencies
npm install

# Setup database
mysql -u root -p stneoc < stneoc.sql
mysql -u root -p stneoc < alter_officer_thaiid.sql

# Configure environment
cp .env.local.example .env.local
# แก้ไขค่าใน .env.local
```

### 2. Environment Variables

สร้างไฟล์ `.env.local`:

```env
# Database
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=
DB_NAME=stneoc

# Application
NEXT_PUBLIC_API_URL=http://localhost:3000

# ThaiID (DOPA) - NEW! 🆕
CALLBACK=http://localhost:3000/
APIKEY=your_apikey_here
CLIENT_ID=your_client_id_here
CLIENT_SECRET=your_client_secret_here

# GISTDA API
GISTDA_API_KEY=your_gistda_key_here
```

### 3. Run Development Server

```bash
npm run dev
```

เปิดเบราว์เซอร์: [http://localhost:3000](http://localhost:3000)

---

## 🆕 ThaiID Login - ใหม่!

ระบบรองรับการยืนยันตัวตนผ่าน **DOPA ThaiID** (กรมการปกครอง)

### 📚 เอกสารเกี่ยวกับ ThaiID:
- **[Quick Start Guide](./THAIID_QUICKSTART.md)** - เริ่มใช้งานใน 5 นาที
- **[คู่มือฉบับเต็ม](./THAIID_LOGIN_README.md)** - รายละเอียดครบถ้วน
- **[สรุปภาพรวม](./THAIID_SUMMARY.md)** - ภาพรวมระบบ

### การใช้งาน ThaiID:
1. คลิกปุ่ม "เข้าสู่ระบบด้วย ThaiID" บนหน้า login
2. ยืนยันตัวตนด้วยเลขบัตรประชาชนและ OTP
3. เข้าสู่ระบบอัตโนมัติ

### ข้อกำหนด:
- มีบัญชี ThaiID (ลงทะเบียนที่ https://imauth.bora.dopa.go.th)
- เลขบัตรประชาชนต้องลงทะเบียนในระบบ

---

## 📁 โครงสร้างโปรเจค

```
stn-eoc/
├── app/                          # Next.js App Router
│   ├── login/                    # หน้า Login (รองรับ ThaiID)
│   ├── dashboard/                # หน้าหลัก
│   ├── eoc/                      # หน้าจัดการภัยพิบัติ
│   ├── admin/                    # Admin pages
│   ├── auth/                     # Authentication pages
│   │   └── thaiid/               # ThaiID callback 🆕
│   └── api/                      # API Routes
│       ├── auth/                 # Authentication APIs
│       │   ├── login/            # Login ปกติ
│       │   ├── thaiid/           # ThaiID OAuth 🆕
│       │   └── session/          # Session management
│       └── eoc/                  # EOC APIs
├── components/                   # React Components
├── context/                      # React Context (Auth, EOC)
├── lib/                          # Utilities
├── public/                       # Static files
├── data/                         # Data files
└── *.sql                         # Database scripts

📄 ThaiID Documentation: 🆕
├── THAIID_QUICKSTART.md         # Quick Start
├── THAIID_LOGIN_README.md       # Full documentation
├── THAIID_SUMMARY.md            # Overview
├── alter_officer_thaiid.sql     # DB migration
└── insert_test_pid_thaiid.sql   # Test data
```

---

## 🔑 บัญชีทดสอบ (Development)

### Login แบบปกติ:
ให้ผู้ดูแลระบบสร้างบัญชีทดสอบเฉพาะ environment และส่งรหัสผ่านผ่านช่องทางภายในเท่านั้น

สำหรับ development สามารถ reset บัญชี `admin` ในฐานข้อมูล local ได้ด้วยคำสั่งนี้:

```bash
ADMIN_PASSWORD="<temporary-password>" npm run reset-dev-admin
```

### Login ด้วย ThaiID:
ต้องอัพเดตเลขบัตรประชาชน (PID) ในฐานข้อมูลก่อนใช้งาน
```sql
UPDATE officer SET pid = 'xxxxxxxxxxxxx' WHERE username = 'admin';
```

---

## 🛠️ Tech Stack

### Frontend:
- **Next.js 14** (App Router)
- **React 18**
- **Tailwind CSS**
- **Leaflet** (Maps)

### Backend:
- **Next.js API Routes**
- **MySQL**
- **bcryptjs** (Password hashing)

### Authentication:
- **Custom Auth System**
- **ThaiID OAuth 2.0** 🆕
- **RBAC** (Role-Based Access Control)

### External APIs:
- **DOPA ThaiID API** 🆕
- **GISTDA API**

---

## 📖 Additional Documentation

- [STRUCTURE.md](./STRUCTURE.md) - โครงสร้างโปรเจค
- [RBAC_README.md](./RBAC_README.md) - ระบบจัดการสิทธิ์
- [MODULAR_ARCHITECTURE_README.md](./MODULAR_ARCHITECTURE_README.md) - สถาปัตยกรรม
- [DAILY_FLOOD_MAP_README.md](./DAILY_FLOOD_MAP_README.md) - แผนที่น้ำท่วม
- [HYBRID_MAP_README.md](./HYBRID_MAP_README.md) - แผนที่แบบ Hybrid
- [POLYGON_MAP_README.md](./POLYGON_MAP_README.md) - แผนที่แบบ Polygon
- [FLOOD_HISTORICAL_DATA_README.md](./FLOOD_HISTORICAL_DATA_README.md) - ข้อมูลประวัติ

---

## 🧪 การทดสอบ

```bash
# ทดสอบ Login ปกติ
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"your_username","password":"your_password"}'

# ทดสอบ ThaiID OAuth
curl -I http://localhost:3000/api/auth/thaiid/authorize
# ควรได้ HTTP 307 (Redirect)

# ตรวจสอบ Session
curl http://localhost:3000/api/auth/session
```

---

## 🚀 Deployment

### Vercel (แนะนำ)

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

### Environment Variables (Production)
อย่าลืมตั้งค่า environment variables ใน Vercel Dashboard:
- Database credentials
- ThaiID credentials (CALLBACK, APIKEY, CLIENT_ID, CLIENT_SECRET)
- GISTDA API key

### Docker / Server

ถ้ารันบน Docker หรือ server หลัง nginx ให้แน่ใจว่า:

- แอป Next.js ถูก proxy ผ่าน base path `/stn-eoc`
- โฟลเดอร์ uploads ถูก mount ออกมาจาก container แบบถาวร
- nginx ส่ง request ของ `/stn-eoc/uploads/...` ไปยัง container ของแอป ไม่ใช่ตัด base path ทิ้ง

ตัวอย่าง nginx:

```nginx
location /stn-eoc/ {
    proxy_pass http://stn-eoc-app:3000;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

ตัวอย่าง Docker volume สำหรับ uploads:

```yaml
services:
  stn-eoc-app:
    environment:
      - UPLOAD_DIR=/app/public/uploads
    volumes:
      - uploads_data:/app/public/uploads

volumes:
  uploads_data:
```

หากไฟล์รูปเก่าถูกอัปโหลดไว้ก่อนมี volume ให้ copy ไฟล์เดิมเข้า volume ใหม่ด้วย ไม่เช่นนั้นฐานข้อมูลจะมี `image_path` แต่ server จะหาไฟล์ไม่เจอ

---

## 🔒 Security

### Best Practices:
- ✅ HTTPS only ใน production
- ✅ Environment variables สำหรับ sensitive data
- ✅ Password hashing ด้วย bcrypt
- ✅ SQL injection protection
- ✅ CSRF protection (state parameter)
- ✅ httpOnly cookies
- ✅ Activity logging
- ✅ Role-based access control

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

---

## 📞 Support

หากพบปัญหาหรือต้องการความช่วยเหลือ:

1. ตรวจสอบเอกสารประกอบ
2. ดู console logs และ error messages
3. ตรวจสอบ database schema
4. อ่าน Troubleshooting section ในเอกสาร

### ThaiID Support:
- [THAIID_QUICKSTART.md](./THAIID_QUICKSTART.md)
- [DOPA Documentation](https://docs.bora.dopa.go.th/)

---

## 📄 License

Copyright © 2025 ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข - All Rights Reserved

---

## 🎉 What's New

### Version 1.1.0 (December 2025) 🆕
- ✅ เพิ่มระบบ Login ด้วย ThaiID (DOPA OAuth 2.0)
- ✅ รองรับยืนยันตัวตนด้วยเลขบัตรประชาชน
- ✅ เพิ่ม Activity Logging สำหรับ ThaiID
- ✅ อัพเดต Database Schema รองรับ ThaiID
- ✅ เพิ่มเอกสารครบชุดสำหรับ ThaiID
- ✅ UI/UX ปรับปรุงหน้า Login

### Version 1.0.0 (2025)
- ✅ ระบบจัดการภัยพิบัติหลายประเภท
- ✅ Interactive maps
- ✅ RBAC system
- ✅ Dashboard และรายงาน

---

**สร้างด้วย ❤️ สำหรับ ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข**
