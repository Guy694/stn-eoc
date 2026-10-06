# ทดสอบแบบเปิดเบราว์เซอร์จริง (e2e)

ชุดนี้เปิดหน้าเว็บจริงด้วย Playwright แล้วตรวจว่าหน้าไม่พัง ลิงก์เก่าพาไปหน้าใหม่ถูก และ API หลังบ้านปฏิเสธเมื่อไม่ได้ล็อกอิน

## ติดตั้งครั้งแรก (บนเครื่องที่รันระบบได้)

```bash
npm run test:e2e:setup
```

คำสั่งนี้เพิ่ม `@playwright/test` ลง devDependencies และดาวน์โหลด Chromium — commit `package.json` กับ `package-lock.json` ที่เปลี่ยนด้วย

## รัน

```bash
# ชุดที่ไม่ต้องล็อกอิน (หน้าเว็บประชาชน, การป้องกันหลังบ้าน)
npm run test:e2e

# รวมชุดเจ้าหน้าที่ — ใช้บัญชีทดสอบเท่านั้น ห้ามใช้บัญชีจริงของผู้ดูแลระบบ
E2E_USERNAME=e2e_tester E2E_PASSWORD='...' npm run test:e2e

# รันกับเซิร์ฟเวอร์ที่เปิดอยู่แล้ว (เช่น staging) แทนการเปิด dev server เอง
E2E_BASE_URL=https://staging.example.go.th npm run test:e2e
```

ผลแบบละเอียด (ภาพหน้าจอ/trace เมื่อเทสต์ล้ม) อยู่ใน `playwright-report/` เปิดด้วย `npx playwright show-report`

## รันบน GitHub

workflow **E2E (manual)** กดรันเองได้จากแท็บ Actions เมื่อมีเซิร์ฟเวอร์ทดสอบที่เข้าถึงจากอินเทอร์เน็ตได้
ตั้งค่า secrets: `E2E_BASE_URL`, `E2E_USERNAME`, `E2E_PASSWORD` (บัญชีทดสอบ)

CI ปกติ (`ci.yml`) ไม่รัน e2e เพราะต้องมีฐานข้อมูลจริง ซึ่งไม่ได้เก็บไว้ใน repository
