# คู่มือนำการปรับปรุงความปลอดภัย (ก.ย. 2569) ขึ้นใช้งาน

เอกสารนี้อธิบายสิ่งที่เปลี่ยน สิ่งที่ต้องทำตอน deploy และงานที่ต้องทำนอกโค้ด
ให้ทำตามลำดับหัวข้อ "ขั้นตอน deploy"

## สิ่งที่เปลี่ยนในระบบ

| เรื่อง | ก่อน | หลัง |
|---|---|---|
| บัญชีจากสคริปต์นำเข้าคำสั่ง EOC | รหัสผ่าน `1234` ทุกบัญชี | รหัสชั่วคราวแบบสุ่มรายบัญชี + บังคับเปลี่ยนรหัสผ่าน |
| `must_change_password` | ส่งกลับตอน login แต่ไม่มีผลอะไร | API อื่นตอบ 403 `PASSWORD_CHANGE_REQUIRED` จนกว่าจะเปลี่ยนรหัสผ่าน หน้าเว็บพาไปหน้าตั้งค่ารหัสผ่านอัตโนมัติ |
| นโยบายรหัสผ่าน | ≥ 6 ตัว (เปลี่ยนรหัส), ≥ 8 ตัว (สมัคร) | ≥ 10 ตัว มีตัวอักษรและตัวเลข ไม่ใช่รหัสยอดนิยม ไม่มีชื่อผู้ใช้ (`lib/passwordPolicy.js`) |
| Session token ในฐานข้อมูล | เก็บ token จริง | เก็บ SHA-256 ของ token เท่านั้น |
| บัญชีเจ้าหน้าที่ที่ยังไม่อนุมัติ (ThaiD) | ได้ session และเรียก API ภายในได้ | ไม่ได้ session จนกว่าจะอนุมัติ |
| role ใน session | ใช้ค่าที่บันทึกตอน login | อ่านจากตาราง `officer` ทุกครั้ง ผู้ดูแลเปลี่ยน role/ยกเลิกอนุมัติแล้วมีผลทันที |
| ผู้ดูแลรีเซ็ตรหัสผ่านให้ผู้ใช้ | ใช้ต่อได้เลย | บังคับเปลี่ยนรหัสครั้งถัดไป และปิด session เดิมทั้งหมด |
| API ภายในที่เปิดโดยไม่ต้อง login | commander dashboard, vulnerable-groups stats, daily-flood, gistda ฯลฯ | ต้องเป็นเจ้าหน้าที่ที่เข้าสู่ระบบ |
| กิจกรรมล่าสุดใน `/api/dashboard/summary` | เปิดชื่อเจ้าหน้าที่ให้สาธารณะ | แสดงเฉพาะผู้ที่เข้าสู่ระบบ |
| พิกัดใน `/api/public/verified-incidents` | พิกัดจริงของผู้ขอความช่วยเหลือ | สาธารณะเห็นแบบประมาณ (~100 ม.) เจ้าหน้าที่เห็นพิกัดจริง |
| Rate limit | มีเฉพาะ login (ต่อบัญชี) และแชตบอตแบบ analytics (ในหน่วยความจำ) | เพิ่มต่อ IP สำหรับ login, แจ้งเหตุ, รายงานอุบัติเหตุ, สมัครสมาชิก, แชตบอตสาธารณะ, route advice — ตัวนับเก็บในฐานข้อมูล |
| IP ของผู้ใช้ | เชื่อ `X-Forwarded-For` ตัวซ้ายสุด (ปลอมได้) | เชื่อเฉพาะเมื่อตั้ง `TRUST_PROXY` (`lib/clientIp.js`) |
| Connection pool | 41 ไฟล์สร้าง pool ของตัวเอง (สูงสุด ~400 connection) | pool เดียวใน `lib/db.js` |
| แก้ schema ระหว่างรับ request | 7 route มี `CREATE/ALTER TABLE` | ย้ายไปใช้ migration + ตัวรัน `scripts/migrate.mjs` |
| หน้าเว็บภายใน | ป้องกันฝั่ง client อย่างเดียว | `proxy.js` redirect ไปหน้า login ถ้าไม่มี session cookie |

## ขั้นตอน deploy

1. **สำรองฐานข้อมูลก่อน**

   ```bash
   npm run backup:eoc -- --output /secure-backups/stn-eoc/pre-security-upgrade.backup --include-files
   npm run restore:test -- --input /secure-backups/stn-eoc/pre-security-upgrade.backup
   ```

2. **ตั้งค่า environment ใหม่** (ดู `.env.example`)
   - `TRUST_PROXY=1` ถ้าแอปอยู่หลัง nginx ชั้นเดียว และต้องให้ nginx ส่ง `X-Forwarded-For` / `X-Real-IP`
   - `SESSION_IDLE_MINUTES` (ไม่บังคับ ค่าเริ่มต้น 10 นาที)
   - เปลี่ยน `DB_USER` จาก `root` เป็น user เฉพาะแอป:

     ```sql
     CREATE USER 'stneoc_app'@'%' IDENTIFIED BY '<รหัสผ่านยาวแบบสุ่ม>';
     GRANT SELECT, INSERT, UPDATE, DELETE, EXECUTE ON stneoc.* TO 'stneoc_app'@'%';
     ```

     ส่วนการรัน migration ให้ใช้ user อีกตัวที่มีสิทธิ์ DDL

3. **เริ่มใช้ตัวรัน migration** (ทำครั้งเดียวบนฐานข้อมูลที่ใช้งานอยู่)

   ```bash
   npm run db:migrate:status
   # ฐานข้อมูลเดิมมี migration ถึง reconcile_eoc_team_registry.sql แล้ว
   npm run db:migrate:baseline -- --through reconcile_eoc_team_registry.sql
   npm run db:migrate          # รัน 20260930_security_hardening.sql
   ```

   migration นี้สร้างตาราง `rate_limit_hits` และปิด session เดิมทั้งหมด
   **ผู้ใช้ทุกคนจะต้องเข้าสู่ระบบใหม่หนึ่งครั้ง** เพราะ token แบบเดิมใช้ไม่ได้แล้ว

4. **Deploy โค้ดใหม่แล้ว restart แอป**

5. **รีเซ็ตบัญชีที่ใช้รหัสผ่านเดาง่าย**

   ```bash
   npm run security:weak-passwords -- --dry-run
   npm run security:weak-passwords -- --credentials-out ~/secure/eoc-temp-passwords.json
   ```

   สคริปต์จะตั้งรหัสชั่วคราวแบบสุ่ม บังคับเปลี่ยนรหัส และปิด session ของบัญชีที่ใช้รหัส `1234`, `123456`, `password` หรือรหัสเดียวกับชื่อผู้ใช้
   แจกรหัสชั่วคราวให้เจ้าของบัญชีทางช่องทางที่ปลอดภัย แล้วลบไฟล์ทิ้งเมื่อแจกครบ

## งานที่ต้องทำนอกโค้ด (โค้ดแก้แทนไม่ได้)

- [ ] **เปลี่ยน GitHub repository `Guy694/stn-eoc` เป็น private** (Settings → General → Danger Zone → Change visibility)
- [ ] **ลบข้อมูลที่ไม่ควรเผยแพร่ออกจากประวัติ git** ได้แก่ `prompter/ค่ำสั่ง eoc สตูล.pdf`, `prompter/ประชากร.csv` และรายชื่อบุคลากรในสคริปต์นำเข้า
  - ใช้ `git filter-repo` แล้ว force-push
  - ต้องตกลงกับทุกคนที่ clone repository ไว้ก่อน เพราะจะเปลี่ยนประวัติทั้งหมด
  - ถ้า repo เคยเป็น public ให้ถือว่าข้อมูลเหล่านั้นถูกเผยแพร่ไปแล้ว
- [ ] **หมุนเวียน (rotate) กุญแจ** ถ้าไม่แน่ใจว่าไฟล์ `.env` เคยหลุดไปที่ใดหรือไม่ ได้แก่ `GEMINI_API_KEY`, `TELEGRAM_BOT_TOKEN`, `GISTDA_API_KEY`, `CLIENT_SECRET`/`APIKEY` ของ ThaiD, `SECRET_KEY`
  - การเปลี่ยน `SECRET_KEY` ทำให้ `pid_hash` เดิมใช้จับคู่กับข้อมูลเดิมไม่ได้ ต้องวางแผนก่อน
- [ ] **ย้ายไฟล์ `backups/stn-eoc-db-backup.tar.gz` ออกจากโฟลเดอร์โปรเจกต์**
  - ไฟล์นี้เป็นสำเนาโฟลเดอร์ข้อมูล MySQL ที่ไม่เข้ารหัส รวม binlog และ `client-key.pem`
  - ให้เก็บแบบเข้ารหัสด้วย `npm run backup:eoc` แทน
- [ ] **ทบทวนการส่งชื่อ เบอร์โทร และพิกัดของผู้ขอความช่วยเหลือไป Telegram**
  - Telegram เป็นผู้ประมวลผลข้อมูลภายนอก ต้องระบุไว้ในนโยบายความเป็นส่วนตัว (PDPA)
  - พิจารณาส่งเฉพาะเลขรายการและลิงก์เข้าระบบแทน

## การย้อนกลับ (rollback)

- โค้ด: deploy เวอร์ชันก่อนหน้า
  - ผู้ใช้ต้อง login ใหม่อีกครั้ง เพราะ session ที่สร้างหลังอัปเกรดเก็บเป็น hash ซึ่งโค้ดเดิมอ่านไม่ได้
- ฐานข้อมูล: ตาราง `rate_limit_hits` และ `schema_migrations` ที่เพิ่มเข้ามาไม่กระทบโค้ดเดิม ไม่ต้องลบ
