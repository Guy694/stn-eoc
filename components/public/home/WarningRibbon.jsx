"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

function timeText(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : `${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

/** แถบประกาศเตือนบนสุดของหน้าแรก — แสดงเฉพาะเมื่อมีเหตุ (น้ำล้น/ใกล้ตลิ่ง ฝนตกหนัก ประกาศ สสน.) */
export default function WarningRibbon({ warnings = [] }) {
  if (warnings.length === 0) return null;
  const sorted = [...warnings].sort((a, b) => (b.level === "high") - (a.level === "high"));
  const first = sorted[0];
  const severe = first.level === "high";
  return (
    <div className={`warning-ribbon ${severe ? "bg-[#b91c1c] text-white" : "bg-[#f4b740] text-[#2b1d00]"}`} role="alert">
      <style>{`
        .warning-ribbon { animation: warning-ribbon-in .45s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes warning-ribbon-in { from { transform: translateY(-100%); opacity: 0; } }
        @media (prefers-reduced-motion: reduce) { .warning-ribbon { animation: none; } }
      `}</style>
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 sm:px-6">
        <span className="inline-flex items-center gap-2 font-[family-name:var(--font-kanit)] text-base font-bold">
          <span className="relative flex h-3 w-3" aria-hidden="true">
            <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none ${severe ? "bg-white" : "bg-[#7c2d12]"}`} />
            <span className={`relative inline-flex h-3 w-3 rounded-full ${severe ? "bg-white" : "bg-[#7c2d12]"}`} />
          </span>
          <TriangleAlert className="h-5 w-5" aria-hidden="true" /> ประกาศเตือน
        </span>
        <p className="min-w-0 flex-1 text-[15px] font-semibold leading-6">
          {first.message}
          {first.issued_at ? <span className="ml-2 font-normal opacity-80">{timeText(first.issued_at)}</span> : null}
        </p>
        <Link
          href="/public/weather-watch"
          className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-bold ${severe ? "bg-white/15 hover:bg-white/25" : "bg-[#2b1d00]/10 hover:bg-[#2b1d00]/20"}`}
        >
          {sorted.length > 1 ? `ดูทั้งหมด ${sorted.length} ประกาศ` : "ดูรายละเอียด"}
        </Link>
      </div>
    </div>
  );
}
