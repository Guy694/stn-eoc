#!/usr/bin/env bash
# =============================================================================
# docker-restore.sh — กู้คืนจาก backup ที่สร้างโดย docker-backup.sh
#
# วิธีใช้:
#   sudo bash docker-restore.sh /backup/docker-20261028-120000
#
# ⚠️ จะเขียนทับข้อมูลเดิมใน volume / โฟลเดอร์ project ที่ชื่อตรงกัน
# =============================================================================
set -euo pipefail

SRC="${1:-}"
[ -n "$SRC" ] && [ -d "$SRC" ] || { echo "ใช้: sudo bash $0 /path/to/docker-YYYYmmdd-HHMMSS"; exit 1; }
[ "$(id -u)" -eq 0 ] || { echo "กรุณารันด้วย sudo"; exit 1; }
log() { echo "[$(date +%H:%M:%S)] $*"; }

log "ตรวจ checksum"
( cd "$SRC" && sha256sum -c --quiet SHA256SUMS ) || { echo "ไฟล์ backup เสียหาย หยุดการ restore"; exit 1; }

read -r -p "จะเขียนทับข้อมูลเดิมที่ชื่อตรงกัน ยืนยัน? (yes/no): " ans
[ "$ans" = "yes" ] || { echo "ยกเลิก"; exit 0; }

# images
if ls "$SRC"/images/*.tar.gz >/dev/null 2>&1; then
  log "โหลด images"
  for f in "$SRC"/images/*.tar.gz; do gunzip -c "$f" | docker load; done
fi

# โฟลเดอร์ project และ bind mount (กลับไปที่ path เดิม)
for f in "$SRC"/projects/*.tar.gz "$SRC"/binds/*.tar.gz; do
  [ -e "$f" ] || continue
  log "แตกไฟล์ $(basename "$f")"
  tar xzf "$f" -C /
done

# volumes
for f in "$SRC"/volumes/*.tar.gz; do
  [ -e "$f" ] || continue
  v="$(basename "$f" .tar.gz)"
  log "กู้ volume $v"
  docker volume create "$v" >/dev/null
  mp="$(docker volume inspect -f '{{.Mountpoint}}' "$v")"
  tar xzf "$f" -C "$mp"
done

log "เสร็จแล้ว ✅ ขั้นต่อไปให้เข้าแต่ละโฟลเดอร์ project แล้วสั่ง: docker compose up -d"
log "รายการ project:"
cat "$SRC/meta/project-dirs.txt" 2>/dev/null || true
log "ถ้า volume ใช้ไม่ได้ ยังมีไฟล์ dump database อยู่ที่ $SRC/db/"
