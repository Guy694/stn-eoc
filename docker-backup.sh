#!/usr/bin/env bash
# =============================================================================
# docker-backup.sh — Backup Docker ทั้งเครื่องแบบเต็ม (ทุก container)
#
# สิ่งที่ backup:
#   1. ข้อมูล config ของทุก container / network / volume (docker inspect)
#   2. โฟลเดอร์ docker compose project ทั้งหมด (compose file, .env, bind mount ข้างใน)
#   3. Dump database อัตโนมัติ (MySQL/MariaDB, PostgreSQL, MongoDB)
#   4. Named volumes ทั้งหมด
#   5. Bind mount ที่อยู่นอกโฟลเดอร์ project
#   6. (เลือกได้) Docker images ทั้งหมด
#
# วิธีใช้:
#   sudo bash docker-backup.sh
#   sudo BACKUP_ROOT=/mnt/disk2 SAVE_IMAGES=1 bash docker-backup.sh
#
# ตัวเลือก (ตั้งผ่าน environment variable):
#   BACKUP_ROOT=/backup     ที่เก็บ backup (ควรเป็นคนละ disk หรือคัดลอกออกนอกเครื่องภายหลัง)
#   STOP_CONTAINERS=1       หยุด container ระหว่าง backup volume เพื่อให้ข้อมูลไม่เสีย (แนะนำ)
#   SAVE_IMAGES=0           1 = เก็บ image ทั้งหมดด้วย (ไฟล์ใหญ่ แต่ไม่ต้อง pull/build ใหม่)
# =============================================================================
set -euo pipefail

BACKUP_ROOT="${BACKUP_ROOT:-/backup}"
STOP_CONTAINERS="${STOP_CONTAINERS:-1}"
SAVE_IMAGES="${SAVE_IMAGES:-0}"
STAMP="$(date +%Y%m%d-%H%M%S)"
DEST="$BACKUP_ROOT/docker-$STAMP"

log()  { echo "[$(date +%H:%M:%S)] $*"; }
warn() { echo "[$(date +%H:%M:%S)] ⚠️  $*" >&2; }

[ "$(id -u)" -eq 0 ] || { echo "กรุณารันด้วย sudo"; exit 1; }
command -v docker >/dev/null || { echo "ไม่พบคำสั่ง docker"; exit 1; }

mkdir -p "$DEST"/{meta,projects,db,volumes,binds,images}
log "เก็บ backup ที่: $DEST"
log "พื้นที่ว่างปลายทาง:"; df -h "$BACKUP_ROOT" | tail -1
log "ขนาดข้อมูล Docker ปัจจุบัน:"; du -sh /var/lib/docker 2>/dev/null || true

# -----------------------------------------------------------------------------
# 1) Metadata
# -----------------------------------------------------------------------------
log "1/6 บันทึก metadata ของ container, volume, network, image"
docker version            > "$DEST/meta/docker-version.txt" 2>&1 || true
docker ps -a --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Ports}}' > "$DEST/meta/containers.txt"
docker volume ls          > "$DEST/meta/volumes.txt"
docker network ls         > "$DEST/meta/networks.txt"
docker images             > "$DEST/meta/images.txt"

ALL_CONTAINERS="$(docker ps -aq)"
for c in $ALL_CONTAINERS; do
  name="$(docker inspect -f '{{.Name}}' "$c" | sed 's#^/##')"
  docker inspect "$c" > "$DEST/meta/inspect-$name.json"
done
docker ps --format '{{.Names}}' > "$DEST/meta/running-before-backup.txt"

# -----------------------------------------------------------------------------
# 2) โฟลเดอร์ docker compose project
# -----------------------------------------------------------------------------
log "2/6 Backup โฟลเดอร์ compose project"
PROJECT_DIRS=""
if [ -n "$ALL_CONTAINERS" ]; then
  PROJECT_DIRS="$(docker inspect -f '{{index .Config.Labels "com.docker.compose.project.working_dir"}}' $ALL_CONTAINERS \
                  | grep -v '^$' | grep -v '<no value>' | sort -u || true)"
fi
for dir in $PROJECT_DIRS; do
  if [ -d "$dir" ]; then
    out="$DEST/projects/$(echo "${dir#/}" | tr '/' '_').tar.gz"
    log "   - $dir"
    tar czf "$out" -C / "${dir#/}"
  else
    warn "ไม่พบโฟลเดอร์ $dir (ข้าม)"
  fi
done
printf '%s\n' $PROJECT_DIRS > "$DEST/meta/project-dirs.txt"

# -----------------------------------------------------------------------------
# 3) Dump database (ทำตอน container ยังรันอยู่)
# -----------------------------------------------------------------------------
log "3/6 Dump database อัตโนมัติ"
for c in $(docker ps -q); do
  name="$(docker inspect -f '{{.Name}}' "$c" | sed 's#^/##')"
  image="$(docker inspect -f '{{.Config.Image}}' "$c")"
  case "$image" in
    *mysql*|*mariadb*)
      log "   - $name (MySQL/MariaDB)"
      if ! docker exec "$c" sh -c 'D=$(command -v mariadb-dump || command -v mysqldump); \
            P="${MYSQL_ROOT_PASSWORD:-$MARIADB_ROOT_PASSWORD}"; \
            exec $D --all-databases --single-transaction --routines --events --triggers -uroot -p"$P"' \
            > "$DEST/db/$name.sql" 2>"$DEST/db/$name.err"; then
        warn "dump $name ไม่สำเร็จ ดู $DEST/db/$name.err (ข้อมูลยังอยู่ใน volume backup)"
      else
        rm -f "$DEST/db/$name.err"
      fi
      ;;
    *postgres*|*postgis*|*timescale*)
      log "   - $name (PostgreSQL)"
      if ! docker exec "$c" sh -c 'exec pg_dumpall -U "${POSTGRES_USER:-postgres}"' \
            > "$DEST/db/$name.sql" 2>"$DEST/db/$name.err"; then
        warn "dump $name ไม่สำเร็จ ดู $DEST/db/$name.err (ข้อมูลยังอยู่ใน volume backup)"
      else
        rm -f "$DEST/db/$name.err"
      fi
      ;;
    *mongo*)
      log "   - $name (MongoDB)"
      if ! docker exec "$c" sh -c 'if [ -n "$MONGO_INITDB_ROOT_USERNAME" ]; then \
              exec mongodump --archive --gzip -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" --authenticationDatabase admin; \
            else exec mongodump --archive --gzip; fi' \
            > "$DEST/db/$name.archive.gz" 2>"$DEST/db/$name.err"; then
        warn "dump $name ไม่สำเร็จ ดู $DEST/db/$name.err (ข้อมูลยังอยู่ใน volume backup)"
      else
        rm -f "$DEST/db/$name.err"
      fi
      ;;
  esac
done

# -----------------------------------------------------------------------------
# 4) หยุด container เพื่อ backup volume ให้ข้อมูลสม่ำเสมอ
#    (มี trap สั่ง start กลับให้อัตโนมัติ แม้สคริปต์ error กลางทาง)
# -----------------------------------------------------------------------------
RUNNING="$(docker ps -q)"
restart_containers() {
  if [ -n "$RUNNING" ]; then
    log "สั่ง start container กลับ"
    docker start $RUNNING >/dev/null || warn "start container บางตัวไม่สำเร็จ ตรวจด้วย docker ps -a"
  fi
}
if [ "$STOP_CONTAINERS" = "1" ] && [ -n "$RUNNING" ]; then
  trap restart_containers EXIT
  log "4/6 หยุด container ชั่วคราว ($(echo $RUNNING | wc -w) ตัว)"
  docker stop -t 60 $RUNNING >/dev/null
else
  log "4/6 ไม่หยุด container (STOP_CONTAINERS=0) — ข้อมูล volume อาจไม่สม่ำเสมอ ให้พึ่ง DB dump"
fi

# -----------------------------------------------------------------------------
# 5) Named volumes + bind mounts นอก project
# -----------------------------------------------------------------------------
log "5/6 Backup volumes"
for v in $(docker volume ls -q); do
  mp="$(docker volume inspect -f '{{.Mountpoint}}' "$v")"
  if [ -d "$mp" ]; then
    log "   - $v"
    tar czf "$DEST/volumes/$v.tar.gz" -C "$mp" .
  else
    warn "volume $v ไม่ได้เก็บแบบ local (ข้าม)"
  fi
done

log "     Backup bind mount ที่อยู่นอกโฟลเดอร์ project"
BINDS=""
if [ -n "$ALL_CONTAINERS" ]; then
  BINDS="$(docker inspect -f '{{range .Mounts}}{{if eq .Type "bind"}}{{println .Source}}{{end}}{{end}}' $ALL_CONTAINERS \
           | grep -v '^$' | sort -u || true)"
fi
for b in $BINDS; do
  case "$b" in
    /var/run/*|/run/*|/proc*|/sys*|/dev*|/etc/localtime|/etc/timezone|/var/lib/docker*) continue ;;
  esac
  inside=0
  for p in $PROJECT_DIRS; do
    case "$b/" in "$p"/*) inside=1 ;; esac
  done
  [ "$inside" = "1" ] && continue
  if [ -e "$b" ]; then
    log "   - $b"
    tar czf "$DEST/binds/$(echo "${b#/}" | tr '/' '_').tar.gz" -C / "${b#/}"
  fi
done

# -----------------------------------------------------------------------------
# 6) Images (เลือกได้)
# -----------------------------------------------------------------------------
if [ "$SAVE_IMAGES" = "1" ]; then
  log "6/6 Backup images (อาจใช้เวลานาน)"
  IMAGES="$(docker images --format '{{.Repository}}:{{.Tag}}' | grep -v '<none>' || true)"
  if [ -n "$IMAGES" ]; then
    docker save $IMAGES | gzip > "$DEST/images/all-images.tar.gz"
  fi
else
  log "6/6 ข้าม images (ตั้ง SAVE_IMAGES=1 ถ้าต้องการ)"
fi

# start container กลับทันที แล้วยกเลิก trap
if [ "$STOP_CONTAINERS" = "1" ]; then
  restart_containers
  trap - EXIT
fi

# -----------------------------------------------------------------------------
# สรุป + checksum
# -----------------------------------------------------------------------------
( cd "$DEST" && find . -type f ! -name SHA256SUMS -exec sha256sum {} + > SHA256SUMS )
log "เสร็จแล้ว ✅  ขนาด backup: $(du -sh "$DEST" | cut -f1)"
log "ที่อยู่: $DEST"
log "แนะนำ: คัดลอกโฟลเดอร์นี้ออกนอกเครื่อง เช่น"
log "  rsync -avP $DEST user@อีกเครื่อง:/backup/"
