"use client";

// น้ำทะเลหนุนวันนี้ (หน้าแรก) — สำหรับชุมชนชายฝั่ง ชาวประมง และคนริมคลองใกล้ปากน้ำ
import { useEffect, useState } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { SEA_STATUS } from "@/lib/seaLevel";
import { freshness } from "@/lib/dataFreshness";
import FreshnessTag, { useNow } from "@/components/common/FreshnessTag";

const timeText = (iso) => new Date(iso).toLocaleString("th-TH", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

// layout="wide": แถบเต็มความกว้าง (ใต้ "น้ำในคลองตอนนี้") — ซ้ายสถานะ/คำแนะนำ ขวาเวลาน้ำขึ้นสูงสุด
export default function SeaTodayCard({ className = "", layout = "card" }) {
  const [sea, setSea] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => fetch("/stn-eoc/api/public/sea-level/", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => { if (alive && json?.status) setSea({ ...json, loadedAt: Date.now() }); })
      .catch(() => {});
    load();
    const timer = setInterval(load, 10 * 60 * 1000);
    return () => { alive = false; clearInterval(timer); };
  }, []);
  const now = useNow();
  if (!sea) return null;
  // มีค่าวัดจริง → ตรวจความสด / มีแต่ค่าพยากรณ์ → ไม่ขึ้นป้าย
  const fresh = freshness(sea.observed?.observed_at, "sea", now);

  const status = sea.status;
  const alert = status.key !== "normal";
  const highs = (sea.next_highs || []).filter((h) => Date.parse(h.at) > sea.loadedAt - 30 * 60e3).slice(0, 2);
  const wide = layout === "wide";
  const highList = highs.length ? (
    <ul className={wide ? "grid grid-cols-2 gap-2 md:flex md:gap-3" : "mt-3 grid grid-cols-2 gap-2"}>
      {highs.map((h) => {
        const s = SEA_STATUS[h.status] || SEA_STATUS.normal;
        return (
          <li key={h.at} className={`rounded-2xl bg-white/85 px-3 py-2 ring-1 ring-white/60 backdrop-blur-sm ${wide ? "md:min-w-[10.5rem]" : ""}`}>
            <span className="block text-xs text-slate-500">น้ำขึ้นสูงสุด {timeText(h.at)} น.</span>
            <span className="block font-[family-name:var(--font-kanit)] text-xl font-bold text-[#0c2f4a]">{Number(h.est_level).toFixed(2)} ม.</span>
            <span className="text-xs font-semibold" style={{ color: h.status === "normal" ? "#0f766e" : s.color }}>{s.label}</span>
          </li>
        );
      })}
    </ul>
  ) : null;
  const Heading = wide ? "h2" : "h3";
  // พื้นหลัง: น้ำปกติ = ทะเลสงบ (low wave) · น้ำหนุน (เฝ้าระวังขึ้นไป) = ทะเลมืดคลื่นแรง (high wave) ตัวอักษรเป็นสีขาว
  const dark = alert;
  return (
    <section data-stale={fresh.stale ? "1" : undefined} data-sea={dark ? "high" : "low"}
      className={`sea-card relative isolate overflow-hidden rounded-3xl border p-5 ${dark ? "sea-card--high border-[#1d4e66] text-white" : "sea-card--low border-[#cfe0ea]"} ${fresh.stale ? "grayscale-[.6]" : ""} ${wide ? "md:grid md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-6 md:py-7" : ""} ${className}`} aria-labelledby="sea-today-title">
      <style>{`
        .sea-card { background-size: cover; background-position: center 62%; }
        .sea-card--low { background-image: linear-gradient(90deg, rgba(255,255,255,.88) 0%, rgba(255,255,255,.6) 45%, rgba(255,255,255,.1) 80%), url(/stn-eoc/img/sea-low-wave-800.webp); }
        .sea-card--high { background-image: linear-gradient(90deg, rgba(6,25,42,.82) 0%, rgba(6,25,42,.5) 50%, rgba(6,25,42,.15) 85%), url(/stn-eoc/img/sea-high-wave-800.webp); }
        @media (min-width: 768px) {
          .sea-card--low { background-image: linear-gradient(90deg, rgba(255,255,255,.88) 0%, rgba(255,255,255,.6) 45%, rgba(255,255,255,.1) 80%), url(/stn-eoc/img/sea-low-wave-1600.webp); }
          .sea-card--high { background-image: linear-gradient(90deg, rgba(6,25,42,.82) 0%, rgba(6,25,42,.5) 50%, rgba(6,25,42,.15) 85%), url(/stn-eoc/img/sea-high-wave-1600.webp); }
        }
      `}</style>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-3 md:justify-start">
          <Heading id="sea-today-title" className={`flex items-center gap-2 font-[family-name:var(--font-kanit)] text-lg font-semibold ${dark ? "text-white" : "text-[#0c2f4a]"}`}>
            <Waves className={`h-5 w-5 ${dark ? "text-[#7fd3df]" : "text-[#2a9db0]"}`} aria-hidden="true" />น้ำทะเลหนุน หน้าเมืองสตูล
          </Heading>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${fresh.stale ? "opacity-70 grayscale" : ""}`} style={{ backgroundColor: status.color, color: status.text }}>{status.label}</span>
        </div>
        <p className={`mt-1 text-[15px] ${dark ? "text-[#d5e7ec]" : "text-slate-700"}`}>
          ตอนนี้ {Number(sea.level).toFixed(2)} ม. (รทก.){sea.trend?.label ? ` • ${sea.trend.arrow || ""} ${sea.trend.label}` : ""}{sea.phase?.key === "spring" ? " • ช่วงน้ำเกิด" : ""}
          {fresh.known ? <> <FreshnessTag info={fresh} tone={dark ? "dark" : "light"} className="text-sm" /></> : null}
        </p>
        {alert ? <p className="mt-2 max-w-xl text-[15px] leading-7 text-amber-100">{status.advice}</p> : null}
        <Link href="/public/weather-watch" className={`mt-2 inline-block text-[15px] font-semibold underline-offset-4 hover:underline ${dark ? "text-[#9fd8e6]" : "text-[#11466e]"}`}>ดูภาพจำลองน้ำขึ้น-ลง 7 วัน</Link>
      </div>
      {wide && highList ? <div className="mt-3 md:mt-0">{highList}</div> : highList}
    </section>
  );
}
