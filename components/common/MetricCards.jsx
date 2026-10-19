"use client";

// การ์ดตัวเลขกลางของระบบ (ธีมเดียวกับทะเบียนกลุ่มเปราะบางและเวชภัณฑ์)
// - MetricCard: การ์ดขาว ไอคอนในกรอบสี · ชื่อ · ตัวเลข · หมายเหตุ/แถบสัดส่วน · กดเป็นตัวกรองได้
// - HeroCard: การ์ดหลักพื้นน้ำเงินพร้อมแถบแบ่งสัดส่วน
// - toneFromClass: แปลง className สีตัวอักษรแบบเดิม (text-red-700 ฯลฯ) เป็น tone ของการ์ด
import { Children, createContext, useContext } from "react";
import { formatNumber } from "@/lib/adminApi";
import AppIcon from "@/components/icons/AppIcon";

// กลุ่มที่มีการ์ดมาก (COMPACT_FROM ใบขึ้นไป) ใช้การ์ดขนาดเล็กอัตโนมัติ
export const COMPACT_FROM = 5;
const MetricSizeContext = createContext(null);

export const METRIC_TONES = {
  red: { tile: "bg-red-50 text-red-700 ring-red-100", bar: "bg-red-500", value: "text-red-700", tag: "bg-red-50 text-red-700", active: "border-red-300 ring-2 ring-red-100" },
  amber: { tile: "bg-amber-50 text-amber-700 ring-amber-100", bar: "bg-amber-500", value: "text-amber-700", tag: "bg-amber-50 text-amber-800", active: "border-amber-300 ring-2 ring-amber-100" },
  green: { tile: "bg-emerald-50 text-emerald-700 ring-emerald-100", bar: "bg-emerald-500", value: "text-emerald-700", tag: "bg-emerald-50 text-emerald-700", active: "border-emerald-300 ring-2 ring-emerald-100" },
  blue: { tile: "bg-sky-50 text-[#0b4c86] ring-sky-100", bar: "bg-[#0b4c86]", value: "text-[#0b4c86]", tag: "bg-sky-50 text-[#0b4c86]", active: "border-sky-300 ring-2 ring-sky-100" },
  slate: { tile: "bg-slate-50 text-slate-500 ring-slate-200", bar: "bg-slate-400", value: "text-slate-900", tag: "bg-slate-100 text-slate-600", active: "border-slate-400 ring-2 ring-slate-100" },
  muted: { tile: "bg-slate-50 text-slate-400 ring-slate-200", bar: "bg-slate-300", value: "text-slate-400", tag: "bg-slate-100 text-slate-500", active: "border-slate-400 ring-2 ring-slate-100" }
};

/** className สีแบบเดิม → tone (ไม่ระบุ = slate) */
export function toneFromClass(className = "") {
  const value = String(className || "");
  if (/(text|bg)-red-/.test(value)) return "red";
  if (/(text|bg)-(amber|orange|yellow)-/.test(value)) return "amber";
  if (/(text|bg)-(emerald|green|teal)-/.test(value)) return "green";
  if (/(text|bg)-(sky|blue|indigo)-|#0b4c86|#dbeaf7/.test(value)) return "blue";
  if (/text-slate-(300|400)/.test(value)) return "muted";
  return "slate";
}

export const sharePercent = (value, total) => (total ? Math.round((value / total) * 1000) / 10 : 0);

export function MetricCard({ icon, label, value, unit, tone = "slate", tag, note, share, shareLabel, onClick, active, href, LinkComponent, className = "", compact }) {
  const toneStyle = METRIC_TONES[tone] || METRIC_TONES.slate;
  const contextSize = useContext(MetricSizeContext);
  const small = compact ?? contextSize === "compact";
  // ไอคอนรับได้ทั้งคอมโพเนนต์ lucide และชื่อ/อีโมจิแบบเดิม (AppIcon แปลงให้)
  const Icon = icon || null;
  const sz = small
    ? { pad: "p-2.5", tile: "h-7 w-7 rounded-lg", icon: "h-4 w-4", label: "text-xs", labelGap: "mt-1.5", value: "text-lg", unit: "text-xs", bar: "mt-2", note: "mt-1 text-[11px]" }
    : { pad: "p-3.5", tile: "h-9 w-9 rounded-xl", icon: "h-[18px] w-[18px]", label: "text-[13px]", labelGap: "mt-2.5", value: "text-2xl", unit: "text-sm", bar: "mt-3", note: "mt-2 text-xs" };
  const body = (
    <>
      {Icon || tag ? (
        <div className="flex items-start justify-between gap-2">
          {Icon ? <span className={`flex shrink-0 items-center justify-center ring-1 ${sz.tile} ${toneStyle.tile}`}><AppIcon icon={Icon} className={sz.icon} /></span> : <span />}
          {tag ? <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${toneStyle.tag}`}>{tag}</span> : null}
        </div>
      ) : null}
      <p className={`${Icon || tag ? `${sz.labelGap} ` : ""}${sz.label} font-medium leading-tight text-slate-600`}>{label}</p>
      <p className={`mt-1 font-bold leading-none tabular-nums ${sz.value} ${toneStyle.value}`}>
        {value}{unit ? <span className={`ml-1 font-medium text-slate-500 ${sz.unit}`}>{unit}</span> : null}
      </p>
      {share !== undefined && share !== null ? (
        <div className={`${sz.bar} flex items-center gap-2`} title={shareLabel}>
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
            <span className={`block h-full rounded-full transition-[width] duration-500 ${toneStyle.bar}`} style={{ width: `${Math.min(100, Math.max(0, share))}%` }} />
          </span>
          <span className="w-11 text-right text-xs tabular-nums text-slate-500">{share}%</span>
        </div>
      ) : null}
      {note ? <div className={`${sz.note} leading-snug text-slate-500`}>{note}</div> : null}
    </>
  );
  const base = `flex h-full w-full flex-col ${small ? "rounded-xl" : "rounded-2xl"} border bg-white ${sz.pad} text-left font-[family-name:var(--font-kanit)] transition-shadow ${className}`;
  const interactive = "hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,.5)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#0b4c86]";
  if (href && LinkComponent) {
    return <LinkComponent href={href} className={`${base} ${interactive} border-slate-200`}>{body}</LinkComponent>;
  }
  if (onClick) {
    return (
      <button type="button" onClick={onClick} aria-pressed={Boolean(active)} className={`${base} ${interactive} ${active ? toneStyle.active : "border-slate-200"}`}>
        {body}
      </button>
    );
  }
  return <div className={`${base} border-slate-200`}>{body}</div>;
}

// จำนวนคอลัมน์บนจอใหญ่ให้แถวเต็มเท่า ๆ กัน (เช่น 8 ใบ = 4+4, 9 ใบ = 5+4) ไม่เกิน 6
export function balancedColumns(count) {
  if (count <= 6) return Math.max(count, 1);
  return Math.ceil(count / Math.ceil(count / 6));
}
const COMPACT_COLUMNS = {
  1: "grid-cols-1", 2: "grid-cols-2", 3: "grid-cols-2 sm:grid-cols-3", 4: "grid-cols-2 sm:grid-cols-4",
  5: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5", 6: "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"
};

/**
 * กล่องจัดเรียงการ์ด: นับจำนวนการ์ดเอง ถ้ามาก (≥ COMPACT_FROM) ใช้ขนาดเล็กและเพิ่มจำนวนคอลัมน์
 * as="ul" จะห่อการ์ดแต่ละใบด้วย <li>
 */
export function MetricGrid({ children, className = "", compact, as = "div", cols }) {
  const items = Children.toArray(children).filter(Boolean);
  const small = compact ?? items.length >= COMPACT_FROM;
  const columns = cols || (small ? COMPACT_COLUMNS[balancedColumns(items.length)] : items.length === 3 ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-4");
  const Tag = as;
  return (
    <MetricSizeContext.Provider value={small ? "compact" : "normal"}>
      <Tag className={`grid ${small ? "gap-2" : "gap-2.5"} ${columns} ${className}`}>
        {as === "ul" ? items.map((child, index) => <li key={child.key ?? index}>{child}</li>) : items}
      </Tag>
    </MetricSizeContext.Provider>
  );
}

function SegmentBar({ segments, total, label }) {
  return (
    <div className="flex h-2.5 overflow-hidden rounded-full bg-white/15" role="img" aria-label={label}>
      {segments.map((segment) => (segment.value ? (
        <span key={segment.key} className={`h-full ${segment.color} transition-[width] duration-500`} style={{ width: `${(segment.value / total) * 100}%` }} />
      ) : null))}
    </div>
  );
}

/** การ์ดหลักพื้นน้ำเงิน · segments = [{ key, label, value, color: "bg-emerald-400" }] */
export function HeroCard({ title, value, unit, caption, segments = [], total, footer, footerIcon: FooterIcon, children }) {
  const sum = total || segments.reduce((acc, segment) => acc + (Number(segment.value) || 0), 0) || 1;
  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#0b4c86] p-5 font-[family-name:var(--font-kanit)] text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)]">
      <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
      <p className="relative text-sm font-medium text-blue-100">{title}</p>
      <p className="relative mt-1 text-[2.6rem] font-bold leading-none tabular-nums">
        {value}{unit ? <span className="ml-1.5 text-base font-medium text-blue-100">{unit}</span> : null}
      </p>
      {caption ? <p className="relative mt-1 text-sm text-blue-100">{caption}</p> : null}
      {segments.length ? (
        <>
          <div className="relative mt-4">
            <SegmentBar segments={segments} total={sum} label={segments.map((segment) => `${segment.label} ${segment.value}`).join(", ")} />
          </div>
          <dl className="relative mt-3 space-y-1.5 text-sm">
            {segments.map((segment) => (
              <div key={segment.key} className="flex items-center justify-between gap-2">
                <dt className="flex items-center gap-2 text-blue-50"><span className={`h-2 w-2 rounded-full ${segment.color}`} aria-hidden="true" />{segment.label}</dt>
                <dd className="font-semibold tabular-nums">{typeof segment.value === "number" ? formatNumber(segment.value) : segment.value}</dd>
              </div>
            ))}
          </dl>
        </>
      ) : null}
      {children}
      {footer ? (
        <p className="relative mt-4 flex items-center gap-1.5 border-t border-white/15 pt-3 text-xs text-blue-100">
          {FooterIcon ? <FooterIcon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" /> : null}
          {footer}
        </p>
      ) : null}
    </div>
  );
}
