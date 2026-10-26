"use client";

// "น้ำในคลองตอนนี้": สถานีวัดระดับน้ำของ ปภ. (กล้อง CCTV + เซนเซอร์) ในสตูล — สถานะตามเกณฑ์ของ ปภ. ให้ตรงกับเว็บ ปภ. และ อบจ.สตูล
import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Camera, ChevronDown } from "lucide-react";
import { DPM_STATUS, dpmStatus, dpmSummary, dpmTrend, gaugeScale, nextThreshold, sortDpmStations } from "@/lib/dpmCanals";
import { freshness, latestTime } from "@/lib/dataFreshness";
import FreshnessTag, { useNow } from "@/components/common/FreshnessTag";
import { Sparkline } from "@/components/public/home/CanalStrip";
import DpmStationDialog from "@/components/weather/DpmStationDialog";

const INITIAL_COUNT = 6;
const fmt = (value) => Number(value).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function Gauge({ station, status, delay = 0 }) {
  const { fill, danger } = gaugeScale(station);
  return (
    <div className="relative h-[5.5rem] w-7 shrink-0 overflow-hidden rounded-full bg-[#dbe8ee] ring-1 ring-[#c4d7e0]" aria-hidden="true">
      {fill !== null ? (
        <div className="canal-gauge__water absolute inset-x-0 bottom-0 overflow-hidden rounded-b-full" style={{ height: `${fill * 100}%`, backgroundColor: status.tone, animationDelay: `${delay}ms` }}>
          <span className="canal-gauge__wave absolute -top-1.5 left-0 h-3 w-[200%]" />
        </div>
      ) : null}
      {danger !== null ? <div className="absolute inset-x-0 border-t-2 border-dashed border-[#0c2f4a]/70" style={{ bottom: `${danger * 100}%` }} /> : null}
    </div>
  );
}

export default function DpmCanalStrip({ stations = [], observedAt = null, loading = false, history = {} }) {
  const [expanded, setExpanded] = useState(false);
  const [selected, setSelected] = useState(null);
  const sorted = sortDpmStations(stations);
  const visible = expanded ? sorted : sorted.slice(0, INITIAL_COUNT);
  const worst = sorted[0] ? dpmStatus(sorted[0]) : null;
  const now = useNow();
  const latest = latestTime(stations.map((item) => item.observedAt)) ?? latestTime([observedAt]);
  const fresh = freshness(latest, "water", now);

  return (
    <section aria-labelledby="canal-title" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="canal-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">น้ำในคลองตอนนี้</h2>
          <p className="mt-1 text-[1.05rem] text-slate-700">
            {loading ? "กำลังอ่านค่าจากสถานีวัดระดับน้ำ…" : (
              <>
                <span className="font-semibold" style={{ color: worst && worst.rank >= 2 && !fresh.stale ? worst.tone : undefined }}>{dpmSummary(stations)}</span>
                {fresh.known ? <span className="text-slate-500"> • สถานีวัดระดับน้ำ ปภ. </span> : null}
                <FreshnessTag info={fresh} className="text-[0.95rem]" />
              </>
            )}
          </p>
        </div>
        <Link href="/public/water-trends" className="inline-flex items-center gap-1 text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">
          ดูแนวโน้มระดับน้ำและฝน <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {loading ? (
        <div className="mt-4 h-32 animate-pulse rounded-3xl bg-white" />
      ) : sorted.length > 0 ? (
        <>
          <ul className={`mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 ${fresh.stale ? "opacity-75 grayscale" : ""}`} data-stale={fresh.stale ? "1" : undefined}>
            {visible.map((station, index) => {
              const status = dpmStatus(station);
              const next = nextThreshold(station);
              const points = history[station.code] || [];
              const trend = dpmTrend(points, station);
              return (
                <li key={station.code}>
                <button type="button" onClick={() => setSelected(station)} aria-label={`ดูข้อมูล กล้อง และระดับน้ำ ${station.name}`}
                  className="flex h-full w-full gap-3 rounded-3xl bg-white p-4 text-left ring-1 ring-[#d6e3ea] transition hover:ring-[#9fc9d6] hover:shadow-[0_12px_28px_-20px_rgba(12,47,74,.7)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11466e]"
                  style={status.rank >= 2 ? { boxShadow: `inset 0 0 0 2px ${status.tone}` } : undefined}>
                  <Gauge station={station} status={status} delay={index * 90} />
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words font-[family-name:var(--font-kanit)] text-[1.05rem] font-semibold leading-snug text-[#0c2f4a]" title={`${station.code} ${station.name}`}><span className="mr-1 text-sm font-bold text-slate-500">{station.code}</span>{station.name}</p>
                    <p className="truncate text-xs text-slate-500">{[station.river, station.amphoe && `อ.${station.amphoe}`].filter(Boolean).join(" • ") || station.code}</p>
                    <p className="mt-2 font-[family-name:var(--font-kanit)] text-2xl font-bold leading-none" style={{ color: status.tone }}>
                      {station.level === null ? "–" : fmt(station.level)}
                      <span className="ml-1 text-sm font-semibold text-slate-500">ม.</span>
                    </p>
                    <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                      <span className="rounded-full px-2 py-0.5 font-bold" style={{ backgroundColor: status.soft, color: status.tone }}>{status.label}</span>
                      {trend ? <span className={`font-semibold ${trend.value === "rising" ? "canal-rising text-[#c2410c]" : "text-slate-500"}`}>{trend.arrow} {trend.label}</span> : null}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-[#e3f1f4] px-2.5 py-1 text-xs font-bold text-[#11466e]" aria-hidden="true">
                      ดูภาพสด CCTA  <Camera className="h-3.5 w-3.5" />
                    </span>
                    {next ? <p className="mt-1 text-[11px] text-slate-500">อีก {fmt(next.gap)} ม. ถึงเกณฑ์{next.label}</p> : null}
                    {station.level === null ? <p className="mt-1 text-[11px] text-slate-500">สถานีไม่ได้ส่งค่าระดับน้ำขณะนี้</p> : null}
                  </div>
                  {station.level !== null ? (
                    <Sparkline station={{ observedAt: station.observedAt, waterLevelMsl: station.level, bankLevelMsl: station.thresholds?.danger }} history={points} />
                  ) : null}
                </button>
                </li>
              );
            })}
          </ul>
          {sorted.length > INITIAL_COUNT ? (
            <button type="button" onClick={() => setExpanded((value) => !value)} aria-expanded={expanded}
              className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-2xl bg-white px-4 py-3 text-[15px] font-semibold text-[#11466e] ring-1 ring-[#d6e3ea] hover:bg-[#f2f7fa] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#11466e]">
              {expanded ? "แสดงน้อยลง" : `ดูทั้งหมด (อีก ${sorted.length - visible.length} สถานี)`}
              <ChevronDown className={`h-4 w-4 transition-transform ${expanded ? "rotate-180" : ""}`} aria-hidden="true" />
            </button>
          ) : null}
        </>
      ) : (
        <p className="mt-4 rounded-3xl bg-white p-5 text-slate-600">ยังไม่มีข้อมูลจากสถานีวัดระดับน้ำ ลองใหม่อีกครั้งภายหลัง</p>
      )}
      <p className="mt-2 text-xs text-slate-500">
        ตัวเลข = ระดับน้ำที่สถานีวัดได้ (ม.) • สถานะตามเกณฑ์ของ ปภ. แต่ละสถานี: {[1, 2, 3, 4, 5].map((code) => DPM_STATUS[code].label).join(" → ")} • เส้นประในเกจ = เกณฑ์อันตราย • กราฟเล็ก = ระดับน้ำ 24 ชม.ล่าสุด
        • แตะการ์ดเพื่อดูภาพกล้อง CCTV และรายละเอียด • ข้อมูลจากกรมป้องกันและบรรเทาสาธารณภัย (cctv.disaster.go.th)
      </p>
      <DpmStationDialog station={selected} history={selected ? history[selected.code] || [] : []} open={Boolean(selected)} onClose={() => setSelected(null)} />

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
