"use client";

// ส่วนระดับน้ำในคลองและน้ำทะเลหนุนของหน้าแนวโน้ม:
// กราฟสถานี (ซ้อนฝนของอำเภอ + เกณฑ์ ปภ.) · เทียบทุกสถานีกับตลิ่ง · ตารางสถานี · น้ำทะเลรายชั่วโมง/รายวัน
import { forwardRef, useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyPanel, Panel } from "@/components/common/ThemePanels";
import { C, LINE_COLORS, bankDiffSeries, bucketText, dayLabel, dayTicks, fmt, mergeLevelAndRain, signed, sortRows, timeLabel, waterTone } from "@/components/eoc/hydro/hydroUi";
import { ChartTip, SortTh, Stat, nextSort } from "@/components/eoc/hydro/HydroParts";

const axis = { fontSize: 12, fill: C.muted };
const THRESHOLD_LINES = [["watch", "เฝ้าระวัง", "#ca8a04"], ["warning", "เตือนภัย", "#ea580c"], ["danger", "อันตราย", "#dc2626"], ["critical", "วิกฤต", "#7f1d1d"]];

// กราฟเส้นเล็กในรายการสถานี · เส้นประ = ตลิ่ง (เมื่ออยู่ใกล้ช่วงของกราฟ)
function MiniTrend({ station }) {
  const points = (station.series || []).filter((p) => Number.isFinite(p.level));
  if (points.length < 3) return <span className="shrink-0 text-[11px] text-slate-400">ข้อมูลยังน้อย</span>;
  const W = 96;
  const H = 30;
  const levels = points.map((p) => p.level);
  let min = Math.min(...levels);
  let max = Math.max(...levels);
  const bank = station.bank;
  const showBank = Number.isFinite(bank) && bank <= max + 0.6;
  if (showBank) max = Math.max(max, bank);
  const pad = Math.max((max - min) * 0.12, 0.03);
  min -= pad;
  max += pad;
  const x = (i) => (i / (points.length - 1)) * (W - 4) + 2;
  const y = (v) => H - 2 - ((v - min) / (max - min)) * (H - 4);
  const line = points.map((p, i) => `${x(i).toFixed(1)},${y(p.level).toFixed(1)}`).join(" ");
  const change = levels.at(-1) - levels[0];
  const tone = change > 0.02 ? "#c2410c" : change < -0.02 ? "#0f766e" : "#64748b";
  return (
    <span className="flex shrink-0 flex-col items-end" aria-label={`แนวโน้ม ${change >= 0 ? "ขึ้น" : "ลง"} ${Math.abs(change).toFixed(2)} เมตร`}>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-[30px] w-24 overflow-visible" aria-hidden="true">
        {showBank ? <line x1="0" x2={W} y1={y(bank)} y2={y(bank)} stroke={C.red} strokeOpacity=".7" strokeWidth="1" strokeDasharray="3 3" /> : null}
        <polygon points={`${x(0).toFixed(1)},${H} ${line} ${x(points.length - 1).toFixed(1)},${H}`} fill={tone} fillOpacity=".1" />
        <polyline points={line} fill="none" stroke={tone} strokeWidth="1.8" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(points.length - 1)} cy={y(levels.at(-1))} r="2.4" fill={tone} stroke="#fff" strokeWidth="1" />
      </svg>
      <span className="text-[11px] font-semibold tabular-nums" style={{ color: tone }}>{change > 0 ? "+" : ""}{change.toFixed(2)} ม.</span>
    </span>
  );
}

function StationChart({ station, rainSeries, bucket, withRain }) {
  const rows = useMemo(() => (withRain ? mergeLevelAndRain(station.series, rainSeries) : station.series || []), [station, rainSeries, withRain]);
  const hasBank = station.bank !== null && station.bank !== undefined;
  return (
    <div className="h-80" role="img" aria-label={`กราฟระดับน้ำ สถานี${station.name}${withRain ? " ซ้อนกับฝนของอำเภอ" : ""}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={rows} margin={{ top: 8, right: withRain ? 0 : 8, bottom: 0, left: -6 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" ticks={dayTicks(rows, bucket)} tickFormatter={dayLabel} tick={axis} minTickGap={28} />
          <YAxis yAxisId="level" tick={axis} domain={["auto", (max) => Math.max(max, station.bank ?? max) + 0.2]} tickFormatter={(v) => fmt(v, 1)} />
          {withRain ? <YAxis yAxisId="rain" orientation="right" reversed width={40} tick={axis} domain={[0, (max) => Math.max(10, Math.ceil(max * 3))]} /> : null}
          <Tooltip content={<ChartTip bucket={bucket} />} />
          {withRain ? <Bar isAnimationActive={false} yAxisId="rain" dataKey="rain" name={`ฝนเฉลี่ย อ.${station.amphoe}`} unit="มม." fill={C.rain} fillOpacity={0.75} maxBarSize={10} /> : null}
          {THRESHOLD_LINES.map(([key, label, color]) => {
            const value = station.thresholds?.[key];
            return value === null || value === undefined ? null
              : <ReferenceLine key={key} yAxisId="level" y={value} stroke={color} strokeDasharray="2 4" label={{ value: `${label} ${fmt(value, 2)}`, position: "insideBottomRight", fill: color, fontSize: 10 }} />;
          })}
          {hasBank ? <ReferenceLine yAxisId="level" y={station.bank} stroke={C.red} strokeDasharray="5 4" label={{ value: `ตลิ่ง ${fmt(station.bank, 2)}`, position: "insideTopLeft", fill: C.red, fontSize: 11 }} /> : null}
          <Line isAnimationActive={false} yAxisId="level" dataKey="level" name="ระดับน้ำ" unit="ม." stroke={C.navy} strokeWidth={2} dot={false} connectNulls />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function StationStats({ station }) {
  const diff = station.latest?.diff;
  const diffTone = diff === null || diff === undefined ? "" : diff > 0 ? "text-red-700" : diff >= -0.5 ? "text-amber-700" : "";
  const change = station.change_6h;
  return (
    <dl className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
      <Stat label="ล่าสุด" value={`${fmt(station.latest?.level, 2)} ม.`} note={station.latest?.t ? timeLabel(station.latest.t) : null} />
      <Stat label="เทียบตลิ่ง" value={diff === null || diff === undefined ? "–" : `${signed(diff)} ม.`} tone={diffTone} note={station.bank !== null && station.bank !== undefined ? `ตลิ่ง ${fmt(station.bank, 2)} ม.` : "ไม่มีค่าตลิ่ง"} />
      <Stat label="สูงสุด / ต่ำสุด" value={`${fmt(station.peak?.level, 2)} / ${fmt(station.lowest?.level, 2)}`} note={station.peak?.t ? `สูงสุด ${timeLabel(station.peak.t)}` : null} />
      <Stat label="เปลี่ยนใน 6 ชม." value={change === null || change === undefined ? "–" : `${signed(change)} ม.`} tone={change > 0.1 ? "text-amber-700" : ""} note={`ทั้งช่วง ${signed(station.change)} ม.`} />
      <Stat label="ขึ้นเร็วสุด" value={station.max_rise ? `${fmt(station.max_rise.rate, 2)} ม./ชม.` : "–"} note={station.max_rise?.t ? timeLabel(station.max_rise.t) : null} />
      <Stat label="ล้นตลิ่ง" value={`${station.hours_over_bank} ชม.`} tone={station.hours_over_bank ? "text-red-700" : ""} note={`${station.days_over_bank || 0} วัน · ใกล้ตลิ่ง ${station.hours_near_bank} ชม.`} />
    </dl>
  );
}

// ทุกสถานีบนแกนเดียวกัน: ระดับน้ำ − ตลิ่ง (0 = เต็มตลิ่ง)
function CompareChart({ stations, bucket, selectedCode, onSelect }) {
  const ranked = useMemo(() => stations.filter((s) => s.bank !== null && s.bank !== undefined).sort((a, b) => (b.peak?.diff ?? -99) - (a.peak?.diff ?? -99)), [stations]);
  const [picked, setPicked] = useState(null);
  const shown = picked || ranked.slice(0, 6).map((s) => s.code);
  const rows = useMemo(() => bankDiffSeries(ranked.filter((s) => shown.includes(s.code))), [ranked, shown]);
  const color = (code) => LINE_COLORS[ranked.findIndex((s) => s.code === code) % LINE_COLORS.length];
  const toggle = (code) => setPicked(shown.includes(code) ? shown.filter((c) => c !== code) : [...shown, code]);
  if (!ranked.length) return null;
  return (
    <>
      <div className="mb-2 flex flex-wrap gap-1.5" role="group" aria-label="สถานีที่แสดงบนกราฟ">
        {ranked.map((s) => {
          const on = shown.includes(s.code);
          return (
            <button key={s.code} type="button" aria-pressed={on} onClick={() => toggle(s.code)}
              className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-medium ${on ? "border-slate-300 bg-white text-slate-900" : "border-slate-200 bg-slate-50 text-slate-400"}`}>
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: on ? color(s.code) : "#cbd5e1" }} aria-hidden="true" />{s.name}
            </button>
          );
        })}
      </div>
      <div className="h-72" role="img" aria-label="กราฟระดับน้ำเทียบตลิ่งของทุกสถานี">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={rows} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
            <CartesianGrid stroke={C.grid} vertical={false} />
            <XAxis dataKey="t" ticks={dayTicks(rows, bucket)} tickFormatter={dayLabel} tick={axis} minTickGap={28} />
            <YAxis tick={axis} tickFormatter={(v) => fmt(v, 1)} domain={["auto", (max) => Math.max(max, 0) + 0.2]} />
            <Tooltip content={<ChartTip bucket={bucket} />} />
            <ReferenceLine y={0} stroke={C.red} strokeDasharray="5 4" label={{ value: "ตลิ่ง", position: "insideTopLeft", fill: C.red, fontSize: 11 }} />
            <ReferenceLine y={-0.5} stroke={C.amber} strokeDasharray="2 4" label={{ value: "ใกล้ตลิ่ง", position: "insideBottomLeft", fill: C.amber, fontSize: 10 }} />
            {ranked.filter((s) => shown.includes(s.code)).map((s) => (
              <Line isAnimationActive={false} key={s.code} dataKey={s.code} name={s.name} unit="ม." stroke={color(s.code)} strokeWidth={s.code === selectedCode ? 3 : 1.6} dot={false} connectNulls
                activeDot={{ r: 4, onClick: () => onSelect(s.code) }} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </>
  );
}

const TEXT_KEYS = ["name", "amphoe", "source"];
function WaterTable({ stations, selectedCode, onSelect }) {
  const [sort, setSort] = useState({ key: "latest_diff", dir: "desc" });
  const flat = useMemo(() => stations.map((s) => ({
    ...s, latest_level: s.latest?.level ?? null, latest_diff: s.latest?.diff ?? null, peak_level: s.peak?.level ?? null, peak_diff: s.peak?.diff ?? null, rise_rate: s.max_rise?.rate ?? null
  })), [stations]);
  const rows = useMemo(() => sortRows(flat, sort.key, sort.dir), [flat, sort]);
  const th = (label, k, align) => <SortTh label={label} k={k} align={align} sort={sort} onSort={(key) => setSort((s) => nextSort(s, key, TEXT_KEYS))} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            {th("สถานี", "name")}{th("อำเภอ", "amphoe")}{th("ล่าสุด (ม.)", "latest_level", "right")}{th("เทียบตลิ่ง", "latest_diff", "right")}
            {th("สูงสุด (ม.)", "peak_level", "right")}{th("สูงสุดเทียบตลิ่ง", "peak_diff", "right")}{th("6 ชม.", "change_6h", "right")}
            {th("ขึ้นเร็วสุด (ม./ชม.)", "rise_rate", "right")}{th("ล้นตลิ่ง (ชม.)", "hours_over_bank", "right")}
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => {
            const tone = waterTone(s);
            const on = s.code === selectedCode;
            return (
              <tr key={s.code} className={`border-b border-slate-100 ${on ? "bg-sky-50" : ""}`}>
                <td className="py-2 pr-3">
                  <button type="button" onClick={() => onSelect(s.code, true)} className="flex items-center gap-2 text-left font-medium text-slate-900 hover:text-[#0b4c86] hover:underline">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ backgroundColor: tone.color }} aria-hidden="true" />{s.name}
                    <span className="text-xs font-normal text-slate-400">{s.source}</span>
                  </button>
                </td>
                <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{s.amphoe ? `อ.${s.amphoe}` : "–"}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-900">{fmt(s.latest_level, 2)}</td>
                <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${s.latest_diff > 0 ? "text-red-700" : s.latest_diff >= -0.5 ? "text-amber-700" : "text-slate-700"}`}>{signed(s.latest_diff)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700" title={s.peak?.t ? timeLabel(s.peak.t) : undefined}>{fmt(s.peak_level, 2)}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${s.peak_diff > 0 ? "font-semibold text-red-700" : "text-slate-700"}`}>{signed(s.peak_diff)}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${s.change_6h > 0.1 ? "font-semibold text-amber-700" : "text-slate-700"}`}>{signed(s.change_6h)}</td>
                <td className="py-2 pr-3 text-right tabular-nums text-slate-700" title={s.max_rise?.t ? timeLabel(s.max_rise.t) : undefined}>{fmt(s.rise_rate, 2)}</td>
                <td className={`py-2 pr-3 text-right tabular-nums ${s.hours_over_bank ? "font-semibold text-red-700" : "text-slate-700"}`}>{s.hours_over_bank || "–"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export const HydroWaterSection = forwardRef(function HydroWaterSection({ stations, station, onSelect, rainByDistrict = {}, bucket, detailed }, ref) {
  const [overlay, setOverlay] = useState(true);
  if (!stations.length || !station) {
    return (
      <Panel icon="waves" title="ระดับน้ำในคลอง" bodyClassName="p-4">
        <EmptyPanel icon="waves" title="ยังไม่มีข้อมูลระดับน้ำในช่วงนี้" text="ระบบเก็บระดับน้ำจาก ThaiWater และสถานี ปภ. ทุก 10 นาที" />
      </Panel>
    );
  }
  const rainSeries = station.amphoe ? rainByDistrict[station.amphoe] || [] : [];
  const canOverlay = detailed && rainSeries.length > 0;
  const place = [station.river, station.tambon && `ต.${station.tambon}`, station.amphoe && `อ.${station.amphoe}`].filter(Boolean).join(" · ");
  return (
    <>
      <div ref={ref} className="scroll-mt-20">
        <Panel icon="waves" title="ระดับน้ำในคลอง" bodyClassName="p-4"
          subtitle={`จุดบนกราฟ = ค่าสูงสุด${bucketText(bucket)} · เส้นแดง = ตลิ่ง${canOverlay && overlay ? " · แท่งฟ้าจากด้านบน = ฝนเฉลี่ยของอำเภอ (แกนขวา)" : ""}`}>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="min-w-0">
              <div className="mb-2 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-600">
                <label className="flex flex-wrap items-center gap-2">
                  สถานี
                  <select value={station.code} onChange={(e) => onSelect(e.target.value)} className="min-h-10 max-w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900">
                    {stations.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.source})</option>)}
                  </select>
                </label>
                {canOverlay ? (
                  <label className="flex min-h-10 items-center gap-2">
                    <input type="checkbox" checked={overlay} onChange={(e) => setOverlay(e.target.checked)} className="h-4 w-4 rounded border-slate-300 text-[#0b4c86]" />ซ้อนฝน อ.{station.amphoe}
                  </label>
                ) : null}
                {place ? <span className="text-xs text-slate-500">{place}</span> : null}
              </div>
              <StationChart station={station} rainSeries={rainSeries} bucket={bucket} withRain={canOverlay && overlay} />
              {detailed ? <StationStats station={station} /> : null}
            </div>
            <ul className="max-h-[30rem] space-y-1.5 overflow-y-auto pr-1" aria-label="สถานี ปภ. ก่อน แล้วตามด้วย ThaiWater">
              {stations.map((s, i) => {
                const on = s.code === station.code;
                const over = s.hours_over_bank > 0;
                const near = !over && s.hours_near_bank > 0;
                const groupStart = i === 0 || stations[i - 1].source !== s.source;
                return (
                  <li key={s.code}>
                    {groupStart ? <p className={`px-1 pb-1 text-xs font-semibold text-slate-500 ${i ? "pt-2" : ""}`}>{s.source === "ปภ." ? "สถานี ปภ. (กล้อง CCTV ระดับน้ำ)" : "สถานี ThaiWater (สสน.)"}</p> : null}
                    <button type="button" onClick={() => onSelect(s.code)} aria-pressed={on}
                      className={`w-full rounded-xl border px-3 py-2 text-left transition ${on ? "border-[#0b4c86] bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}>
                      <span className="flex items-start justify-between gap-2">
                        <span className="min-w-0 text-sm font-semibold leading-snug text-slate-900">{s.name}</span>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${over ? "bg-red-100 text-red-700" : near ? "bg-amber-100 text-amber-800" : "bg-slate-100 text-slate-600"}`}>
                          {over ? `ล้น ${s.hours_over_bank} ชม.` : near ? "ใกล้ตลิ่ง" : s.source}
                        </span>
                      </span>
                      <span className="mt-1 flex items-end justify-between gap-2">
                        <span className="text-xs leading-5 text-slate-500">สูงสุด {fmt(s.peak?.level, 2)} ม.{s.peak?.diff !== null && s.peak?.diff !== undefined ? <><br />เทียบตลิ่ง {signed(s.peak.diff)}</> : null}</span>
                        <MiniTrend station={s} />
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        </Panel>
      </div>

      {detailed ? (
        <Panel icon="waves" title="เทียบทุกสถานีกับตลิ่ง" subtitle="ระดับน้ำลบระดับตลิ่งของแต่ละสถานี (0 = เต็มตลิ่ง · ค่าบวก = ล้น) · กดชื่อสถานีเพื่อแสดงหรือซ่อนเส้น" bodyClassName="space-y-4 p-4">
          <div><CompareChart stations={stations} bucket={bucket} selectedCode={station.code} onSelect={onSelect} /></div>
          <WaterTable stations={stations} selectedCode={station.code} onSelect={onSelect} />
        </Panel>
      ) : null}
    </>
  );
});

const RANK_COLOR = ["#7dd3fc", "#f59e0b", "#dc2626", "#7f1d1d"];
const RANK_LABEL = ["ปกติ", "หนุนสูงกว่าปกติ", "หนุนสูง", "สูงสุดในรอบ 30 วัน"];

export function HydroSeaSection({ sea, bucket, detailed }) {
  const hasData = (sea.series || []).some((p) => p.model !== null || p.observed !== null);
  const daily = (sea.daily || []).filter((d) => d.model_max !== null);
  return (
    <Panel icon="waves" title="น้ำทะเลหนุน หน้าสตูล" subtitle="เส้นน้ำเงิน = แบบจำลองระดับน้ำทะเลหน้าสตูล · เส้นฟ้า = ค่าวัดจริงสถานีลังกาวี (IOC) · เส้นประ = เกณฑ์หนุนสูงจากสถิติ 30 วัน" bodyClassName="space-y-4 p-4">
      {hasData ? (
        <>
          <div className="h-72" role="img" aria-label="กราฟระดับน้ำทะเล">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={sea.series} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                <CartesianGrid stroke={C.grid} vertical={false} />
                <XAxis dataKey="t" ticks={dayTicks(sea.series, bucket)} tickFormatter={dayLabel} tick={axis} minTickGap={28} />
                <YAxis tick={axis} tickFormatter={(v) => fmt(v, 1)} domain={["auto", "auto"]} />
                <Tooltip content={<ChartTip bucket={bucket} />} />
                {Number.isFinite(sea.thresholds?.elevated) ? <ReferenceLine y={sea.thresholds.elevated} stroke={C.amber} strokeDasharray="4 4" label={{ value: "หนุนสูงกว่าปกติ", position: "insideTopLeft", fill: C.amber, fontSize: 11 }} /> : null}
                {Number.isFinite(sea.thresholds?.high) ? <ReferenceLine y={sea.thresholds.high} stroke={C.red} strokeDasharray="4 4" label={{ value: "หนุนสูง", position: "insideTopLeft", fill: C.red, fontSize: 11 }} /> : null}
                <Line isAnimationActive={false} dataKey="model" name="แบบจำลองหน้าสตูล" unit="ม." stroke={C.navy} strokeWidth={2} dot={false} connectNulls />
                <Line isAnimationActive={false} dataKey="observed" name="วัดจริง (ลังกาวี)" unit="ม." stroke={C.teal} strokeWidth={1.5} dot={false} connectNulls />
              </LineChart>
            </ResponsiveContainer>
          </div>
          {detailed && daily.length > 1 ? (
            <div>
              <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-sm font-semibold text-slate-900">น้ำขึ้นสูงสุดรายวัน และพิสัยน้ำขึ้น–ลง</h4>
                <ul className="flex flex-wrap gap-x-3 text-[11px] text-slate-600">
                  {RANK_LABEL.map((label, i) => <li key={label} className="flex items-center gap-1"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: RANK_COLOR[i] }} aria-hidden="true" />{label}</li>)}
                </ul>
              </div>
              <div className="h-56" role="img" aria-label="กราฟน้ำทะเลขึ้นสูงสุดรายวันและพิสัยน้ำขึ้นลง">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={daily} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="date" tickFormatter={dayLabel} tick={axis} minTickGap={16} />
                    <YAxis tick={axis} tickFormatter={(v) => fmt(v, 1)} />
                    <Tooltip content={<ChartTip isDate extra={(d) => (d ? RANK_LABEL[d.rank] : null)} />} />
                    <Bar isAnimationActive={false} dataKey="model_max" name="น้ำขึ้นสูงสุด" unit="ม." maxBarSize={24} radius={[3, 3, 0, 0]} fill={RANK_COLOR[0]}>
                      {daily.map((d) => <Cell key={d.date} fill={RANK_COLOR[d.rank] || RANK_COLOR[0]} />)}
                    </Bar>
                    <Line isAnimationActive={false} dataKey="tidal_range" name="พิสัยน้ำขึ้น–ลง" unit="ม." stroke={C.deep} strokeWidth={1.8} dot={false} connectNulls />
                    <Line isAnimationActive={false} dataKey="observed_max" name="วัดจริงสูงสุด (ลังกาวี)" unit="ม." stroke={C.teal} strokeWidth={1.5} strokeDasharray="4 3" dot={false} connectNulls />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          ) : null}
        </>
      ) : <EmptyPanel icon="waves" title="ยังไม่มีข้อมูลน้ำทะเลในช่วงนี้" text="ระบบเก็บระดับน้ำทะเลทุก 10 นาที (บันทึกชั่วโมงละ 1 ค่า)" />}
    </Panel>
  );
}
