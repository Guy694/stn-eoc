"use client";

// โครงหน้ากลางของระบบ (ธีมเดียวกับ "ภาพรวมสถานการณ์")
// - PageHero: หัวหน้าพื้นน้ำเงิน มีไอคอน ชื่อ คำอธิบาย ข้อมูลประกอบ ปุ่ม และช่องด้านขวา (aside)
// - Panel: กล่องขาวมีหัว (ไอคอน · ชื่อ · คำอธิบาย · ปุ่มขวา)
// - heroButtonClass / heroInputClass: ปุ่มและช่องกรอกบนพื้นน้ำเงิน
import AppIcon from "@/components/icons/AppIcon";

export const heroButtonClass = "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white/10 px-3 py-2 text-sm font-semibold text-white ring-1 ring-white/20 transition hover:bg-white/20 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60";
export const heroPrimaryButtonClass = "inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-sm font-semibold text-[#0b4c86] transition hover:bg-blue-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white disabled:opacity-60";
export const heroInputClass = "min-h-10 rounded-xl border-0 bg-white/10 px-3 py-2 text-sm font-medium text-white ring-1 ring-white/20 [color-scheme:dark] focus:outline-none focus:ring-2 focus:ring-white/60";

export function PageHero({ icon, eyebrow, title, subtitle, meta, actions, aside, titleId, className = "" }) {
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-[#0b4c86] p-5 font-[family-name:var(--font-kanit)] text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)] sm:p-6 ${className}`}>
      <div className="absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10" aria-hidden="true" />
      <div className="absolute -bottom-24 right-40 h-48 w-48 rounded-full bg-white/5" aria-hidden="true" />
      <div className={`relative grid gap-5 ${aside ? "lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-end" : ""}`}>
        <div className="min-w-0">
          <div className="flex items-start gap-3">
            {icon ? (
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20">
                <AppIcon icon={icon} className="h-5 w-5" />
              </span>
            ) : null}
            <div className="min-w-0">
              {eyebrow ? <p className="text-sm font-medium text-blue-100">{eyebrow}</p> : null}
              <h1 id={titleId} className="text-xl font-semibold leading-snug sm:text-2xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-sm text-blue-100">{subtitle}</p> : null}
            </div>
          </div>
          {meta ? <div className="mt-3 text-xs text-blue-100">{meta}</div> : null}
          {actions ? <div className="mt-4 flex flex-wrap items-center gap-2">{actions}</div> : null}
        </div>
        {aside ? <div className="min-w-0">{aside}</div> : null}
      </div>
    </div>
  );
}

/** ช่องสรุปด้านขวาของ PageHero: ชื่อ · ค่าใหญ่ · แถบความคืบหน้า · คำอธิบาย */
export function HeroProgress({ label, value, unit = "%", percent, note }) {
  const pct = Math.max(0, Math.min(100, Number(percent) || 0));
  return (
    <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/15">
      <span className="flex items-baseline justify-between gap-2">
        <span className="text-sm font-medium text-blue-100">{label}</span>
        <span className="text-3xl font-bold tabular-nums">{value}{unit ? <span className="ml-0.5 text-base font-medium text-blue-100">{unit}</span> : null}</span>
      </span>
      <span className="mt-2 block h-2 overflow-hidden rounded-full bg-white/15" aria-hidden="true">
        <span className={`block h-full rounded-full ${pct >= 80 ? "bg-emerald-400" : pct > 0 ? "bg-amber-300" : "bg-red-400"}`} style={{ width: `${pct}%` }} />
      </span>
      {note ? <span className="mt-2 block text-xs text-blue-100">{note}</span> : null}
    </div>
  );
}

export function Panel({ icon, title, subtitle, action, children, className = "", bodyClassName = "", as: Tag = "section" }) {
  return (
    <Tag className={`overflow-hidden rounded-2xl border border-slate-200 bg-white font-[family-name:var(--font-kanit)] ${className}`}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
        <div className="flex min-w-0 items-center gap-2.5">
          {icon ? <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><AppIcon icon={icon} className="h-4 w-4" /></span> : null}
          <div className="min-w-0">
            <h3 className="font-semibold text-slate-900">{title}</h3>
            {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
          </div>
        </div>
        {action}
      </header>
      <div className={bodyClassName}>{children}</div>
    </Tag>
  );
}

/** สถานะว่าง/ยังใช้งานไม่ได้ แบบเดียวกันทุกหน้า */
export function EmptyPanel({ icon, title, text, tone = "slate", action }) {
  const tile = tone === "amber" ? "bg-amber-50 text-amber-700 ring-amber-100" : "bg-slate-50 text-slate-500 ring-slate-200";
  return (
    <div className="flex flex-col items-center rounded-2xl border border-slate-200 bg-white px-6 py-10 text-center font-[family-name:var(--font-kanit)]">
      {icon ? <span className={`flex h-12 w-12 items-center justify-center rounded-xl ring-1 ${tile}`}><AppIcon icon={icon} className="h-6 w-6" /></span> : null}
      <p className="mt-3 font-semibold text-slate-900">{title}</p>
      {text ? <p className="mt-1 max-w-md text-sm text-slate-500">{text}</p> : null}
      {action ? <div className="mt-4">{action}</div> : null}
    </div>
  );
}
