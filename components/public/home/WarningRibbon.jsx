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
      {/* แสดงระดับและรายละเอียดแยกบรรทัด เพื่อให้อ่านสถานการณ์ได้ครบทั้งมือถือและจอใหญ่ */}
      <div className="mx-auto flex max-w-5xl items-center gap-2 px-3 py-1.5 sm:gap-3 sm:px-6 sm:py-2">
        <span className="relative hidden h-2.5 w-2.5 shrink-0 sm:flex" aria-hidden="true">
          <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-70 motion-reduce:animate-none ${severe ? "bg-white" : "bg-[#7c2d12]"}`} />
          <span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${severe ? "bg-white" : "bg-[#7c2d12]"}`} />
        </span>
        <TriangleAlert className="h-4 w-4 shrink-0 sm:hidden" aria-hidden="true" />
        <span className="hidden shrink-0 items-center gap-1.5 font-[family-name:var(--font-kanit)] text-sm font-bold sm:inline-flex">
          <TriangleAlert className="h-4 w-4" aria-hidden="true" /> ประกาศเตือน
        </span>
        <div className="min-w-0 flex-1">
          <p className="mb-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] font-bold leading-4 sm:text-[11px]">
            <span className="rounded-full bg-black/10 px-1.5 leading-4">{severe ? "ระดับรุนแรง" : "เฝ้าระวัง"}</span>
            {first.issued_at ? <time dateTime={first.issued_at}>{`อัปเดต ${timeText(first.issued_at)}`}</time> : null}
            {first.source ? <span className="font-medium opacity-85">แหล่งข้อมูล: {first.source}</span> : null}
          </p>
          <p className="line-clamp-2 break-words text-xs font-semibold leading-5 sm:text-sm" title={first.message}>
            {first.message}
          </p>
        </div>
        <Link
          href="/public/announcements#current-warnings"
          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-bold sm:px-2.5 ${severe ? "bg-white/15 hover:bg-white/25" : "bg-[#2b1d00]/10 hover:bg-[#2b1d00]/20"}`}
        >
          <span className="sm:hidden">{sorted.length > 1 ? `ทั้งหมด ${sorted.length}` : "ดู"}</span>
          <span className="hidden sm:inline">{sorted.length > 1 ? `ดูทั้งหมด ${sorted.length} ประกาศ` : "ดูรายละเอียด"}</span>
        </Link>
      </div>
    </div>
  );
}
