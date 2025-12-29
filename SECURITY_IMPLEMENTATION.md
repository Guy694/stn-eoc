# 🔐 ระบบความปลอดภัย - Security Implementation

**วันที่อัพเดท**: 29 ธันวาคม 2025  
**สถานะ**: ✅ พร้อมใช้งาน

---

## 📋 สรุปการปรับปรุง

### 1. ✅ **Session Management ที่ปลอดภัย**
- บันทึก session ในฐานข้อมูล (ไม่ใช่แค่ localStorage)
- มีเวลาหมดอายุ (24 ชั่วโมง)
- ตรวจสอบ IP address และ User Agent
- ลบ session อัตโนมัติเมื่อหมดอายุ

### 2. ✅ **ป้องกัน Brute Force Attack**
- จำกัดการพยายาม login: **5 ครั้ง/15 นาที**
- ล็อคบัญชีอัตโนมัติหลัง 5 ครั้ง: **ล็อค 30 นาที**
- ตรวจสอบทั้ง username และ IP address

### 3. ✅ **Security Logging**
- บันทึกทุกเหตุการณ์สำคัญ
- แยกระดับความรุนแรง (low, medium, high, critical)
- ตรวจจับกิจกรรมผิดปกติ

### 4. ✅ **Account Security**
- ตรวจสอบบัญชีถูกล็อค
- เตรียมพร้อมสำหรับ 2FA
- บังคับเปลี่ยนรหัสผ่าน

### 5. ✅ **Cookie Security**
- `httpOnly: true` - ป้องกัน XSS
- `secure: true` - HTTPS only (production)
- `sameSite: 'strict'` - ป้องกัน CSRF

---

## 📊 โครงสร้างฐานข้อมูล

### ตาราง `user_sessions`
เก็บ session ที่ active
```sql
- session_token (VARCHAR 64) - Token สำหรับตรวจสอบ
- user_id - FK to officer
- username, title, given_name, family_name
- ip_address, user_agent - ข้อมูลการเชื่อมต่อ
- created_at, last_activity, expires_at
- is_active - สถานะ session
- login_method - username_password หรือ thaiid
```

### ตาราง `login_attempts`
บันทึกความพยายาม login
```sql
- username - ชื่อผู้ใช้ที่พยายาม
- ip_address - IP ที่พยายาม
- attempt_time - เวลา
- success - สำเร็จหรือไม่ (0/1)
```

### ตาราง `security_logs`
บันทึกเหตุการณ์ความปลอดภัย
```sql
- event_type - login_success, login_failed, logout, session_expired, suspicious_activity, account_locked
- user_id, username
- ip_address, user_agent
- details - รายละเอียดเหตุการณ์
- severity - low, medium, high, critical
- created_at
```

### เพิ่มคอลัมน์ใน `officer`
```sql
- failed_login_attempts - นับจำนวนครั้งที่ล้มเหลว
- account_locked_until - ล็อคจนถึงเวลาไหน
- password_changed_at - เปลี่ยนรหัสผ่านล่าสุด
- must_change_password - บังคับเปลี่ยนรหัสผ่าน
- two_factor_enabled - เปิด 2FA หรือไม่
- two_factor_secret - Secret key สำหรับ 2FA
- last_login - Login ล่าสุด
```

---

## 🔒 กลไกความปลอดภัย

### Login Flow (ปรับปรุงแล้ว)

```
1. รับ username + password
   ↓
2. ตรวจสอบ brute force (5 ครั้ง/15 นาที)
   ↓ ถ้าเกิน → ปฏิเสธ (429)
   ↓
3. ดึงข้อมูล officer
   ↓ ไม่พบ → บันทึก failed attempt → ปฏิเสธ (401)
   ↓
4. ตรวจสอบ account_locked_until
   ↓ ล็อคอยู่ → ปฏิเสธ (403)
   ↓
5. ตรวจสอบรหัสผ่าน
   ↓ ผิด → เพิ่ม failed_login_attempts
   ↓        → ถ้า >= 5 ล็อค 30 นาที
   ↓        → บันทึก failed attempt → ปฏิเสธ (401)
   ↓ ถูก
   ↓
6. รีเซ็ต failed_login_attempts = 0
   ↓
7. สร้าง session_token
   ↓
8. บันทึกลง user_sessions
   ↓
9. บันทึก login_attempts (success = 1)
   ↓
10. บันทึก security_logs (login_success)
   ↓
11. บันทึก activity_logs
   ↓
12. ส่ง response + set cookie
```

### Logout Flow

```
1. รับ sessionToken
   ↓
2. ดึงข้อมูล user_id, username
   ↓
3. ลบ session จาก user_sessions
   ↓
4. บันทึก security_logs (logout)
   ↓
5. ลบ cookies (user_session, session_token)
   ↓
6. ส่ง response
```

### Session Validation

```
1. รับ sessionToken
   ↓
2. ค้นหาใน user_sessions
   ↓ WHERE session_token = ? AND expires_at > NOW() AND is_active = 1
   ↓
3. ไม่พบ → ปฏิเสธ (401)
   ↓
4. พบ → ส่งข้อมูล user
```

---

## 🛡️ การป้องกันแต่ละประเภท

### 1. SQL Injection
- ✅ ใช้ Prepared Statements ทั้งหมด
- ✅ ไม่มี string concatenation ใน SQL

### 2. XSS (Cross-Site Scripting)
- ✅ Cookie มี `httpOnly: true`
- ✅ ไม่ใช้ `dangerouslySetInnerHTML`
- ✅ React escape HTML อัตโนมัติ

### 3. CSRF (Cross-Site Request Forgery)
- ✅ Cookie มี `sameSite: 'strict'`
- ✅ Token validation

### 4. Brute Force
- ✅ จำกัด 5 ครั้ง/15 นาที
- ✅ ล็อคบัญชี 30 นาที หลัง 5 ครั้ง
- ✅ ตรวจสอบทั้ง username และ IP

### 5. Session Hijacking
- ✅ เก็บ IP address และ User Agent
- ✅ Session timeout (24 ชั่วโมง)
- ✅ httpOnly cookies

### 6. Password Security
- ✅ bcrypt hash (10 rounds)
- ✅ ไม่เก็บ plain text
- ✅ เตรียมพร้อม must_change_password

---

## 📈 Views สำหรับ Monitoring

### 1. `active_sessions`
ดู session ที่ active อยู่
```sql
SELECT * FROM active_sessions;
-- แสดง: user, login_method, idle_minutes, remaining_minutes
```

### 2. `suspicious_activities`
ตรวจจับกิจกรรมผิดปกติ
```sql
SELECT * FROM suspicious_activities;
-- แสดง: username, ip_address, failed_attempts >= 3 ใน 1 ชั่วโมง
```

---

## 🔄 Automatic Cleanup

### Event Scheduler (รันทุก 1 ชั่วโมง)
```sql
CALL cleanup_expired_sessions();
```

**ทำอะไร:**
- ลบ session ที่หมดอายุ
- ลบ login_attempts เก่ากว่า 24 ชั่วโมง
- บันทึก security log

---

## 🚨 Alert & Monitoring

### เหตุการณ์ที่ต้องสนใจ

1. **Critical** - บัญชีถูกล็อค
```sql
SELECT * FROM security_logs 
WHERE severity = 'critical' 
AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

2. **High** - กิจกรรมผิดปกติ
```sql
SELECT * FROM security_logs 
WHERE severity = 'high' 
AND created_at > DATE_SUB(NOW(), INTERVAL 1 HOUR);
```

3. **Suspicious Activities**
```sql
SELECT * FROM suspicious_activities;
```

4. **Active Sessions by IP**
```sql
SELECT ip_address, COUNT(*) as sessions
FROM active_sessions
GROUP BY ip_address
HAVING sessions > 3;  -- เดียวกัน IP มี > 3 sessions
```

---

## 📊 รายงานสถิติ

### จำนวน Login วันนี้
```sql
SELECT 
    COUNT(*) as total_logins,
    SUM(CASE WHEN success = 1 THEN 1 ELSE 0 END) as successful,
    SUM(CASE WHEN success = 0 THEN 1 ELSE 0 END) as failed
FROM login_attempts
WHERE DATE(attempt_time) = CURDATE();
```

### Top Failed Login Attempts
```sql
SELECT 
    username,
    COUNT(*) as attempts
FROM login_attempts
WHERE success = 0 
AND attempt_time > DATE_SUB(NOW(), INTERVAL 24 HOUR)
GROUP BY username
ORDER BY attempts DESC
LIMIT 10;
```

### Login Methods
```sql
SELECT 
    login_method,
    COUNT(*) as count
FROM user_sessions
WHERE created_at > DATE_SUB(NOW(), INTERVAL 7 DAY)
GROUP BY login_method;
```

---

## 🔧 การบำรุงรักษา

### ประจำวัน
- [ ] ตรวจสอบ `suspicious_activities`
- [ ] ดู security_logs ระดับ critical/high

### ประจำสัปดาห์
- [ ] ตรวจสอบ login patterns
- [ ] ดูบัญชีที่ถูกล็อคบ่อย
- [ ] ตรวจสอบ session duration

### ประจำเดือน
- [ ] Cleanup เก่าข้อมูล (> 90 วัน)
- [ ] Review security logs
- [ ] อัพเดทรหัสผ่านที่เก่า (> 90 วัน)

---

## 🎯 TODO (อนาคต)

- [ ] เพิ่ม 2FA (Two-Factor Authentication)
- [ ] Rate limiting ต่อ IP
- [ ] Email notification สำหรับ suspicious activity
- [ ] Password strength requirements
- [ ] บังคับเปลี่ยนรหัสผ่านทุก 90 วัน
- [ ] Session concurrency limit (จำกัด session ต่อ user)
- [ ] Geo-location tracking
- [ ] Device fingerprinting

---

## 📝 Configuration

### Environment Variables
```env
# Production - ต้องเป็น HTTPS
NODE_ENV=production

# Session timeout (milliseconds)
SESSION_TIMEOUT=86400000  # 24 hours

# Max login attempts
MAX_LOGIN_ATTEMPTS=5
LOGIN_ATTEMPT_WINDOW=15   # minutes
ACCOUNT_LOCK_DURATION=30  # minutes
```

---

## ✅ Checklist ก่อน Deploy

- [ ] ตรวจสอบ Event Scheduler เปิดอยู่
```sql
SHOW VARIABLES LIKE 'event_scheduler';
-- ต้องเป็น ON
```

- [ ] ตรวจสอบ Tables ครบ
```sql
SHOW TABLES LIKE '%session%';
SHOW TABLES LIKE '%security%';
SHOW TABLES LIKE '%login%';
```

- [ ] Test brute force protection
- [ ] Test session timeout
- [ ] Test logout ลบ session
- [ ] เปิด HTTPS (production)
- [ ] ตรวจสอบ cookie settings

---

## 🆘 Troubleshooting

### ปัญหา: บัญชีล็อคตลอด
```sql
-- ปลดล็อคบัญชี
UPDATE officer 
SET failed_login_attempts = 0, 
    account_locked_until = NULL 
WHERE username = 'your_username';
```

### ปัญหา: Session หมดอายุเร็ว
```sql
-- ตรวจสอบ expires_at
SELECT session_token, expires_at, 
       TIMESTAMPDIFF(MINUTE, NOW(), expires_at) as remaining_minutes
FROM user_sessions 
WHERE user_id = YOUR_ID;
```

### ปัญหา: ไม่สามารถ login
```sql
-- ดู login attempts ล่าสุด
SELECT * FROM login_attempts 
WHERE username = 'your_username' 
ORDER BY attempt_time DESC 
LIMIT 10;

-- ดู security logs
SELECT * FROM security_logs 
WHERE username = 'your_username' 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 📚 อ้างอิง

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [MySQL Event Scheduler](https://dev.mysql.com/doc/refman/8.0/en/event-scheduler.html)

---

**สถานะ**: ✅ ระบบพร้อมใช้งาน  
**ระดับความปลอดภัย**: 🟢 High  
**อัพเดทล่าสุด**: 29 ธันวาคม 2025
