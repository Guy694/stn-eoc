# 🔐 Security Setup Guide - การจัดการ API Keys

## 📋 สรุป

API keys และ secrets ควรจัดเก็บตามสถานที่ต่างๆ ขึ้นอยู่กับ environment:

| Environment | เก็บที่ไหน | วิธีการ |
|-------------|-----------|---------|
| **Development (Local)** | `.env` file | ไม่ commit ลง Git |
| **Production (Vercel)** | Vercel Dashboard | Environment Variables |
| **Production (Other)** | Server Environment | Environment Variables |
| **CI/CD** | GitHub Secrets / GitLab Variables | Secrets Management |

---

## 🖥️ Development (Local)

### 1. สร้างไฟล์ `.env` (ไม่ commit)

```bash
# Copy from example
cp .env.example .env

# แก้ไขค่าจริง
nano .env
```

### 2. ตรวจสอบ `.gitignore`

```bash
# ตรวจสอบว่ามี .env* หรือยัง
cat .gitignore | grep .env

# ถ้ายังไม่มี เพิ่มเข้าไป
echo ".env*" >> .gitignore
```

### 3. ลบ `.env` ออกจาก Git (ถ้า commit ไปแล้ว)

```bash
# หยุดติดตาม .env
git rm --cached .env

# Commit การลบ
git commit -m "Remove .env from repository"

# Push
git push
```

### 4. สร้าง SECRET_KEY ที่แข็งแกร่ง

```bash
# ใช้ openssl สร้าง random key
openssl rand -base64 32

# หรือใช้ Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Copy ผลลัพธ์ใส่ใน .env
SECRET_KEY=wK8mP2qL9tW3fN7dX4cV6iJ1sY5zF0bD8rG3nP7oQ2xE9=
```

---

## ☁️ Production Deployment

### Option 1: Vercel (แนะนำ)

#### วิธีตั้งค่า Environment Variables

1. **ผ่าน Vercel Dashboard**
   ```
   1. เข้า https://vercel.com/dashboard
   2. เลือก Project
   3. ไปที่ Settings → Environment Variables
   4. เพิ่มแต่ละ variable:
      - Key: DB_HOST
      - Value: your_production_db_host
      - Environment: Production (เลือก)
   5. กด Save
   ```

2. **ผ่าน Vercel CLI**
   ```bash
   # Install CLI
   npm i -g vercel

   # Login
   vercel login

   # เพิ่ม environment variable
   vercel env add SECRET_KEY production
   # ระบบจะให้ใส่ค่า

   # ดูรายการทั้งหมด
   vercel env ls

   # Pull มาใช้ local (สำหรับทดสอบ)
   vercel env pull .env.production.local
   ```

#### Variables ที่ต้องตั้งใน Vercel

```env
# Database (Production)
DB_HOST=your_production_db_host
DB_USER=your_production_db_user
DB_PASSWORD=your_production_db_password
DB_NAME=stneoc
DB_PORT=3306

# Application
NEXT_PUBLIC_API_URL=https://your-domain.vercel.app

# ThaiID
CALLBACK=https://your-domain.vercel.app/api/auth/thaiid/callback
APIKEY=production_thaiid_apikey
CLIENT_ID=production_client_id
CLIENT_SECRET=production_client_secret

# APIs
GISTDA_API_KEY=production_gistda_key
GEMINI_API_KEY=production_gemini_key

# Security
SECRET_KEY=your_strong_production_secret_key
```

### Option 2: VPS / Dedicated Server

#### 1. สร้างไฟล์ `.env` บน server

```bash
# SSH เข้า server
ssh user@your-server.com

# ไปที่ project directory
cd /var/www/stn-eoc

# สร้าง .env
nano .env
```

#### 2. ตั้ง permissions

```bash
# ให้เฉพาะ owner อ่านได้
chmod 600 .env

# ตรวจสอบ
ls -la .env
# ควรเป็น: -rw------- (600)
```

#### 3. ใช้ systemd environment (ทางเลือก)

```bash
# สร้าง service file
sudo nano /etc/systemd/system/stn-eoc.service
```

```ini
[Unit]
Description=STN EOC Application

[Service]
Environment="SECRET_KEY=your_secret_here"
Environment="DB_PASSWORD=your_password_here"
WorkingDirectory=/var/www/stn-eoc
ExecStart=/usr/bin/npm start
Restart=always

[Install]
WantedBy=multi-user.target
```

### Option 3: Docker

#### 1. ใช้ docker-compose.yml

```yaml
version: '3.8'
services:
  app:
    build: .
    environment:
      - DB_HOST=${DB_HOST}
      - DB_PASSWORD=${DB_PASSWORD}
      - SECRET_KEY=${SECRET_KEY}
    env_file:
      - .env.production
```

#### 2. หรือ pass จาก host

```bash
# Run with environment variables
docker run -e SECRET_KEY=$SECRET_KEY \
           -e DB_PASSWORD=$DB_PASSWORD \
           your-image
```

---

## 🔄 CI/CD Secrets

### GitHub Actions

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      
      - name: Deploy to Vercel
        env:
          VERCEL_TOKEN: ${{ secrets.VERCEL_TOKEN }}
          SECRET_KEY: ${{ secrets.SECRET_KEY }}
        run: |
          vercel --prod --token $VERCEL_TOKEN
```

**ตั้งค่า Secrets ใน GitHub:**
```
1. ไปที่ Repository → Settings → Secrets
2. คลิก "New repository secret"
3. เพิ่ม:
   - Name: SECRET_KEY
   - Value: your_secret_value
```

### GitLab CI/CD

```yaml
# .gitlab-ci.yml
deploy:
  stage: deploy
  variables:
    SECRET_KEY: $SECRET_KEY_PRODUCTION
  script:
    - npm run build
```

**ตั้งค่า Variables ใน GitLab:**
```
1. ไปที่ Project → Settings → CI/CD → Variables
2. Add variable:
   - Key: SECRET_KEY_PRODUCTION
   - Value: your_secret_value
   - Protected: Yes
   - Masked: Yes
```

---

## 🚨 Security Best Practices

### ✅ DO (ควรทำ)

1. **ใช้ `.env.example`** - เก็บ template โดยไม่มีค่าจริง
   ```env
   SECRET_KEY=your_secret_here
   ```

2. **แยก environment** - Dev, Staging, Production ใช้ keys คนละชุด
   ```
   .env.development
   .env.staging
   .env.production
   ```

3. **Rotate secrets** - เปลี่ยน keys เป็นระยะ
   ```bash
   # เปลี่ยน SECRET_KEY ทุก 90 วัน
   ```

4. **Monitor access** - ดูว่าใครเข้าถึง secrets
   ```bash
   # Vercel: มี Activity log
   # GitHub: มี Audit log
   ```

5. **ใช้ Secret Management Services** (สำหรับองค์กรใหญ่)
   - **AWS Secrets Manager**
   - **Azure Key Vault**
   - **Google Cloud Secret Manager**
   - **HashiCorp Vault**

### ❌ DON'T (ไม่ควรทำ)

1. ❌ **อย่า commit `.env`** ลง Git
2. ❌ **อย่าใช้ secrets ใน client-side code**
3. ❌ **อย่าเก็บ secrets ใน screenshot/video**
4. ❌ **อย่าแชร์ secrets ผ่าน email/chat**
5. ❌ **อย่าใช้ API keys แบบเดียวกันทั้ง dev และ prod**

---

## 🔍 ตรวจสอบ

### 1. ตรวจสอบว่า `.env` ถูก ignore

```bash
# ตรวจสอบ Git status
git status

# ถ้าเห็น .env ใน untracked files → ⚠️ อันตราย!
# ถ้าไม่เห็น → ✅ ปลอดภัย
```

### 2. ตรวจสอบว่า commit ไปหรือไม่

```bash
# ค้นหาว่ามี .env ใน Git history หรือไม่
git log --all --full-history -- .env

# ถ้ามี → ต้องลบออกจาก history
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch .env" \
  --prune-empty --tag-name-filter cat -- --all
```

### 3. ตรวจสอบว่า API keys รั่วหรือไม่

ใช้เครื่องมือ:
- **git-secrets** - ป้องกัน commit secrets
- **TruffleHog** - สแกนหา secrets ใน Git history
- **GitGuardian** - ตรวจจับ secrets ที่รั่ว

```bash
# Install git-secrets
brew install git-secrets

# Setup
git secrets --install
git secrets --register-aws

# Scan
git secrets --scan
```

---

## 📚 ตัวอย่าง Workflow

### สำหรับ Developer ใหม่

1. **Copy environment file**
   ```bash
   cp .env.example .env
   ```

2. **ขอ credentials จาก Team Lead**
   - Database credentials
   - API keys
   - Secret key

3. **ตรวจสอบ `.gitignore`**
   ```bash
   cat .gitignore | grep .env
   ```

4. **Test locally**
   ```bash
   npm run dev
   ```

### สำหรับ Deployment

1. **ตั้งค่า Production secrets**
   - ใน Vercel Dashboard
   - หรือบน Production server

2. **Deploy**
   ```bash
   vercel --prod
   ```

3. **Verify**
   - เช็คว่าแอปทำงาน
   - เช็ค logs ว่ามี error เรื่อง env หรือไม่

---

## 🆘 หาก API Keys รั่ว

### ทำทันที!

1. **Revoke keys ทันที**
   - ThaiID: ติดต่อ DOPA
   - GISTDA: ติดต่อ GISTDA
   - Gemini: ไป Google Cloud Console → Delete key

2. **สร้าง keys ใหม่**

3. **อัพเดท production**
   ```bash
   # Vercel
   vercel env rm SECRET_KEY production
   vercel env add SECRET_KEY production
   ```

4. **ตรวจสอบ usage logs**
   - ดูว่ามีการใช้งานผิดปกติหรือไม่

5. **แจ้งทีม**
   - บอกสมาชิกในทีม
   - อัพเดทเอกสาร

---

## ✅ Checklist

- [ ] `.env` อยู่ใน `.gitignore`
- [ ] ไม่มี `.env` ถูก commit ใน Git
- [ ] มี `.env.example` สำหรับ template
- [ ] SECRET_KEY เป็น random string อย่างน้อย 32 ตัวอักษร
- [ ] Production ใช้ keys คนละชุดกับ development
- [ ] API keys ถูกเก็บใน environment variables บน production
- [ ] มีการ rotate secrets เป็นระยะ
- [ ] ทีมรู้วิธีจัดการ secrets อย่างถูกต้อง

---

**สรุป**: API keys ควรอยู่ใน **environment variables** เท่านั้น ไม่ commit ลง Git และควรแยก keys ระหว่าง development กับ production 🔐
