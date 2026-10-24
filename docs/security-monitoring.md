# เฝ้าระวังความปลอดภัยและระบบล่ม (ต.ค. 2569)

ทุกอย่างแจ้งเข้า **Telegram กลุ่มผู้ดูแลระบบ** (`TELEGRAM_SECURITY_CHAT_IDS`) ไม่เข้ากลุ่มเจ้าหน้าที่

| เรื่อง | ทำงานที่ไหน | ความถี่ |
|---|---|---|
| เข้าชม/เข้าใช้ผิดปกติ (ผู้เข้าชมพุ่ง, IP เดียวเข้าถี่, รหัสผิดจำนวนมาก, บัญชีเจ้าหน้าที่ถูกใช้จากต่างประเทศ) | ในแอป `lib/securityMonitorServer.js` | ทุก 10 นาที |
| สรุปความปลอดภัยรายสัปดาห์ | ในแอป | จันทร์ 08:00 น. (ตั้งได้) |
| ระบบล่ม / กลับมาใช้ได้ | container `watchdog` แยกจากแอป `scripts/uptime-watchdog.mjs` | ทุก 1 นาที |
| ช่องโหว่ไลบรารี | GitHub: Dependabot + `.github/workflows/security-audit.yml` | ทุกสัปดาห์ และเมื่อแก้ `package-lock.json` |

ดู/ทดสอบได้ที่ **ผู้เข้าชม › เฝ้าระวังและสรุปรายสัปดาห์** (ปุ่ม "ดูตัวอย่าง", "ส่งเข้า Telegram ตอนนี้", "ตรวจตอนนี้")

## ขั้นตอน deploy

1. `git pull`
2. migration ใหม่ `20261024_security_monitoring.sql`: `./scripts/docker-migrate.sh up`
3. `.env` บนเซิร์ฟเวอร์: ต้องมี `TELEGRAM_BOT_TOKEN` และ `TELEGRAM_SECURITY_CHAT_IDS` ส่วนเกณฑ์อื่นว่างไว้ได้ (ดู `.env.example` หัวข้อ "เฝ้าระวังความปลอดภัย")
4. `docker compose up -d --build stn-eoc-app`
5. เพิ่ม service watchdog ใน docker-compose.yml ของเซิร์ฟเวอร์ (วางระดับเดียวกับ `stn-eoc-app`):

   ```yaml
     stn-eoc-watchdog:
       image: node:22-bookworm-slim
       container_name: stn-eoc-watchdog
       restart: always
       depends_on:
         - stn-eoc-app
       environment:
         WATCHDOG_URL: http://stn-eoc-app:3000/stn-eoc/api/health/
         WATCHDOG_PUBLIC_URL: ${WATCHDOG_PUBLIC_URL:-}
         TELEGRAM_BOT_TOKEN: ${TELEGRAM_BOT_TOKEN}
         TELEGRAM_SECURITY_CHAT_IDS: ${TELEGRAM_SECURITY_CHAT_IDS}
         TZ: Asia/Bangkok
       volumes:
         - ./scripts/uptime-watchdog.mjs:/watchdog/uptime-watchdog.mjs:ro
       command: ["node", "/watchdog/uptime-watchdog.mjs"]
       networks:
         - stn-network
   ```

   `./scripts/...` อ้างจากโฟลเดอร์ของไฟล์ compose — ถ้า compose อยู่นอกโฟลเดอร์ stn-eoc ให้แก้ path ให้ชี้ไปที่ `stn-eoc/scripts/uptime-watchdog.mjs`
   ค่า `${TELEGRAM_...}` อ่านจาก `.env` ที่อยู่ข้างไฟล์ compose

   ```bash
   docker compose up -d stn-eoc-watchdog
   docker compose logs --tail=20 stn-eoc-watchdog   # ต้องเห็น "เริ่มเฝ้า ..." และกลุ่ม Telegram ได้ข้อความ 🟢 เริ่มเฝ้าระบบ
   docker compose exec stn-eoc-watchdog node /watchdog/uptime-watchdog.mjs --once   # ทดสอบครั้งเดียว
   ```

6. GitHub › Settings
   - Code security: เปิด Dependabot alerts และ Dependabot security updates
   - Secrets and variables › Actions: เพิ่ม `TELEGRAM_BOT_TOKEN`, `TELEGRAM_SECURITY_CHAT_IDS`
   - Actions › Security audit › Run workflow เพื่อทดสอบ

## ข้อจำกัด

- watchdog อยู่เครื่องเดียวกับแอป: ถ้าเครื่องทั้งเครื่องดับหรือเน็ตของเครื่องขาด จะแจ้งไม่ได้ — ถ้าต้องการครอบคลุมกรณีนี้ ใช้บริการตรวจจากภายนอกเพิ่ม (เช่น UptimeRobot) ชี้ไปที่ `WATCHDOG_PUBLIC_URL`
- "เจ้าหน้าที่เข้าจากต่างประเทศ" ต้องมีตำแหน่งจาก IP (`VISITOR_GEO_LOOKUP_URL` หรือ header GeoIP ของ nginx/Cloudflare) ไม่มีก็ไม่แจ้งเรื่องนี้
- ประวัติเปลี่ยนสิทธิ์เริ่มบันทึกหลังติดตั้งเวอร์ชันนี้
