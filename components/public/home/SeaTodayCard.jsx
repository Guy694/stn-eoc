"use client";

// น้ำทะเลหนุนวันนี้ (หน้าแรก) — สำหรับชุมชนชายฝั่ง ชาวประมง และคนริมคลองใกล้ปากน้ำ
import { useEffect, useState } from "react";
import Link from "next/link";
import { Waves } from "lucide-react";
import { SEA_STATUS } from "@/lib/seaLevel";

const timeText = (iso) => new Date(iso).toLocaleString("th-TH", { weekday: "short", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });

export default function SeaTodayCard({ className = "" }) {
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
  if (!sea) return null;

  const status = sea.status;
  const alert = status.key !== "normal";
  const highs = (sea.next_highs || []).filter((h) => Date.parse(h.at) > sea.loadedAt - 30 * 60e3).slice(0, 2);
  return (
    <section className={`rounded-3xl border p-5 ${alert ? "border-amber-300 bg-amber-50" : "border-[#cfe0ea] bg-white"} ${className}`} aria-labelledby="sea-today-title">
      <div className="flex items-start justify-between gap-3">
        <h3 id="sea-today-title" className="flex items-center gap-2 font-[family-name:var(--font-kanit)] text-lg font-semibold text-[#0c2f4a]">
          <Waves className="h-5 w-5 text-[#2a9db0]" aria-hidden="true" />น้ำทะเลหน้าเมืองสตูล
        </h3>
        <span className="shrink-0 rounded-full px-3 py-1 text-sm font-bold" style={{ backgroundColor: status.color, color: status.text }}>{status.label}</span>
      </div>
      <p className="mt-1 text-[15px] text-slate-700">
        ตอนนี้ {Number(sea.level).toFixed(2)} ม. (รทก.){sea.trend?.label ? ` • ${sea.trend.arrow || ""} ${sea.trend.label}` : ""}{sea.phase?.key === "spring" ? " • ช่วงน้ำเกิด" : ""}
      </p>
      {highs.length ? (
        <ul className="mt-3 grid grid-cols-2 gap-2">
          {highs.map((h) => {
            const s = SEA_STATUS[h.status] || SEA_STATUS.normal;
            return (
              <li key={h.at} className="rounded-2xl bg-white/80 px-3 py-2 ring-1 ring-slate-200">
                <span className="block text-xs text-slate-500">น้ำขึ้นสูงสุด {timeText(h.at)} น.</span>
                <span className="block font-[family-name:var(--font-kanit)] text-xl font-bold text-[#0c2f4a]">{Number(h.est_level).toFixed(2)} ม.</span>
                <span className="text-xs font-semibold" style={{ color: h.status === "normal" ? "#0f766e" : s.color }}>{s.label}</span>
              </li>
            );
          })}
        </ul>
      ) : null}
      {alert ? <p className="mt-3 text-[15px] leading-7 text-amber-950">{status.advice}</p> : null}
      <Link href="/public/weather-watch" className="mt-3 inline-block text-[15px] font-semibold text-[#11466e] underline-offset-4 hover:underline">ดูภาพจำลองน้ำขึ้น-ลง 7 วัน</Link>
    </section>
  );
}
