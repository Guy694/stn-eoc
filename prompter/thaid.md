# สรุปการสร้างระบบเข้าสู่ระบบด้วย ThaiID

เอกสารนี้สรุปการตั้งค่าและการทำงานของระบบเข้าสู่ระบบด้วย ThaiID ในโปรเจกต์นี้แบบย่อและใช้งานได้จริง

## เป้าหมาย

- ให้ผู้ใช้เข้าสู่ระบบด้วย ThaiID ผ่าน OAuth 2.0
- ผูกข้อมูลผู้ใช้ในระบบด้วยเลขบัตรประชาชน (PID)
- รองรับการใช้งานร่วมกับการล็อกอินแบบ username/password เดิม

## โครงสร้างที่เกี่ยวข้อง

- หน้าเข้าสู่ระบบ: `app/login/page.js`
- เริ่ม OAuth: `app/api/auth/thaiid/authorize/route.js`
- รับ callback: `app/api/auth/thaiid/callback/route.js`
- อ่าน session ผู้ใช้: `app/api/auth/session/route.js`
- หน้าแสดงผลหลัง callback: `app/auth/thaiid/callback/page.js`

## การเตรียมฐานข้อมูล

เพิ่มฟิลด์ในตารางผู้ใช้ (officer):

- `pid` (เลขบัตรประชาชน 13 หลัก)
- `thaiid_token`
- `last_login`

ตัวอย่างตรวจสอบฟิลด์:

```sql
DESCRIBE officer;
```

ตัวอย่างอัปเดต PID ให้ผู้ใช้:

```sql
UPDATE officer
SET pid = '1234567890123'
WHERE username = 'admin';
```

## Environment Variables ที่ต้องมี

ตั้งค่าใน `.env.local`:

```env
CALLBACK=http://localhost:3000/
APIKEY=your_thaiid_api_key
CLIENT_ID=your_thaiid_client_id
CLIENT_SECRET=your_thaiid_client_secret
```

หมายเหตุ:

- ค่า `CALLBACK` ต้องตรงกับที่ลงทะเบียนไว้กับ ThaiID
- Redirect callback ที่ระบบใช้คือ `/api/auth/thaiid/callback`

## ลำดับการทำงาน (Flow)

1. ผู้ใช้กดปุ่ม "เข้าสู่ระบบด้วย ThaiID"
2. ระบบ redirect ไป `/api/auth/thaiid/authorize`
3. ระบบพาไปหน้า ThaiID เพื่อยืนยันตัวตน
4. ThaiID ส่ง `code` กลับมาที่ `/api/auth/thaiid/callback`
5. ระบบแลก `code` เป็น access token
6. ระบบเรียก userinfo เพื่ออ่าน PID
7. ระบบค้นหา user จาก `officer.pid`
8. สร้าง session และ redirect เข้าสู่หน้าหลัก

## ทดสอบแบบเร็ว

1. ใส่ค่า `.env.local` ให้ครบ
2. อัปเดต PID ให้ผู้ใช้ทดสอบในฐานข้อมูล
3. รันระบบ:

```bash
npm run dev
```

4. เปิด `/login` แล้วกดปุ่ม ThaiID

## ปัญหาที่พบบ่อย

- `user_not_found`
	- สาเหตุ: PID จาก ThaiID ไม่ตรงกับข้อมูลในตาราง `officer`
	- วิธีแก้: อัปเดต `officer.pid` ให้ตรงกับเลขจริง

- `redirect_uri_mismatch`
	- สาเหตุ: CALLBACK ไม่ตรงกับที่ลงทะเบียน
	- วิธีแก้: แก้ค่า `CALLBACK` และตรวจสอบ path callback

- `token exchange failed` หรือ timeout
	- สาเหตุ: ค่า API key/client ไม่ถูกต้อง หรือเครือข่ายไป ThaiID มีปัญหา
	- วิธีแก้: ตรวจ env และตรวจการเชื่อมต่อเครือข่าย

## เช็กลิสต์ก่อนขึ้นระบบจริง

- ตั้ง CALLBACK เป็นโดเมน production ที่ลงทะเบียนจริง
- ใช้ HTTPS
- เก็บ CLIENT_SECRET ใน environment เท่านั้น
- ตรวจว่ามีผู้ใช้ที่กำหนด PID ครบ
- ทดสอบ login success/fail อย่างน้อย 1 รอบ

## สรุป

ระบบ ThaiID ในโปรเจกต์นี้พร้อมใช้งานเมื่อ:

- ตั้งค่า env ครบ
- ฐานข้อมูลมีฟิลด์ที่จำเป็น
- ผู้ใช้ถูกผูก PID อย่างถูกต้อง

จากนั้นผู้ใช้จะสามารถเข้าสู่ระบบด้วย ThaiID ได้ตาม OAuth flow มาตรฐาน
