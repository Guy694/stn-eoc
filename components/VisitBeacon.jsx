"use client";

// ส่งบันทึกการเข้าชม 1 ครั้งต่อการเปิดหน้า (ใช้ตรวจย้อนหลังด้านความปลอดภัย: IP ตำแหน่งโดยประมาณ หน้า เวลา)
// ไม่ส่ง query string และไม่ขอ GPS · หน้าเดิมภายใน 1 นาทีไม่ส่งซ้ำ
import { useEffect } from "react";
import { usePathname } from "next/navigation";

const REPEAT_MS = 60 * 1000;
const lastSent = new Map();

export default function VisitBeacon() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/api")) return;
    if (Date.now() - (lastSent.get(pathname) || 0) < REPEAT_MS) return;
    const timer = setTimeout(() => {
      lastSent.set(pathname, Date.now());
      try {
        fetch("/stn-eoc/api/public/visit", {
          method: "POST",
          keepalive: true,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ path: pathname, referrer: document.referrer || "" })
        }).catch(() => {});
      } catch {
        // บันทึกไม่ได้ไม่กระทบการใช้งาน
      }
    }, 800);
    return () => clearTimeout(timer);
  }, [pathname]);
  return null;
}
