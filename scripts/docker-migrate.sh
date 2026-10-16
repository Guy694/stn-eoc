#!/usr/bin/env bash
# รัน migration ฐานข้อมูลบนเซิร์ฟเวอร์ที่ใช้ MySQL ใน Docker (ไม่ต้องมี Node บนเครื่อง และไม่ต้องให้ image ของแอปมี scripts/)
# วิธีใช้ (รันในโฟลเดอร์โปรเจกต์บนเซิร์ฟเวอร์ ที่มี .env):
#   ./scripts/docker-migrate.sh status            ดูว่าไฟล์ไหนรันแล้ว/ยังไม่รัน
#   ./scripts/docker-migrate.sh backup            สำรองฐานข้อมูลไว้ที่ ./db-backups/
#   ./scripts/docker-migrate.sh up --dry-run      ดูว่าจะรันไฟล์อะไร (ยังไม่แตะฐานข้อมูล)
#   ./scripts/docker-migrate.sh up                สำรองอัตโนมัติก่อน แล้วรันไฟล์ที่ค้าง
#   ./scripts/docker-migrate.sh baseline --through <ไฟล์>   (ใช้เฉพาะฐานข้อมูลที่สร้างจากไฟล์ .sql ทั้งก้อน — ดู docs/database-migration.md)
# ค่าที่ปรับได้: DB_CONTAINER (ค่าเริ่มต้น stn-eoc-db), DB_SERVICE_HOST (ค่าเริ่มต้น db), MIGRATE_NETWORK (ค่าเริ่มต้น หาเอง)
set -euo pipefail

cd "$(dirname "$0")/.."
[ -f .env ] || { echo "ไม่พบไฟล์ .env ในโฟลเดอร์ $(pwd)"; exit 1; }
set -a; . ./.env; set +a

DB_CONTAINER="${DB_CONTAINER:-stn-eoc-db}"
DB_SERVICE_HOST="${DB_SERVICE_HOST:-db}"
DB_NAME_EFFECTIVE="${MYSQL_DATABASE:-${DB_NAME:-stneoc}}"
DB_PASS_EFFECTIVE="${MYSQL_ROOT_PASSWORD:?ต้องมี MYSQL_ROOT_PASSWORD ใน .env}"

docker inspect "$DB_CONTAINER" >/dev/null 2>&1 || { echo "ไม่พบคอนเทนเนอร์ฐานข้อมูล $DB_CONTAINER (ตั้ง DB_CONTAINER=ชื่อที่ถูกต้อง)"; exit 1; }

# คอนเทนเนอร์อาจต่อหลายเครือข่าย: เลือกเครือข่ายที่ชื่อมี stn-network ก่อน ไม่งั้นใช้อันแรก
if [ -z "${MIGRATE_NETWORK:-}" ]; then
  NETWORKS=$(docker inspect "$DB_CONTAINER" --format '{{range $k,$v := .NetworkSettings.Networks}}{{$k}} {{end}}')
  MIGRATE_NETWORK=$(echo "$NETWORKS" | tr ' ' '\n' | grep -m1 'stn-network' || true)
  [ -n "$MIGRATE_NETWORK" ] || MIGRATE_NETWORK=$(echo "$NETWORKS" | awk '{print $1}')
fi

backup() {
  mkdir -p db-backups
  local file="db-backups/${DB_NAME_EFFECTIVE}_$(date +%Y%m%d_%H%M%S).sql"
  echo "สำรองฐานข้อมูล ${DB_NAME_EFFECTIVE} → ${file}"
  docker exec -e MYSQL_PWD="$DB_PASS_EFFECTIVE" "$DB_CONTAINER" \
    mysqldump -uroot --single-transaction --routines --triggers "$DB_NAME_EFFECTIVE" > "$file"
  [ -s "$file" ] || { echo "ไฟล์สำรองว่างเปล่า — หยุด ไม่รัน migration"; rm -f "$file"; exit 1; }
  echo "สำรองแล้ว ($(du -h "$file" | cut -f1))"
}

run_migrate() {
  docker run --rm --network "$MIGRATE_NETWORK" -v "$PWD":/src:ro -w /work \
    -e DB_HOST="$DB_SERVICE_HOST" -e DB_PORT=3306 -e DB_USER=root \
    -e DB_PASSWORD="$DB_PASS_EFFECTIVE" -e DB_NAME="$DB_NAME_EFFECTIVE" -e USER="${USER:-server}" \
    node:20-alpine sh -c 'cp -r /src/scripts /src/migrations /work/ && echo "{\"type\":\"module\"}" > package.json && npm i --silent --no-save mysql2 >/dev/null 2>&1 && node scripts/migrate.mjs "$@"' _ "$@"
}

COMMAND="${1:-status}"
echo "ฐานข้อมูล: ${DB_NAME_EFFECTIVE} · คอนเทนเนอร์: ${DB_CONTAINER} · เครือข่าย: ${MIGRATE_NETWORK}"
case "$COMMAND" in
  backup) backup ;;
  up)
    shift
    if [[ " $* " != *" --dry-run "* ]]; then backup; fi
    run_migrate up "$@"
    ;;
  status|baseline|check) run_migrate "$@" ;;
  *) echo "ไม่รู้จักคำสั่ง: $COMMAND (ใช้ได้: status, backup, up, up --dry-run, baseline)"; exit 1 ;;
esac
