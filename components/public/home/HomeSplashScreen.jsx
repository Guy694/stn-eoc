"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const DISPLAY_MS = 1200; // แสดงโลโก้อย่างน้อยเท่านี้
const EXIT_MS = 250;
const SLOW_MS = 8000; // โหลดนานเกินนี้ → บอกว่าเครือข่ายช้า
const MAX_WAIT_MS = 20000; // กันค้าง: ครบเวลานี้ปิดหน้าโหลดเสมอ (หน้าแรกมีสถานะโหลดของตัวเองต่อ)

/**
 * หน้าโลโก้ตอนเปิดระบบ
 * - ready=false: ค้างหน้าโลโก้ไว้จนข้อมูลหลักของหน้าแรกโหลดเสร็จ พร้อมข้อความ "กำลังโหลดข้อมูล…"
 * - ready=true (ค่าเริ่มต้น): แสดงตามเวลาปกติแล้วหายไป
 */
export default function HomeSplashScreen({ ready = true }) {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);
  const [minDone, setMinDone] = useState(false);
  const [isSlow, setIsSlow] = useState(false);
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    const minTimer = window.setTimeout(() => setMinDone(true), DISPLAY_MS);
    const slowTimer = window.setTimeout(() => setIsSlow(true), SLOW_MS);
    const maxTimer = window.setTimeout(() => setTimedOut(true), MAX_WAIT_MS);
    return () => {
      window.clearTimeout(minTimer);
      window.clearTimeout(slowTimer);
      window.clearTimeout(maxTimer);
    };
  }, []);

  const shouldLeave = minDone && (ready || timedOut);
  useEffect(() => {
    if (!shouldLeave) return undefined;
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), 0);
    const removeTimer = window.setTimeout(() => setIsVisible(false), EXIT_MS);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, [shouldLeave]);

  const waiting = minDone && !ready && !timedOut;
  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[2000] grid place-items-center bg-[#083865] px-6 text-center text-white transition-opacity duration-250 ${isLeaving ? "opacity-0" : "opacity-100"}`}
      role="status"
      aria-busy={!shouldLeave}
      aria-label="กำลังเปิดศูนย์ข้อมูลสถานการณ์ฉุกเฉินด้านการแพทย์และสาธารณสุข จังหวัดสตูล"
    >
      <div className="flex flex-col items-center">
        <div className="animate-float-soft rounded-full bg-white p-2.5 shadow-[0_16px_45px_rgba(0,0,0,.32)] ring-4 ring-white/15 sm:p-3">
          <Image src="/stn-eoc/img/logo.png" alt="" width={184} height={184} priority className="h-[132px] w-[132px] rounded-full sm:h-[160px] sm:w-[160px] lg:h-[184px] lg:w-[184px]" />
        </div>
        <p className="mt-7 max-w-[34rem] font-[family-name:var(--font-kanit)] text-[22px] font-semibold leading-snug sm:text-3xl sm:leading-snug">
          <span className="block">ศูนย์ข้อมูลสถานการณ์ฉุกเฉิน</span>
          <span className="block">ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</span>
        </p>
        <p className="mt-3 max-w-[30rem] text-sm leading-relaxed text-blue-100 sm:text-base">Satun Medical and Public Health Emergency Situation Information Center</p>
        <div className="mt-7 flex items-center gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-1" />
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-2" />
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-3" />
        </div>
        <p className={`mt-4 min-h-[2.75rem] max-w-[22rem] font-[family-name:var(--font-kanit)] text-sm leading-snug text-blue-100 transition-opacity duration-300 sm:text-base ${waiting ? "opacity-100" : "opacity-0"}`} aria-live="polite">
          {waiting ? (
            <>
              <span className="block font-medium text-white">กำลังโหลดข้อมูล…</span>
              {isSlow ? <span className="mt-1 block text-xs text-blue-100 sm:text-sm">อินเทอร์เน็ตช้ากว่าปกติ ระบบกำลังดึงข้อมูลล่าสุด</span> : null}
            </>
          ) : null}
        </p>
        <span className="sr-only">{waiting ? "" : "กำลังเตรียมข้อมูล"}</span>
      </div>
    </div>
  );
}
