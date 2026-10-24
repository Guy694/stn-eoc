"use client";

import Link from "next/link";
import { TriangleAlert } from "lucide-react";

function timeText(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : `${date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" })} น.`;
}

/** แถบประกาศเตือนบนสุดของหน้าแรก — แสดงเฉพาะเมื่อมีเหตุ (น้ำล้น/ใกล้ตลิ่ง ฝนตกหนัก ประกาศ สสน.) · "ดูทั้งหมด" ไปที่รายการในหน้าประกาศและความรู้ */
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
      {/* มือถือ: แถวเดียวกะทัดรัด (ป้ายเล็ก + ข้อความ 2 บรรทัด + ลิงก์สั้น) / จอใหญ่: แบบเต็ม */}
      <div className="mx-auto flex max-w-6xl items-center gap-3 px-3 py-2 sm:gap-4 sm:px-6 sm:py-3">
        <span className="relative hidden h-3 w-3 shrink-0 sm:flex" aria-hidden="true">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none ${severe ? "bg-white" : "bg-[#7c2d12]"}`} />
          <span className={`relative inline-flex h-3 w-3 rounded-full ${severe ? "bg-white" : "bg-[#7c2d12]"}`} />
        </span>
        <TriangleAlert className="h-5 w-5 shrink-0 sm:hidden" aria-hidden="true" />
        <span className="hidden shrink-0 items-center gap-2 font-[family-name:var(--font-kanit)] text-base font-bold sm:inline-flex">
          <TriangleAlert className="h-5 w-5" aria-hidden="true" /> ประกาศเตือน
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold leading-4 opacity-90 sm:hidden">
            ประกาศเตือน{first.issued_at ? ` · ${timeText(first.issued_at)}` : ""}
          </p>
          <p className="line-clamp-2 text-[13px] font-semibold leading-[1.35] sm:line-clamp-none sm:text-[15px] sm:leading-6" title={first.message}>
            {first.message}
            {first.issued_at ? <span className="ml-2 hidden font-normal opacity-80 sm:inline">{timeText(first.issued_at)}</span> : null}
          </p>
        </div>
        <Link
          href="/public/announcements#current-warnings"
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold sm:px-3 sm:py-1.5 sm:text-sm ${severe ? "bg-white/15 hover:bg-white/25" : "bg-[#2b1d00]/10 hover:bg-[#2b1d00]/20"}`}
        >
          <span className="sm:hidden">{sorted.length > 1 ? `ทั้งหมด ${sorted.length}` : "ดู"}</span>
          <span className="hidden sm:inline">{sorted.length > 1 ? `ดูทั้งหมด ${sorted.length} ประกาศ` : "ดูรายละเอียด"}</span>
        </Link>
      </div>
    </div>
  );
}
