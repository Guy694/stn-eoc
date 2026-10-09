"use client";

// พยากรณ์จุดเสี่ยงน้ำท่วม 7 วันของตำบล (ฉบับประชาชน)
import { useState } from "react";
import { CalendarDays, CloudRain, Waves } from "lucide-react";
import { RISK_META } from "@/lib/weatherRiskConfig";

const SHORT = { normal: "ปกติ", watch: "เฝ้าระวัง", high: "เสี่ยงสูง", critical: "วิกฤต" };
const ADVICE = {
  watch: "ติดตามข่าว เตรียมยกของขึ้นที่สูง ชาร์จโทรศัพท์ให้เต็ม",
  high: "ยกของขึ้นที่สูง เตรียมกระเป๋ายา/เอกสาร ดูทางไปศูนย์พักพิงไว้ล่วงหน้า",
  critical: "เตรียมอพยพ โดยเฉพาะผู้สูงอายุ เด็ก ผู้ป่วยติดเตียง ทำตามประกาศของหน่วยงานทันที"
};
const WEEKDAY = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
const dayName = (date, i) => {
  if (i === 0) return "วันนี้";
  if (i === 1) return "พรุ่งนี้";
  const d = new Date(`${date}T12:00:00Z`);
  return `${WEEKDAY[d.getUTCDay()]} ${d.getUTCDate()}`;
};

export default function FloodOutlookCard({ outlook }) {
  const firstRisky = outlook.days.findIndex((d) => d.level !== "normal");
  const [selected, setSelected] = useState(firstRisky >= 0 ? firstRisky : 0);
  const day = outlook.days[selected];
  const meta = RISK_META[day?.level] || RISK_META.normal;
  const allNormal = firstRisky < 0;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5" aria-labelledby="outlook-title">
      <h2 id="outlook-title" className="flex items-center gap-2 font-bold text-slate-900">
        <CalendarDays className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" />
        เสี่ยงน้ำท่วม 7 วันข้างหน้า • ต.{outlook.tambon}
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        {allNormal
          ? "7 วันข้างหน้ายังไม่พบสัญญาณน้ำท่วมในตำบลนี้ จากฝนพยากรณ์ น้ำในคลอง และน้ำทะเลหนุน"
          : `ระวังวัน${dayName(outlook.days[firstRisky].date, firstRisky)} — ${SHORT[outlook.worst?.level || outlook.days[firstRisky].level]}`}
      </p>

      <ol className="mt-3 grid grid-cols-7 gap-1" aria-label="ระดับความเสี่ยงรายวัน">
        {outlook.days.map((d, i) => {
          const m = RISK_META[d.level] || RISK_META.normal;
          const active = i === selected;
          return (
            <li key={d.date}>
              <button type="button" onClick={() => setSelected(i)} aria-pressed={active}
                aria-label={`${dayName(d.date, i)}: ${SHORT[d.level]} ฝนราว ${d.rain24} มม.`}
                className={`flex w-full flex-col items-center gap-1 rounded-xl px-0.5 py-1.5 text-center ${active ? "bg-slate-100 ring-2 ring-[#0b4c86]" : "hover:bg-slate-50"}`}>
                <span className="text-[11px] font-semibold leading-tight text-slate-600">{dayName(d.date, i)}</span>
                <span className="h-2.5 w-full max-w-9 rounded-full" style={{ backgroundColor: d.level === "normal" ? "#cbd5e1" : m.color }} />
                <span className="text-[11px] tabular-nums text-slate-500">{d.rain24} มม.</span>
              </button>
            </li>
          );
        })}
      </ol>

      {day ? (
        <div className="mt-3 rounded-xl bg-slate-50 p-3 text-sm">
          <p className="font-bold" style={{ color: day.level === "normal" ? "#334155" : meta.color }}>
            {dayName(day.date, selected)}: {SHORT[day.level]}
          </p>
          {day.reasons.length ? (
            <ul className="mt-1 space-y-0.5 text-slate-700">
              {day.reasons.map((r) => <li key={r}>• {r}</li>)}
            </ul>
          ) : (
            <p className="mt-1 flex flex-wrap gap-x-3 text-slate-600">
              <span><CloudRain className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />ฝนราว {day.rain24} มม.</span>
              {outlook.coastal ? <span><Waves className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />น้ำทะเล{day.sea === "normal" ? "ปกติ" : "หนุน"}</span> : null}
            </p>
          )}
          {ADVICE[day.level] ? <p className="mt-2 font-semibold text-slate-800">ควรทำ: {ADVICE[day.level]}</p> : null}
        </div>
      ) : null}
      <p className="mt-2 text-xs leading-5 text-slate-500">
        เป็นการคาดการณ์ล่วงหน้าจากแบบจำลอง อาจคลาดเคลื่อน{outlook.calibrated ? " (ปรับเกณฑ์จากเหตุการณ์น้ำท่วมจริงของสตูลแล้ว)" : ""} — ให้ยึดประกาศของหน่วยงานเป็นหลัก
      </p>
    </section>
  );
}
