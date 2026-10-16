# การ migrate ฐานข้อมูลบนเซิร์ฟเวอร์ (MySQL ใน Docker)

ใช้ทุกครั้งที่อัปเดตโค้ดแล้วมีไฟล์ใหม่ในโฟลเดอร์ `migrations/` ระบบรันไฟล์ตามลำดับใน `migrations/manifest.json` และจดไฟล์ที่รันแล้ว (พร้อม checksum) ไว้ในตาราง `schema_migrations` จึงรันซ้ำได้โดยไม่รันไฟล์เดิมซ้ำ

สคริปต์ `scripts/docker-migrate.sh` ทำทุกขั้นให้: อ่าน `.env` หาเครือข่ายของคอนเทนเนอร์ฐานข้อมูลเอง สำรองข้อมูลก่อน แล้วรัน `scripts/migrate.mjs` ในคอนเทนเนอร์ `node:20-alpine` ชั่วคราว (ไม่ต้องติดตั้ง Node บนเซิร์ฟเวอร์ และไม่ต้องให้ image ของแอปมี `scripts/`)

## สิ่งที่ต้องมี

- รันในโฟลเดอร์โปรเจกต์บนเซิร์ฟเวอร์ ที่มี `.env` และ `migrations/` ของโค้ดเวอร์ชันที่จะ deploy
- `.env` มี `MYSQL_ROOT_PASSWORD` และ `MYSQL_DATABASE`
- คอนเทนเนอร์ฐานข้อมูลชื่อ `stn-eoc-db` ทำงานอยู่ (ชื่ออื่นให้ใส่ `DB_CONTAINER=ชื่อ` หน้าคำสั่ง)
- เซิร์ฟเวอร์ดึง image `node:20-alpine` และติดตั้ง `mysql2` จาก npm ได้

## ขั้นตอนปกติ (ทุกครั้งที่ deploy)

```bash
cd /path/to/stn-eoc
git pull

./scripts/docker-migrate.sh status          # 1. ดูว่ามีไฟล์ไหน [pending]
./scripts/docker-migrate.sh up --dry-run    # 2. ดูว่าจะรันอะไร (ยังไม่แตะฐานข้อมูล)
./scripts/docker-migrate.sh up              # 3. สำรองอัตโนมัติ แล้วรันไฟล์ที่ค้าง
./scripts/docker-migrate.sh status          # 4. ต้องไม่เหลือ [pending]

docker compose up -d --build stn-eoc-app    # 5. build และเปิดแอปใหม่
```

ไฟล์สำรองอยู่ที่ `db-backups/<ชื่อฐานข้อมูล>_<วันเวลา>.sql` (อยู่ใน `.gitignore` และ `.dockerignore` แล้ว มีข้อมูลส่วนบุคคล เก็บให้ปลอดภัยและลบไฟล์เก่าเป็นระยะ)

## อ่านผล `status`

| ป้าย | ความหมาย |
| --- | --- |
| `[applied]` | รันด้วยคำสั่ง `up` แล้ว |
| `[baseline]` | ถือว่ามีอยู่แล้วในฐานข้อมูล (ไม่ได้รันจริง) |
| `[pending]` | ยังไม่รัน — จะรันตอน `up` |

ถ้าขึ้นว่าไฟล์ที่รันแล้วถูกแก้ (checksum ไม่ตรง) อย่าแก้ไฟล์ migration เก่า ให้เพิ่มไฟล์ใหม่แทน

## กรณีพิเศษ: ทุกไฟล์เป็น `[pending]`

เกิดเมื่อสร้างฐานข้อมูลใหม่ด้วยการนำเข้าไฟล์ `.sql` ทั้งก้อน (เช่น `database/stneoc-real.sql`) โครงสร้างมีอยู่แล้วแต่ตาราง `schema_migrations` ยังว่าง **อย่ารัน `up` ทันที** เพราะจะรันไฟล์เก่าซ้ำบนตารางที่มีอยู่

ให้ `baseline` ถึงไฟล์สุดท้ายที่ไฟล์ `.sql` นั้นมีอยู่แล้ว แล้วค่อย `up`:

```bash
./scripts/docker-migrate.sh baseline --through reconcile_eoc_team_registry.sql --dry-run
./scripts/docker-migrate.sh baseline --through reconcile_eoc_team_registry.sql
./scripts/docker-migrate.sh up --dry-run
```

ถ้าไม่แน่ใจว่าไฟล์ `.sql` ครอบคลุมถึงไฟล์ไหน ให้ถามผู้พัฒนาก่อน

## ย้อนกลับเมื่อมีปัญหา

ไม่มีคำสั่ง down ให้กู้จากไฟล์สำรองที่ `up` สร้างไว้ (จะเขียนทับข้อมูลปัจจุบันทั้งหมด):

```bash
set -a; . ./.env; set +a
docker exec -i -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" stn-eoc-db mysql -uroot "$MYSQL_DATABASE" < db-backups/<ไฟล์ที่ต้องการ>.sql
docker compose up -d --force-recreate stn-eoc-app
```

## ปัญหาที่เคยเจอ

| อาการ | สาเหตุ / วิธีแก้ |
| --- | --- |
| `network ... not found` | คอนเทนเนอร์ต่อหลายเครือข่าย สคริปต์เลือกตัวที่มี `stn-network` ให้เอง ถ้ายังผิดให้ระบุ `MIGRATE_NETWORK=stn-eoc_stn-network ./scripts/docker-migrate.sh status` |
| `ไม่พบคอนเทนเนอร์ฐานข้อมูล` | ดูชื่อด้วย `docker ps` แล้วใส่ `DB_CONTAINER=ชื่อ` |
| `Cannot find package 'mysql2'` | เกิดเมื่อรัน `migrate.mjs` ในคอนเทนเนอร์ของแอปโดยตรง ให้ใช้สคริปต์นี้แทน |
| `Access denied` | `MYSQL_ROOT_PASSWORD` ใน `.env` ไม่ตรงกับที่ตั้งตอนสร้าง volume ฐานข้อมูล |
| แอปขึ้น error คอลัมน์/ตารางไม่มี หลัง deploy | ยังไม่ได้ migrate หรือ migrate ก่อน `git pull` — รัน `status` ใหม่ |

## ประวัติ

- 16 ต.ค. 2569: รันถึง `20261016_provider_id_login.sql` (63/63 ไฟล์)
