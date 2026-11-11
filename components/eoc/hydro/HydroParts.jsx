"use client";

// ชิ้นส่วนที่ใช้ร่วมกันของหน้าแนวโน้มน้ำและฝน: tooltip กราฟ ปุ่มเลือกช่วง หัวตารางเรียงลำดับ
import { ArrowDown, ArrowUp, ChevronsUpDown } from "lucide-react";
import { dayLabel, fmt, timeLabel } from "@/components/eoc/hydro/hydroUi";

export function ChartTip({ active, payload, label, bucket = 1, isDate = false, extra }) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value !== null && p.value !== undefined);
  const note = extra ? extra(payload[0]?.payload) : null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{isDate ? dayLabel(label) : timeLabel(label, bucket)}</p>
      {rows.map((p) => (
        <p key={p.dataKey} className="mt-0.5 flex items-center gap-1.5 text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.stroke || p.color }} aria-hidden="true" />
          {p.name}: <b className="tabular-nums">{fmt(p.value, p.unit === "มม." ? 1 : 2)}</b> {p.unit}
        </p>
      ))}
      {note ? <p className="mt-1 border-t border-slate-100 pt-1 text-slate-500">{note}</p> : null}
    </div>
  );
}

export function Segmented({ options, value, onChange, label, tone = "light" }) {
  const dark = tone === "dark";
  return (
    <div role="radiogroup" aria-label={label} className={`inline-flex flex-wrap gap-1 rounded-xl p-1 ${dark ? "bg-white/10 ring-1 ring-white/20" : "bg-slate-100"}`}>
      {options.map(([key, text]) => {
        const on = value === key;
        return (
          <button key={String(key)} type="button" role="radio" aria-checked={on} onClick={() => onChange(key)}
            className={`min-h-9 rounded-lg px-3 text-sm font-semibold transition ${on ? (dark ? "bg-white text-[#0b4c86]" : "bg-white text-[#0b4c86] shadow-sm") : (dark ? "text-blue-50 hover:bg-white/15" : "text-slate-600 hover:text-slate-900")}`}>
            {text}
          </button>
        );
      })}
    </div>
  );
}

/** หัวตารางที่กดเรียงได้ — sort = { key, dir } */
export function SortTh({ label, k, sort, onSort, align = "left", className = "" }) {
  const on = sort.key === k;
  const Icon = !on ? ChevronsUpDown : sort.dir === "asc" ? ArrowUp : ArrowDown;
  return (
    <th scope="col" aria-sort={on ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={`py-2 pr-3 font-medium ${align === "right" ? "text-right" : "text-left"} ${className}`}>
      <button type="button" onClick={() => onSort(k)} className={`inline-flex items-center gap-1 rounded hover:text-slate-900 ${on ? "font-semibold text-slate-900" : ""}`}>
        {label}<Icon className={`h-3 w-3 ${on ? "" : "opacity-40"}`} aria-hidden="true" />
      </button>
    </th>
  );
}

/** สลับทิศเมื่อกดคอลัมน์เดิม · คอลัมน์ใหม่เริ่มจากมากไปน้อย (ข้อความเริ่ม ก→ฮ) */
export function nextSort(sort, key, textKeys = []) {
  if (sort.key === key) return { key, dir: sort.dir === "asc" ? "desc" : "asc" };
  return { key, dir: textKeys.includes(key) ? "asc" : "desc" };
}

export function Stat({ label, value, note, tone = "" }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/60 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className={`m-0 text-base font-semibold tabular-nums ${tone || "text-slate-900"}`}>{value}</dd>
      {note ? <dd className="m-0 text-[11px] leading-4 text-slate-500">{note}</dd> : null}
    </div>
  );
}
