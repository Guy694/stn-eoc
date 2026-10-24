"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

/** เวลาปัจจุบันที่เดินทุกนาที เพื่อให้การ์ดเปลี่ยนเป็น "ล่าช้า" ได้เองแม้เปิดหน้าทิ้งไว้ */
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** ป้ายเวลาข้อมูล: สดเป็นตัวอักษรเทา / ล่าช้าเป็นป้ายสีเหลืองอำพัน */
export default function FreshnessTag({ info, tone = "light", className = "" }) {
  if (!info?.known) return null;
  if (!info.stale) {
    return <span className={`${tone === "dark" ? "text-[#9fc9d6]" : "text-slate-500"} ${className}`}>{info.label}</span>;
  }
  return (
    <span className={`inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 font-semibold text-amber-900 ring-1 ring-amber-300 ${className}`} role="status">
      <Clock3 className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />{info.label}
    </span>
  );
}
