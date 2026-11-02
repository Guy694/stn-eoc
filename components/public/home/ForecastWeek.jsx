"use client";

// พยากรณ์อากาศ 7 วันของ "พื้นที่ของฉัน" บนหน้าแรก (ข้อมูลจาก /api/public/weather-watch?view=home → district.forecast_daily แบบย่อ)
// แต่ละวัน: ภาพสภาพอากาศ อุณหภูมิสูง/ต่ำ (ชดเชยแล้ว lib/forecastCalibration.js) ระดับฝน + โอกาสฝน (ECMWF Ensemble 51 ชุด)
// ไม่แสดงเป็นมิลลิเมตร: ทดสอบย้อนหลังที่สตูลพบว่าปริมาณฝนรายวันแทบไม่สัมพันธ์กับค่าจริง จึงบอกเป็นโอกาสแทน
// วันที่ 4–7 (index ≥ 3) แสดงเป็น "แนวโน้ม" สีจางกว่า
import Link from "next/link";
import { ArrowRight, Sun } from "lucide-react";
import WeatherIcon from "@/components/common/WeatherIcon";
import { uvLevel } from "@/lib/weatherHealth";

const HEAVY_CHIP_PCT = 20;
const OUTLOOK_FROM = 3;

/**
 * ระดับฝนของวัน จาก ECMWF Ensemble 51 ชุด
 * "โอกาสฝน" ใช้สัดส่วนชุดที่ให้ฝน ≥ 10.1 มม. (prob_moderate) ไม่ใช่ ≥ 1 มม.:
 * ทดสอบย้อนหลังที่สตูล (ส.ค.–พ.ย. 2569) แบบจำลองให้ฝน ≥ 1 มม. เกือบทุกวัน (92–99%) แต่ฝนตกจริง 36% ของวัน
 * เกณฑ์ 10 มม. ทำให้ความถี่ "มีฝน" ของแบบจำลอง (44–55%) ใกล้ความจริงที่สุด
 */
export function rainOutlook(day) {
  const raw = day?.prob_moderate;
  if (raw === null || raw === undefined || !Number.isFinite(Number(raw))) return { label: "ไม่มีข้อมูลฝน", pct: null, tone: "none" };
  const pct = Math.round(Number(raw));
  if (Number(day?.prob_heavy) >= 30) return { label: "อาจมีฝนหนัก", pct, tone: "heavy" };
  if (pct >= 50) return { label: "มีฝนหลายพื้นที่", pct, tone: "moderate" };
  if (pct >= 20) return { label: "มีฝนบางพื้นที่", pct, tone: "light" };
  return { label: "ฝนน้อย", pct, tone: "dry" };
}

const TONE_TEXT = {
  heavy: "text-amber-700",
  moderate: "text-[#1d4ed8]",
  light: "text-[#2f74e6]",
  dry: "text-emerald-700",
  none: "text-slate-500"
};

function dayLabel(value, index) {
  if (index === 0) return "วันนี้";
  if (index === 1) return "พรุ่งนี้";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH", { weekday: "short", timeZone: "Asia/Bangkok" });
}

function dateLabel(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleDateString("th-TH", { day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
}

export default function ForecastWeek({ district, loading = false }) {
  const days = (district?.forecast_daily || []).slice(0, 7);
  if (!loading && days.length === 0) return null;

  const uvAdvice = days.slice(0, 3).map((day) => uvLevel(day.uv_index_max)).find((level) => level?.advice);

  return (
    <section aria-labelledby="forecast-title" className="mx-auto max-w-6xl px-4 pt-12 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <h2 id="forecast-title" className="font-[family-name:var(--font-kanit)] text-2xl font-bold text-[#0c2f4a]">
            พยากรณ์อากาศ 7 วัน{district ? <span className="text-[#11466e]"> · อ.{district.district_name}</span> : null}
          </h2>
        </div>
       
      </div>

      {loading && days.length === 0 ? (
        <div className="mt-4 h-32 animate-pulse rounded-3xl bg-white sm:h-44" />
      ) : (
        <ol className="-mx-4 mt-4 flex snap-x snap-mandatory scroll-px-4 gap-2 overflow-x-auto sm:gap-2.5 px-4 pb-2 pt-1 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-4 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-7 [&::-webkit-scrollbar]:hidden" aria-label={`พยากรณ์ 7 วัน อำเภอ${district?.district_name || ""}`}>
          {days.map((day, index) => {
            const outlook = rainOutlook(day);
            const heavy = Number(day.prob_heavy) >= HEAVY_CHIP_PCT;
            const uv = uvLevel(day.uv_index_max);
            const today = index === 0;
            const trend = index >= OUTLOOK_FROM;
            return (
              <li key={day.forecast_datetime || index}
                className={`${today ? "fc-today " : ""}relative flex w-[5.25rem] shrink-0 snap-start flex-col items-center rounded-2xl px-1.5 pb-2 pt-2 text-center sm:w-auto sm:rounded-3xl sm:px-2 sm:pb-3 sm:pt-3 ${today ? "bg-[#0c2f4a] text-white shadow-[0_14px_30px_-18px_rgba(12,47,74,.9)]" : trend ? "border border-dashed border-[#c5d6df] bg-[#f4f8fa] text-[#0c2f4a]/80" : "bg-white text-[#0c2f4a] ring-1 ring-[#d6e3ea]"}`}>
                {trend ? <span className="absolute -top-2 rounded-full bg-[#e3edf2] px-1.5 py-px text-[9px] sm:px-2 sm:text-[10px] font-semibold text-slate-600">แนวโน้ม</span> : null}
                <p className="font-[family-name:var(--font-kanit)] text-[13px] font-semibold leading-tight sm:text-[15px]">{dayLabel(day.forecast_datetime, index)}</p>
                <p className={`text-[11px] sm:text-xs ${today ? "text-[#9fc9d6]" : "text-slate-500"}`}>{dateLabel(day.forecast_datetime)}</p>
                <WeatherIcon code={day.weather_code} text={day.weather_condition} className={`my-1 h-10 w-10 sm:my-1.5 sm:h-14 sm:w-14 ${trend ? "opacity-70 saturate-[.8]" : ""}`} />
                <p className={`hidden line-clamp-2 min-h-[2.25rem] text-xs leading-[1.15rem] sm:block ${today ? "text-[#d5e7ec]" : "text-slate-600"}`}>{day.weather_condition}</p>
                <p className="font-[family-name:var(--font-kanit)] tabular-nums sm:mt-1" aria-label={`สูงสุด ${day.temperature_max} องศา ต่ำสุด ${day.temperature_min} องศา`}>
                  <span className="text-base font-bold sm:text-lg">{day.temperature_max}°</span>
                  <span className={`ml-0.5 text-xs sm:ml-1 sm:text-sm ${today ? "text-[#9fc9d6]" : "text-slate-500"}`}>{day.temperature_min}°</span>
                </p>
                <p className={`mt-0.5 text-[11px] font-semibold leading-tight sm:text-xs ${today ? "text-[#7fd3df]" : TONE_TEXT[outlook.tone]}`}>{outlook.label}</p>
                {outlook.pct !== null ? (
                  <p className={`text-[10px] tabular-nums sm:text-[11px] ${today ? "text-[#9fc9d6]" : "text-slate-500"}`}><span className="hidden sm:inline">โอกาสฝน </span><span className="sm:hidden">ฝน </span>{outlook.pct}%</p>
                ) : null}
                {heavy ? (
                  <span className={`mt-1 rounded-full px-1.5 py-px text-[10px] font-bold sm:mt-1.5 sm:px-2 sm:py-0.5 sm:text-[11px] ${today ? "bg-amber-300 text-amber-950" : "bg-amber-100 text-amber-900"}`}>
                    ฝนหนัก {day.prob_heavy}%
                  </span>
                ) : null}
                {uv ? (
                  <span className="mt-1 rounded-full px-1.5 py-px text-[10px] font-bold sm:px-2 sm:text-[11px]" style={today ? { backgroundColor: uv.color, color: "#fff" } : { backgroundColor: `${uv.color}2e`, color: uv.text }} title={`ดัชนี UV สูงสุด ${day.uv_index_max} (${uv.label})`}>
                    UV {day.uv_index_max}
                  </span>
                ) : null}
              </li>
            );
          })}
        </ol>
      )}
      {uvAdvice ? (
        <p className="mt-2 flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-semibold sm:text-sm" style={{ backgroundColor: `${uvAdvice.color}1f`, color: uvAdvice.text }}>
          <Sun className="h-4 w-4 shrink-0" aria-hidden="true" /> UV {uvAdvice.label}: {uvAdvice.advice}
        </p>
      ) : null}
    </section>
  );
}
