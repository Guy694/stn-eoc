# สิ่งที่ต้องทำบนเซิร์ฟเวอร์ก่อนเปิดใช้งานจริง

บันทึกเมื่อ 13 ต.ค. 2569 — งานที่ทำในโค้ดไม่ได้ ต้องทำบนเซิร์ฟเวอร์หรือเครื่องที่มีอินเทอร์เน็ต
ติ๊ก `[x]` เมื่อทำเสร็จ · ขั้นตอน Docker ดูใน README หัวข้อ Deploy

## 1. ก่อน build (บนเครื่องที่มีอินเทอร์เน็ต)

- [ ] `npm audit --omit=dev` แล้วแก้รายการระดับ high/critical
- [ ] อัปเดต React เป็น 19.2 รุ่นล่าสุด: `npm i react@19 react-dom@19`
- [ ] ลบ dependency ที่ไม่ใช้: `npm uninstall impeccable` และย้าย shadcn ไป dev: `npm i -D shadcn`
- [ ] `npm test` และ `npm run build` ผ่าน แล้ว commit `package.json` + `package-lock.json`

## 2. ตั้งค่า `.env` ของ production

- [ ] `NODE_ENV=production`
- [ ] `APP_URL=https://<โดเมนจริง>` (ต้องเป็น https ระบบจึงเปิด HSTS)
- [ ] `SECRET_KEY` สุ่มใหม่ อย่างน้อย 32 ตัวอักษร (`openssl rand -hex 32`)
- [ ] `VULNERABLE_DATA_KEY` และ `BACKUP_ENCRYPTION_KEY` สุ่มใหม่ — **เก็บสำเนาไว้นอกเครื่อง ห้ามเปลี่ยน/ห้ามหายหลังมีข้อมูล** ไม่งั้นถอดรหัสข้อมูลกลุ่มเปราะบางและไฟล์สำรองไม่ได้
- [ ] `DB_USER=stneoc_app` (ไม่ใช่ root) + `DB_PASSWORD` ใหม่ · `MYSQL_ROOT_PASSWORD` (ถ้าใช้ docker compose)
- [ ] `TRUST_PROXY=1` (อยู่หลัง nginx ชั้นเดียว)
- [ ] หากต้องการบล็อกผู้เข้าชมต่างประเทศ: ตั้ง `BLOCK_FOREIGN_COUNTRIES=1` และให้ Cloudflare เป็นทางเข้าทุกคำขอ พร้อมจำกัด firewall ของ origin ให้รับเฉพาะ IP ของ Cloudflare (ถ้าไม่มี `CF-IPCountry` คำขอจะถูกปฏิเสธ)
- [ ] VAPID (`npm run push:vapid`), ThaiD, Telegram, GISTDA, Gemini ตามที่ใช้
- [ ] `ALERT_CRON_SECRET` ถ้าใช้ตัวตั้งเวลาภายนอกเรียกแจ้งเตือน
- [ ] `PDPA_RETENTION_DAYS` ตามที่ตกลงกับผู้รับผิดชอบข้อมูล (ค่าเริ่มต้น 365)
- [ ] `ROUTING_URL` ถ้าติดตั้ง OSRM เอง (ไม่ตั้ง = ใช้เซิร์ฟเวอร์สาธิตของ OSRM ซึ่งไม่รับประกันการใช้งานจริง)
- [ ] ไฟล์ `.env` สิทธิ์ `chmod 600` เจ้าของคือผู้ใช้ที่รันแอป

## 3. ฐานข้อมูล

- [ ] สร้างผู้ใช้เฉพาะแอป (ถ้าไม่ใช้ docker compose ใหม่):
      `CREATE USER 'stneoc_app'@'%' IDENTIFIED BY '...'; GRANT ALL ON stneoc.* TO 'stneoc_app'@'%';`
- [ ] MySQL ไม่เปิดพอร์ต 3306 สู่ภายนอก (bind 127.0.0.1 หรืออยู่ในเครือข่าย docker เท่านั้น) และ firewall ปิด 3306
- [ ] migrate ฐานข้อมูล: `./scripts/docker-migrate.sh up` (สำรองให้อัตโนมัติ) · ตรวจ `./scripts/docker-migrate.sh status` ไม่มีค้าง — ขั้นตอนเต็มดู [docs/database-migration.md](database-migration.md)
- [ ] ลบข้อมูลทดสอบ: `npm run test-data:cleanup` (ดูก่อน) → `-- --apply`
- [ ] เปลี่ยนรหัสผ่านบัญชีทดสอบ/บัญชีตั้งต้น และรัน `npm run security:weak-passwords`

## 4. เครื่องและเครือข่าย

- [ ] nginx + HTTPS (ใบรับรองต่ออายุอัตโนมัติ) ตาม README: ส่ง `X-Real-IP $remote_addr` และ `X-Forwarded-For`
- [ ] `client_max_body_size 12m;` (รูปแจ้งเหตุ 10 MB, ไฟล์นำเข้า Excel 5 MB)
- [ ] พอร์ตแอป (3000/3001) เปิดเฉพาะ 127.0.0.1 — เข้าได้ทาง nginx เท่านั้น
- [ ] รันแอปแค่ 1 instance (PM2 แบบ fork ไม่ใช่ cluster หรือ 1 container) — งานเบื้องหลังมีล็อกกันซ้อนแล้ว แต่ 1 ตัวจัดการง่ายที่สุด
- [ ] ตั้งเวลาเครื่องเป็น Asia/Bangkok
- [ ] ถ้ายังใช้ `1docker-compose.yml` (ไฟล์รวมหลายระบบ): ย่อหน้าของ `stn-eoc-app`, `stn-tree-app`, `stn-atacs-app` ผิด docker compose จะไม่อ่านเป็น service, ทุกแอปใช้ MySQL root และเปิดพอร์ต MySQL ทุก interface — แก้ไฟล์นั้น หรือใช้ `docker-compose.yml` ของระบบนี้แทน

## 5. งานตั้งเวลา (cron)

- [ ] สำรองข้อมูลทุกวัน: `npm run backup:eoc -- --output /secure-backups/stn-eoc/eoc-$(date +\%F).backup --include-files` แล้วคัดลอกออกนอกเครื่อง (ดู docs/backup-recovery.md)
- [ ] **โฟลเดอร์ `private/uploads` (รูปที่ประชาชนแนบมากับคำขอช่วยเหลือ) ไม่อยู่ในไฟล์สำรองของ `backup:eoc`** (สคริปต์เก็บเฉพาะ `public/uploads`) — สำรองโฟลเดอร์/volume นี้แยก หรือแจ้งให้แก้สคริปต์ก่อน
- [ ] ทดสอบกู้คืน `npm run restore:test` อย่างน้อย 1 ครั้งก่อนเปิดใช้ และทุกเดือน
- [ ] PDPA: `npm run pdpa:retention -- --apply` ตามรอบที่ตกลง (เช่น ทุกเดือน) — session หมดอายุถูกลบอัตโนมัติวันละครั้งแล้ว

## 6. หลัง deploy

- [ ] log ตอนเริ่มเซิร์ฟเวอร์ไม่มีคำเตือน `[config]`
- [ ] `https://<โดเมน>/stn-eoc/api/health/` ตอบ `healthy` และตั้ง uptime monitor เรียกทุก 1 นาที
- [ ] เปิดหน้าสาธารณะ แผนที่ รายงานระดับน้ำ และ login เจ้าหน้าที่ได้
- [ ] แผนที่ประชาชน (ไม่ login) ไม่แสดงหมายเหตุรายงานโรคหรือพิกัดบ้าน
- [ ] มอบหมายเจ้าหน้าที่เข้ากล่องภารกิจในเหตุการณ์ (เช่น SAT) — ไม่งั้นประกาศธง/บันทึกข้อมูลไม่ได้
- [ ] ทดสอบส่ง Telegram/Push จริงหนึ่งครั้งกับกลุ่มทดสอบ (ไม่ใช่กลุ่มจริง)
