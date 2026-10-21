"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, ChevronDown } from "lucide-react";
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

// แนวโน้ม 24 ชม. จากค่าที่ระบบบันทึกทุกชั่วโมง (+ ค่าล่าสุดของสถานี) — เส้นประ = ตลิ่ง (แสดงเมื่ออยู่ใกล้ช่วงของกราฟ)
const SPARK_W = 112;
const SPARK_H = 48;
export function sparkPoints(history = [], station = null) {
  const points = history.map((p) => ({ t: Date.parse(`${p.t.replace(" ", "T")}+07:00`), level: Number(p.level) }))
    .filter((p) => Number.isFinite(p.t) && Number.isFinite(p.level));
  const now = Date.parse(station?.observedAt || "");
  if (Number.isFinite(now) && Number.isFinite(Number(station?.waterLevelMsl)) && (!points.length || now > points.at(-1).t)) {
    points.push({ t: now, level: Number(station.waterLevelMsl) });
  }
  return points.sort((a, b) => a.t - b.t);
}

function Sparkline({ station, history }) {
  const points = sparkPoints(history, station);
  if (points.length < 3) {
    return <p className="w-28 shrink-0 self-center text-right text-[11px] leading-4 text-slate-400">กำลังสะสมข้อมูล<br />แนวโน้ม 24 ชม.</p>;
  }
  const levels = points.map((p) => p.level);
  let min = Math.min(...levels);
  let max = Math.max(...levels);
  const bank = Number(station.bankLevelMsl);
  const showBank = Number.isFinite(bank) && bank <= max + 0.6;
  if (showBank) max = Math.max(max, bank);
  const pad = Math.max((max - min) * 0.15, 0.05);
  min -= pad;
  max += pad;
  const t0 = points[0].t;
  const span = Math.max(points.at(-1).t - t0, 1);
  const x = (t) => ((t - t0) / span) * (SPARK_W - 4) + 2;
  const y = (v) => SPARK_H - 2 - ((v - min) / (max - min)) * (SPARK_H - 4);
  const line = points.map((p) => `${x(p.t).toFixed(1)},${y(p.level).toFixed(1)}`).join(" ");
  const change = points.at(-1).level - points[0].level;
  const tone = change > 0.02 ? "#c2410c" : change < -0.02 ? "#0f766e" : "#64748b";
  const hours = Math.round(span / 3600000);
  const last = points.at(-1);
  return (
    <figure className="w-28 shrink-0 self-center" aria-label={`แนวโน้ม ${hours} ชม. ${change >= 0 ? "เพิ่มขึ้น" : "ลดลง"} ${Math.abs(change).toFixed(2)} เมตร`}>
      <svg viewBox={`0 0 ${SPARK_W} ${SPARK_H}`} className="h-12 w-28 overflow-visible" aria-hidden="true">
        {showBank ? <line x1="0" x2={SPARK_W} y1={y(bank)} y2={y(bank)} stroke="#0c2f4a" strokeOpacity=".55" strokeWidth="1" strokeDasharray="3 3" /> : null}
        <polygon points={`${x(t0).toFixed(1)},${SPARK_H} ${line} ${x(last.t).toFixed(1)},${SPARK_H}`} fill={tone} fillOpacity=".1" />
        <polyline points={line} fill="none" stroke={tone} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(last.t)} cy={y(last.level)} r="2.8" fill={tone} stroke="#fff" strokeWidth="1.2" />
      </svg>
      <figcaption className="mt-0.5 text-right text-[11px] leading-4 text-slate-500">
        {hours} ชม. <b className="font-semibold tabular-nums" style={{ color: tone }}>{change > 0 ? "+" : ""}{change.toFixed(2)} ม.</b>
      </figcaption>
    </figure>
  );
}

/** "น้ำในคลองตอนนี้": สถานีวัดระดับน้ำ ThaiWater ในสตูล เรียงจากที่น่าห่วงที่สุด */
// จำนวนสถานีที่แสดงก่อนกด "ดูทั้งหมด" (เรียงจากน่าห่วงที่สุด จึงไม่พลาดสถานีสำคัญ)
const INITIAL_COUNT = 6;

export default function CanalStrip({ stations = [], observedAt = null, loading = false, history = {} }) {
  const [expanded, setExpanded] = useState(false);
  const sorted = sortCanals(stations);
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_COUNT);
  const hiddenCount = sorted.length - visible.length;
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
        <>
        <ul className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((station, index) => {
            const state = canalState(station);
            return (
              <li
                key={station.id}
                className="flex gap-3 rounded-3xl bg-white p-4 ring-1 ring-[#d6e3ea]"
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
                <Sparkline station={station} history={history[station.id] || []} />
              </li>
            );
          })}
        </ul>
        {sorted.length > INITIAL_COUNT ? (
          <button
            type="button"
            onClick={() => setExpanded((value) => !value)}
            aria-expanded={expanded}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-3 text-[15px] font-semibold text-[#11466e] ring-1 ring-[#d6e3ea] hover:bg-[#f2f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11466e]"
          >
            {expanded ? "แสดงน้อยลง" : `ดูทั้งหมด (อีก ${hiddenCount} สถานี)`}
            <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
          </button>
        ) : null}
        </>
      ) : (
        <p className="mt-4 rounded-3xl bg-white p-5 text-slate-600">ยังไม่มีข้อมูลจากสถานีวัดระดับน้ำ ลองใหม่อีกครั้งภายหลัง</p>
      )}
      <p className="mt-2 text-xs text-slate-500">ตัวเลข = ระยะจากระดับน้ำถึงตลิ่ง (ติดลบ = ยังต่ำกว่าตลิ่ง) • เส้นประในเกจคือระดับตลิ่ง • กราฟเล็กด้านขวา = ระดับน้ำ 24 ชม.ล่าสุด (ส้ม = ขึ้น, เขียว = ลง)</p>

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
