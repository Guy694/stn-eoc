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
      aria-label="กำลังเปิดระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล"
    >
      <div className="flex flex-col items-center">
        <div className="animate-float-soft rounded-full bg-white p-2.5 shadow-[0_16px_45px_rgba(0,0,0,.32)] ring-4 ring-white/15 sm:p-3">
          <Image src="/stn-eoc/img/logo.png" alt="" width={184} height={184} priority className="h-[132px] w-[132px] rounded-full sm:h-[160px] sm:w-[160px] lg:h-[184px] lg:w-[184px]" />
        </div>
        <p className="mt-7 max-w-[34rem] font-[family-name:var(--font-kanit)] text-[22px] font-semibold leading-snug sm:text-3xl sm:leading-snug">
          <span className="block">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน</span>
          <span className="block">ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</span>
        </p>
        <p className="mt-3 max-w-[30rem] text-sm leading-relaxed text-blue-100 sm:text-base">Satun Provincial Emergency Operations Center (Satun Geo-EOC)</p>
        <div className="mt-7 flex items-center gap-2" aria-hidden="true">
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-1" />
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-2" />
          <span className="h-2.5 w-2.5 rounded-full bg-white animate-pulse-dot-3" />
        </div>
        <span className="sr-only">กำลังเตรียมข้อมูล</span>
      </div>
    </div>
  );
}
