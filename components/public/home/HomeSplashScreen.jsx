"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

const DISPLAY_MS = 1200;
const EXIT_MS = 250;

export default function HomeSplashScreen() {
  const [isVisible, setIsVisible] = useState(true);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    const leaveTimer = window.setTimeout(() => setIsLeaving(true), DISPLAY_MS);
    const removeTimer = window.setTimeout(() => setIsVisible(false), DISPLAY_MS + EXIT_MS);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(removeTimer);
    };
  }, []);

  if (!isVisible) return null;

  return (
    <div
      className={`fixed inset-0 z-[2000] grid place-items-center bg-[#083865] px-6 text-center text-white transition-opacity duration-250 ${isLeaving ? "opacity-0" : "opacity-100"}`}
      role="status"
      aria-live="polite"
      aria-label="กำลังเปิดระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน จังหวัดสตูล"
    >
      <div className="flex flex-col items-center">
        <div className="animate-float-soft rounded-full bg-white p-2 shadow-[0_12px_35px_rgba(0,0,0,.28)]">
          <Image src="/stn-eoc/img/logo.png" alt="" width={104} height={104} priority className="h-[88px] w-[88px] rounded-full sm:h-[104px] sm:w-[104px]" />
        </div>
        <p className="mt-6 text-xl font-black sm:text-2xl">Satun Geo-EOC</p>
        <p className="mt-1 text-sm text-blue-100 sm:text-base">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน จังหวัดสตูล</p>
        <div className="mt-6 flex items-center gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-1" />
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-2" />
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-3" />
        </div>
        <span className="sr-only">กำลังเตรียมข้อมูล</span>
      </div>
    </div>
  );
}
