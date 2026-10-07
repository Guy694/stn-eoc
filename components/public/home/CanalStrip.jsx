"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { canalState, canalSummary, sortCanals } from "@/lib/homeSignals";

function timeText(value) {
  const date = new Date(value || 0);
  return Number.isNaN(date.getTime()) || date.getTime() <= 0 ? "" : date.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

// เกจระดับน้ำ: เส้นประ = ระดับตลิ่ง สีของน้ำตามเกณฑ์ ThaiWater
function Gauge({ state, delay = 0 }) {
  const fill = state.fill ?? 0;
  const bankLine = 100 / 120;
  return (
    <div className="relative h-[5.5rem] w-7 shrink-0 overflow-hidden rounded-full bg-[#dbe8ee] ring-1 ring-[#c4d7e0]" aria-hidden="true">
      <div
        className="canal-gauge__water absolute inset-x-0 bottom-0 overflow-hidden rounded-b-full"
        style={{ height: `${fill * 100}%`, backgroundColor: state.color, animationDelay: `${delay}ms` }}
      >
        {/* ผิวน้ำไหวเบา ๆ */}
        <span className="canal-gauge__wave absolute -top-1.5 left-0 h-3 w-[200%]" />
      </div>
      <div className="absolute inset-x-0 border-t-2 border-dashed border-[#0c2f4a]/70" style={{ bottom: `${bankLine * 100}%` }} />
    </div>
  );
}

/** "น้ำในคลองตอนนี้": สถานีวัดระดับน้ำ ThaiWater ในสตูล เรียงจากที่น่าห่วงที่สุด */
export default function CanalStrip({ stations = [], observedAt = null, loading = false }) {
  const sorted = sortCanals(stations);
  const worst = sorted[0] ? canalState(sorted[0]) : null;
  const latest = stations.map((item) => item.observedAt).filter(Boolean).sort().pop() || observedAt;

  return (
    <section aria-labelledby="canal-title" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="canal-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">น้ำในคลองตอนนี้</h2>
          <p className="mt-1 text-[1.05rem] text-slate-700">
            {loading ? "กำลังอ่านค่าจากสถานีวัดระดับน้ำ…" : (
              <>
                <span className="font-semibold" style={{ color: worst && worst.rank >= 2 ? worst.tone : undefined }}>{canalSummary(stations)}</span>
                {latest ? <span className="text-slate-500"> • ThaiWater (สสน.) {timeText(latest)} น.</span> : null}
              </>
            )}
          </p>
        </div>
        <Link href="/public/disaster-map" className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">
          ดูบนแผนที่สถานการณ์ <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-3xl bg-white" />
      ) : sorted.length > 0 ? (
        <ul className="-mx-4 mt-4 flex snap-x gap-3 overflow-x-auto px-4 pb-3 [scrollbar-width:thin] sm:mx-0 sm:px-0">
          {sorted.map((station, index) => {
            const state = canalState(station);
            return (
              <li
                key={station.id}
                className="flex w-[15.5rem] shrink-0 snap-start gap-3 rounded-3xl bg-white p-4 ring-1 ring-[#d6e3ea]"
                style={state.rank >= 2 ? { boxShadow: `inset 0 0 0 2px ${state.tone}` } : undefined}
              >
                <Gauge state={state} delay={index * 90} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-[family-name:var(--font-kanit)] text-lg font-semibold leading-tight text-[#0c2f4a]">{station.name}</p>
                  <p className="truncate text-xs text-slate-500">{[station.river, station.amphoe && `อ.${station.amphoe}`].filter(Boolean).join(" • ")}</p>
                  <p className="mt-2 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-none" style={{ color: state.tone }}>
                    {state.diff === null ? "–" : `${state.diff > 0 ? "+" : ""}${state.diff.toFixed(2)}`}
                    <span className="ml-1 text-sm font-semibold text-slate-500">ม.</span>
                  </p>
                  <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                    <span className="rounded-full px-2 py-0.5 font-bold" style={{ backgroundColor: state.soft, color: state.tone }}>{state.label}</span>
                    {station.trend?.label ? (
                      <span className={`font-semibold ${station.trend.value === "rising" ? "canal-rising text-[#c2410c]" : "text-slate-500"}`}>
                        {station.trend.arrow} {station.trend.label}
                      </span>
                    ) : null}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="mt-4 rounded-3xl bg-white p-5 text-slate-600">ยังไม่มีข้อมูลจากสถานีวัดระดับน้ำ ลองใหม่อีกครั้งภายหลัง</p>
      )}
      <p className="mt-1 text-xs text-slate-500">ตัวเลข = ระยะจากระดับน้ำถึงตลิ่ง (ติดลบ = ยังต่ำกว่าตลิ่ง) • เส้นประในเกจคือระดับตลิ่ง</p>

      <style>{`
        .canal-gauge__water { transform-origin: bottom; animation: canal-fill 1.1s cubic-bezier(.2,.8,.2,1) both; }
        @keyframes canal-fill { from { transform: scaleY(0); } }
        .canal-gauge__wave {
          background: radial-gradient(circle at 6px -2px, transparent 6px, rgba(255,255,255,.55) 6.5px, rgba(255,255,255,.55) 7.5px, transparent 8px) 0 0 / 12px 12px repeat-x;
          animation: canal-wave 2.2s linear infinite;
        }
        @keyframes canal-wave { to { transform: translateX(-50%); } }
        .canal-rising { display: inline-block; animation: canal-rise 1.6s ease-in-out infinite; }
        @keyframes canal-rise { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-2px); } }
        @media (prefers-reduced-motion: reduce) { .canal-gauge__water, .canal-gauge__wave, .canal-rising { animation: none; } }
      `}</style>
    </section>
  );
}
