"use client";

// ประกาศเตือนขณะนี้ (ชุดเดียวกับแถบแดงบนหน้าแรก): ประกาศของ สสน. + น้ำล้น/ใกล้ตลิ่ง + ฝนตกหนักจากสถานีวัด
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

export const WARNINGS_ANCHOR = "current-warnings";

function timeText(value) {
  if (!value) return "";
  const date = new Date(String(value).replace(" ", "T"));
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) + " น.";
}

/** เรียงระดับสูงก่อน แล้วใหม่ก่อน */
export function sortWarnings(list = []) {
  const at = (item) => Date.parse(String(item.issued_at || "").replace(" ", "T")) || 0;
  return [...list].sort((a, b) => (b.level === "high") - (a.level === "high") || at(b) - at(a));
}

export default function CurrentWarnings({ warnings = [], inHero = false }) {
  const ref = useRef(null);
  const sorted = sortWarnings(warnings);
  const high = sorted.filter((item) => item.level === "high").length;

  // มาจากแถบแดงหน้าแรก (#current-warnings): เลื่อนมาที่รายการเมื่อโหลดเสร็จ
  useEffect(() => {
    if (!sorted.length || window.location.hash !== `#${WARNINGS_ANCHOR}`) return;
    ref.current?.scrollIntoView({ block: "start" });
  }, [sorted.length]);

  if (!sorted.length) return null;
  return (
    <section ref={ref} id={WARNINGS_ANCHOR} className={`scroll-mt-20 overflow-hidden rounded-3xl bg-white text-[#15232e] ring-1 ring-[#f3c4c4] ${inHero ? "shadow-[0_18px_40px_-24px_rgba(0,0,0,.6)]" : "mb-8"}`} aria-labelledby="current-warnings-title">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 ${inHero ? "py-3" : "py-4"} text-white ${high ? "bg-[#b91c1c]" : "bg-[#b45309]"}`}>
        <TriangleAlert className="h-6 w-6 shrink-0" aria-hidden="true" />
        <h2 id="current-warnings-title" className="font-[family-name:var(--font-kanit)] text-xl font-semibold">ประกาศเตือนขณะนี้</h2>
        <span className="text-sm text-white/85">{sorted.length} ประกาศ{high ? ` • รุนแรง ${high}` : ""}</span>
      </div>
      <ul aria-label="รายการประกาศเตือน เลื่อนเพื่อดูทั้งหมด" tabIndex={0} className={`${inHero ? "max-h-[min(40vh,20rem)] lg:max-h-48" : "max-h-[min(45vh,24rem)]"} overflow-y-auto overscroll-contain divide-y divide-[#f1e1e1] pr-1 [scrollbar-width:thin] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b91c1c]`}>
        {sorted.map((item, index) => (
          <li key={`${item.issued_at}-${index}`} className="flex gap-3 px-5 py-3.5">
            <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.level === "high" ? "bg-[#dc2626]" : "bg-[#f59e0b]"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-[15px] leading-7 text-[#15232e]">
                <span className={`mr-1.5 inline-block rounded-full px-2 py-0.5 align-[1px] text-xs font-semibold ${item.level === "high" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>{item.level === "high" ? "รุนแรง" : "เฝ้าระวัง"}</span>
                {item.message}
              </p>
              {item.details?.length ? <p className="mt-0.5 break-words text-[13px] leading-5 text-slate-600">{item.details.join(" · ")}</p> : null}
              <p className="mt-0.5 text-xs text-slate-500">{timeText(item.issued_at)}{item.source ? `${item.issued_at ? " • " : ""}${item.source}` : ""}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f1e1e1] px-5 py-3 text-[15px]">
        <span className="text-xs text-slate-500">{sorted.length} ประกาศ · เลื่อนรายการเพื่อดูเพิ่มเติม</span>
        <Link href="/public/weather-watch" className="inline-flex items-center gap-1 font-semibold text-[#0b4c86] hover:underline">ดูบนแผนที่สถานการณ์ <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
