"use client";

import { useEffect, useState } from "react";

// ปุ่มขอความช่วยเหลือเปิดใช้ได้เฉพาะเมื่อมี EOC เปิดอยู่
// - โหลดสถานะครั้งเดียวต่อหน้า แล้วแชร์ให้ทุกปุ่ม
// - ระหว่างโหลดหรือถ้าเช็กไม่ได้ ให้ถือว่า "เปิด" (fail-open) เพราะเป็นเรื่องฉุกเฉิน
//   และเซิร์ฟเวอร์ยังตรวจซ้ำตอนรับคำขออยู่แล้ว
export const HELP_CLOSED_HINT = "เปิดให้ใช้เมื่อมีเหตุการณ์ฉุกเฉิน (EOC เปิด) • เหตุด่วนโทร 1669";
export const WATER_CLOSED_HINT = "เปิดรับรายงานเมื่อเปิดศูนย์ปฏิบัติการด้านอุทกภัย • เหตุด่วนโทร 1669";

let cached = null;
let inflight = null;

function loadAvailability() {
  if (cached && Date.now() - cached.at < 30000) return Promise.resolve(cached.open);
  if (!inflight) {
    inflight = fetch("/stn-eoc/api/public/help-availability", { cache: "no-store" })
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => {
        const open = json?.success ? { help: Boolean(json.open), flood: Boolean(json.floodOpen) } : null;
        if (open !== null) cached = { open, at: Date.now() };
        return open;
      })
      .catch(() => null)
      .finally(() => { inflight = null; });
  }
  return inflight;
}

export function resetHelpAvailabilityCache() {
  cached = null;
  inflight = null;
}

export default function useHelpAvailability() {
  const [open, setOpen] = useState(cached ? cached.open : null);

  useEffect(() => {
    let alive = true;
    loadAvailability().then((value) => { if (alive) setOpen(value); });
    return () => { alive = false; };
  }, []);

  return {
    loading: open === null,
    // null (ยังไม่รู้/เช็กไม่ได้) ถือว่าเปิด
    helpOpen: open === null || open.help,
    floodOpen: open === null || open.flood
  };
}
