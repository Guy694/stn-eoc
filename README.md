# STN-EOC — ระบบศูนย์ปฏิบัติการภาวะฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล

เว็บแอปสำหรับบริหารการเปิด EOC, ทีมภารกิจ 23 กลุ่ม, รายงานประจำวัน และข้อมูลภัย (น้ำท่วม, โรคระบาด/ไข้เลือดออก, อุบัติเหตุช่วงเทศกาล)
มีหน้าสาธารณะสำหรับประชาชน และเข้าสู่ระบบด้วย ThaiD (DOPA) ได้

## ภาพรวม

| ส่วน | รายละเอียด |
|---|---|
| Framework | Next.js 16 (App Router, `output: standalone`, `basePath: /stn-eoc`), React 19, Tailwind CSS 4 |
| Backend | Next.js Route Handlers ใน `app/api/**` ใช้ MySQL 8 ผ่าน `mysql2` (pool เดียวใน `lib/db.js`) |
| Auth | Session cookie `session_token` (httpOnly, SameSite=Strict), ฐานข้อมูลเก็บเฉพาะ SHA-256 ของ token, ThaiD OAuth สำหรับเจ้าหน้าที่/ประชาชน |
| แผนที่ | Leaflet + GeoJSON ขอบเขตอำเภอ/ตำบล/หมู่บ้าน |
| ภายนอก | ThaiD, GISTDA, Gemini (แชตบอต), Telegram (แจ้งเตือน), Open-Meteo, OSRM |

### ผู้ใช้

- **ประชาชน**: ดูแผนที่ภัย ศูนย์พักพิง ประกาศ และแจ้งขอความช่วยเหลือ (`/public/*`)
- **เจ้าหน้าที่ทีมภารกิจ**: บันทึกข้อมูลปฏิบัติการ และส่งรายงานทีมตาม session (`/eoc/*`)
- **ผู้บัญชาการ**: ดู dashboard ตรวจ/อนุมัติรายงาน และติดตามภารกิจ (`/commander/*`)
- **ผู้ดูแลระบบ**: จัดการผู้ใช้ ข้อมูลหลัก และคุณภาพข้อมูล (`/admin/*`)

แกนข้อมูลของระบบคือ `eoc_sessions → eoc_session_teams → eoc_team_members → eoc_team_reports`
รายละเอียดอยู่ใน [docs/eoc-architecture.md](docs/eoc-architecture.md)

## เริ่มต้นพัฒนา

```bash
npm ci
cp .env.example .env            # แล้วใส่ค่าจริง
docker compose up -d db         # หรือใช้ MySQL 8 ของตัวเอง
mysql -u root -p stneoc < <ไฟล์ schema ตั้งต้นที่ได้รับจากผู้ดูแล>
npm run db:migrate              # รัน migration ตามลำดับใน migrations/manifest.json
ADMIN_PASSWORD='<รหัสผ่านอย่างน้อย 10 ตัว>' npm run reset-dev-admin
npm run dev                     # http://localhost:3000/stn-eoc
```

ห้าม commit ไฟล์ต่อไปนี้ (มีข้อมูลส่วนบุคคลหรือ secret): `.env`, `database/`, `backups/` และไฟล์ dump/backup ทุกชนิด
`.gitignore` และ CI จะช่วยกันไว้อีกชั้น

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `npm run dev` / `npm run build` / `npm start` | พัฒนา / build / รัน production |
| `npm test` | unit test + guardrail test (เช่น ห้ามสร้าง DB pool เอง ห้ามแก้ schema ระหว่าง request) |
| `npm run lint` | ESLint |
| `npm run db:migrate:status` | ดูว่า migration ไหนรันแล้ว |
| `npm run db:migrate` | รัน migration ที่ยังไม่รัน |
| `npm run db:migrate:baseline -- --through <ไฟล์>` | บันทึกว่าฐานข้อมูลเดิมมี migration ถึงไฟล์ที่ระบุแล้ว (ทำครั้งแรกครั้งเดียว) |
| `npm run backup:eoc` / `npm run restore:test` | สำรองแบบเข้ารหัส / ทดสอบกู้คืน ([docs/backup-recovery.md](docs/backup-recovery.md)) |
| `npm run security:weak-passwords` | ค้นหาและรีเซ็ตบัญชีที่ใช้รหัสผ่านเดาง่าย |
| `npm run pdpa:retention` | ดูว่าคำขอจากประชาชนที่ปิดเรื่องเกิน `PDPA_RETENTION_DAYS` วันมีกี่เรื่อง · ใส่ `-- --apply` เพื่อลบชื่อ/เบอร์/รูปจริง (ตั้ง cron ตามรอบที่ตกลงกับผู้รับผิดชอบข้อมูล) |
| `npm run test-data:cleanup` | ดู/ลบข้อมูลจำลองที่ติดป้าย [ทดสอบ] (`-- --apply` เพื่อลบจริง) — ทำก่อนเปิดใช้งานจริง |
| `npm run test:e2e` | เทสต์เปิดเบราว์เซอร์จริง (หน้าสาธารณะ, สิทธิ์เข้าหลังบ้าน, หน้าเจ้าหน้าที่) บนจอคอมและมือถือ — ติดตั้งครั้งแรกด้วย `npm i -D @playwright/test && npx playwright install chromium`; ชุดที่ต้องล็อกอินใช้บัญชีทดสอบจาก `E2E_USERNAME` / `E2E_PASSWORD` |

## กติกาสำหรับนักพัฒนา

- **ฐานข้อมูล**
  - ใช้ `query` / `transaction` / `getPool` จาก `@/lib/db` เท่านั้น ห้ามเรียก `mysql.createPool()` เอง
- **Schema**
  - แก้โครงสร้างฐานข้อมูลได้ทาง migration เท่านั้น
  - สร้างไฟล์ใหม่ใน `migrations/` แล้วต่อท้ายชื่อไฟล์ใน `migrations/manifest.json`
  - ห้ามแก้ไฟล์ migration ที่รันไปแล้ว
- **สิทธิ์**
  - ทุก API ที่ไม่ใช่ข้อมูลสาธารณะต้องเรียก `requireAuth(request, roles)` จาก `@/lib/auth`
  - ตาราง role และสิทธิ์มีที่เดียวคือ `lib/auth.js`
- **IP ผู้ใช้**
  - ใช้ `getClientIp()` จาก `@/lib/clientIp` เท่านั้น
- **Endpoint สาธารณะที่รับข้อมูล**
  - ต้องมี rate limit ผ่าน `enforceIpRateLimit()` จาก `@/lib/rateLimit`
- **ข้อมูลส่วนบุคคล**
  - ห้ามส่งชื่อ เลขบัตร เบอร์โทร หรือพิกัดบ้านออกทาง API สาธารณะ
  - ถ้าจำเป็นต้องแสดงพิกัด ให้ใช้ `coarsenLocation()` จาก `@/lib/privacy`
- **รหัสผ่าน**
  - ใช้ `validatePassword()` จาก `@/lib/passwordPolicy` ทั้งฝั่ง server และหน้าเว็บ
  - รหัสผ่านที่ผู้ดูแลตั้งให้ถือเป็นรหัสชั่วคราวเสมอ (`must_change_password = 1`)

## Deploy

ระบบออกแบบให้รันแบบ standalone หลัง nginx ที่ path `/stn-eoc`
ไม่รองรับ Vercel เพราะเก็บไฟล์อัปโหลดลงดิสก์

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

- ตั้ง `TRUST_PROXY=1` เมื่ออยู่หลัง nginx ชั้นเดียว
- mount โฟลเดอร์อัปโหลด (`UPLOAD_DIR`) เป็น volume ถาวร
รายการตรวจบนเซิร์ฟเวอร์ก่อนเปิดใช้จริง: [docs/production-server-checklist.md](docs/production-server-checklist.md)

### Deploy ด้วย Docker

```bash
cp .env.example .env              # ใส่ค่าจริง: DB_PASSWORD, MYSQL_ROOT_PASSWORD, SECRET_KEY, VULNERABLE_DATA_KEY, APP_URL=https://...
docker compose up -d --build      # MySQL (ผู้ใช้ stneoc_app ไม่ใช่ root) + แอปที่ 127.0.0.1:3001
docker compose exec app node scripts/migrate.mjs up
```

- nginx บนเครื่องเดียวกันใช้ `proxy_pass http://127.0.0.1:3001;` (พอร์ต MySQL และแอปเปิดเฉพาะ 127.0.0.1)
- `.dockerignore` กัน `.env`, `database/`, `backups/` และไฟล์ dump ไม่ให้เข้า image
- รันแอปแค่ 1 container (งานเบื้องหลังมีล็อกกันทำงานซ้อน แต่ 1 container จัดการง่ายที่สุด)
- ตอนเริ่มเซิร์ฟเวอร์ ถ้าตั้งค่าสำคัญไม่ครบ (TRUST_PROXY, APP_URL https, SECRET_KEY, DB_USER=root) จะมีคำเตือน `[config]` ใน log
- `1docker-compose.yml` เป็นไฟล์รวมหลายระบบของเซิร์ฟเวอร์เดิม (ใช้ root และเปิดพอร์ต MySQL) — ให้ใช้ `docker-compose.yml` นี้แทนสำหรับ Satun Geo-EOC

- การอัปเกรดครั้งล่าสุด (ก.ย. 2569) มีขั้นตอนเฉพาะ ดู [docs/security-upgrade-2026-09.md](docs/security-upgrade-2026-09.md)

## เอกสารเพิ่มเติม

- [docs/eoc-architecture.md](docs/eoc-architecture.md) — แหล่งข้อมูลหลัก สิทธิ์ และ route มาตรฐาน
- [docs/backup-recovery.md](docs/backup-recovery.md) — สำรองและกู้คืนข้อมูล
- [docs/security-upgrade-2026-09.md](docs/security-upgrade-2026-09.md) — การปรับปรุงความปลอดภัยและงานที่ต้องทำนอกโค้ด
- [docs/EOC_CONTINUATION_DEPLOYMENT.md](docs/EOC_CONTINUATION_DEPLOYMENT.md)

---

Copyright © 2025–2026 ศูนย์ปฏิบัติการภาวะฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล — All Rights Reserved
