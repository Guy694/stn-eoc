"use client";

import { PM25_LEVELS, PM25_UNIT, pm25ForDistrict, pm25Level } from "@/lib/pm25";

// การ์ดฝุ่น PM2.5 ในแผงซ้ายของหน้าพยากรณ์และความเสี่ยง (ธีมกระจกเข้ม)
const BAR_MAX = 75; // เต็มแถบ = เริ่มระดับ "มีผลต่อสุขภาพ"

function timeText(value) {
  if (!value) return "";
  try {
    return new Date(value).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Bangkok" });
  } catch {
    return "";
  }
}

export function Pm25Dot({ value, className = "h-2.5 w-2.5" }) {
  const level = pm25Level(value);
  return <span className={`inline-block shrink-0 rounded-full ${className}`} style={{ backgroundColor: level?.color || "#94a3b8" }} aria-hidden="true" />;
}

export function Pm25Legend() {
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="font-black text-white/80">PM2.5 ({PM25_UNIT})</span>
      {PM25_LEVELS.map((level, index) => (
        <span key={level.key} className="flex items-center gap-1 font-bold">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: level.color }} aria-hidden="true" />
          {level.label}
          <span className="font-normal text-white/60">
            {index === 0 ? `0–${level.max}` : Number.isFinite(level.max) ? `${PM25_LEVELS[index - 1].max}–${level.max}` : `>${PM25_LEVELS[index - 1].max}`}
          </span>
        </span>
      ))}
    </div>
  );
}

export default function Pm25Card({ data, error, districtName, onShowMap }) {
  if (error && !data) {
    return (
      <div className="rounded-xl bg-white/5 p-3 text-[12px] text-white/70 ring-1 ring-white/10">
        <p className="text-xs font-black text-white/70">ฝุ่น PM2.5</p>
        <p className="mt-1">{error}</p>
      </div>
    );
  }
  if (!data) {
    return <div className="h-28 animate-pulse rounded-xl bg-white/5 ring-1 ring-white/10" aria-label="กำลังโหลดข้อมูลฝุ่น PM2.5" />;
  }

  const here = pm25ForDistrict(data, districtName);
  const level = pm25Level(here?.value);
  const avgLevel = pm25Level(here?.avg24);
  const scopeLabel = here?.scope === "district" ? `อ.${districtName}` : "จ.สตูล";

  return (
    <section className="overflow-hidden rounded-xl ring-1 ring-white/10" aria-label={`ฝุ่น PM2.5 ${scopeLabel}`}>
      <div className="p-3" style={{ background: level ? `linear-gradient(135deg, ${level.color}40, ${level.color}10 70%)` : undefined }}>
        <p className="flex flex-wrap items-center gap-1.5 text-xs font-black text-white/70">
          ฝุ่น PM2.5 • {scopeLabel}
          <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-bold text-white/75">GISTDA</span>
          {data.stale ? <span className="rounded bg-amber-400/90 px-1.5 py-0.5 text-[10px] font-bold text-slate-900">ข้อมูลเก่า</span> : null}
        </p>
        <div className="mt-1.5 flex items-end justify-between gap-3">
          <p className="leading-none">
            <span className="font-[family-name:var(--font-kanit)] text-[2.6rem] font-semibold tabular-nums">{here?.value ?? "-"}</span>
            <span className="ml-1 text-xs font-bold text-white/70">{PM25_UNIT}</span>
          </p>
          {level ? (
            <span className="mb-1 rounded-full px-3 py-1 text-[13px] font-black" style={{ backgroundColor: level.color, color: level.text }}>
              {level.label}
            </span>
          ) : null}
        </div>
        <p className="mt-1.5 text-[11px] text-white/70">
          ค่าประมาณ ณ {timeText(here?.observed_at) || "-"} น.
          {here?.avg24 !== null && here?.avg24 !== undefined ? ` • เฉลี่ย 24 ชม. ${here.avg24} (${avgLevel?.label || "-"})` : ""}
        </p>
        {level ? <p className="mt-2 text-[12.5px] font-semibold leading-snug text-white/90">{level.advice}</p> : null}
      </div>

      {data.districts?.length > 0 ? (
        <div className="border-t border-white/10 bg-black/10 px-3 py-2.5">
          <div className="flex items-center justify-between gap-2">
            <p className="text-[11px] font-black text-white/65">รายอำเภอ (ค่าล่าสุด)</p>
            {onShowMap ? (
              <button type="button" onClick={onShowMap} className="rounded-full bg-white/10 px-2 py-0.5 text-[11px] font-bold text-white/85 hover:bg-white/20">
                ดูบนแผนที่
              </button>
            ) : null}
          </div>
          <ul className="mt-1.5 space-y-1">
            {data.districts.map((item) => {
              const itemLevel = pm25Level(item.value);
              const active = here?.scope === "district" && item.name === here.name;
              return (
                <li key={item.name} className="grid grid-cols-[4.75rem_1fr_2.25rem] items-center gap-2 text-[11.5px]">
                  <span className={`truncate ${active ? "font-black text-white" : "text-white/75"}`}>{item.name}</span>
                  <span className="h-1.5 overflow-hidden rounded-full bg-white/10" aria-hidden="true">
                    <span className="block h-full rounded-full" style={{ width: `${Math.min(100, (item.value / BAR_MAX) * 100)}%`, backgroundColor: itemLevel?.color }} />
                  </span>
                  <span className={`text-right tabular-nums ${active ? "font-black" : "font-semibold text-white/85"}`}>{item.value}</span>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      <p className="border-t border-white/10 px-3 py-2 text-[10.5px] leading-4 text-white/55">
        {data.province ? `ทั้งจังหวัด ${data.province.value} ${PM25_UNIT}` : ""}
        {data.rank ? ` • ฝุ่นมากเป็นอันดับ ${data.rank} จาก ${data.province_count} จังหวัด` : ""}
        {data.neighbors?.length ? ` • ${data.neighbors.map((item) => `${item.name} ${item.value}`).join(" • ")}` : ""}
        <br />
        ประมาณค่าจากดาวเทียมรายชั่วโมงโดย GISTDA ไม่ใช่สถานีตรวจวัดภาคพื้นดิน ระดับสีตามเกณฑ์กรมควบคุมมลพิษ
      </p>
    </section>
  );
}
