"use client";

// ประกาศเตือนขณะนี้ (ชุดเดียวกับแถบแดงบนหน้าแรก): ประกาศของ สสน. + น้ำล้น/ใกล้ตลิ่ง + ฝนตกหนักจากสถานีวัด
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, TriangleAlert } from "lucide-react";

const SHOW = 5;
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

export default function CurrentWarnings({ warnings = [] }) {
  const [all, setAll] = useState(false);
  const ref = useRef(null);
  const sorted = sortWarnings(warnings);
  const shown = all ? sorted : sorted.slice(0, SHOW);
  const high = sorted.filter((item) => item.level === "high").length;

  // มาจากแถบแดงหน้าแรก (#current-warnings): เลื่อนมาที่รายการเมื่อโหลดเสร็จ
  useEffect(() => {
    if (!sorted.length || window.location.hash !== `#${WARNINGS_ANCHOR}`) return;
    setAll(true);
    ref.current?.scrollIntoView({ block: "start" });
  }, [sorted.length]);

  if (!sorted.length) return null;
  return (
    <section ref={ref} id={WARNINGS_ANCHOR} className="mb-8 scroll-mt-20 overflow-hidden rounded-3xl bg-white ring-1 ring-[#f3c4c4]" aria-labelledby="current-warnings-title">
      <div className={`flex flex-wrap items-center gap-x-3 gap-y-1 px-5 py-4 text-white ${high ? "bg-[#b91c1c]" : "bg-[#b45309]"}`}>
        <TriangleAlert className="h-6 w-6 shrink-0" aria-hidden="true" />
        <h2 id="current-warnings-title" className="font-[family-name:var(--font-kanit)] text-xl font-semibold">ประกาศเตือนขณะนี้</h2>
        <span className="text-sm text-white/85">{sorted.length} ประกาศ{high ? ` • รุนแรง ${high}` : ""}</span>
      </div>
      <ul className="divide-y divide-[#f1e1e1]">
        {shown.map((item, index) => (
          <li key={`${item.issued_at}-${index}`} className="flex gap-3 px-5 py-3.5">
            <span className={`mt-2 h-2.5 w-2.5 shrink-0 rounded-full ${item.level === "high" ? "bg-[#dc2626]" : "bg-[#f59e0b]"}`} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="break-words text-[15px] leading-7 text-[#15232e]">
                <span className={`mr-1.5 inline-block rounded-full px-2 py-0.5 align-[1px] text-xs font-semibold ${item.level === "high" ? "bg-red-50 text-red-800" : "bg-amber-50 text-amber-900"}`}>{item.level === "high" ? "รุนแรง" : "เฝ้าระวัง"}</span>
                {item.message}
              </p>
              <p className="mt-0.5 text-xs text-slate-500">{timeText(item.issued_at)}{item.source ? `${item.issued_at ? " • " : ""}${item.source}` : ""}</p>
            </div>
          </li>
        ))}
      </ul>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#f1e1e1] px-5 py-3 text-[15px]">
        {sorted.length > SHOW ? (
          <button type="button" onClick={() => setAll((value) => !value)} aria-expanded={all} className="font-semibold text-[#b91c1c] hover:underline">
            {all ? "แสดงน้อยลง" : `ดูทั้งหมด ${sorted.length} ประกาศ`}
          </button>
        ) : <span />}
        <Link href="/public/weather-watch" className="inline-flex items-center gap-1 font-semibold text-[#0b4c86] hover:underline">ดูบนแผนที่สถานการณ์ <ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
      </div>
    </section>
  );
}
