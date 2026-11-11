"use client";

// ส่วนฝนของหน้าแนวโน้ม: ฝนรายวัน + สะสม · ความแรงฝนตามเวลา · ตารางความร้อนอำเภอ × วัน · ตารางสถานี
import { useMemo, useState } from "react";
import { Bar, CartesianGrid, Cell, ComposedChart, Line, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { EmptyPanel, Panel } from "@/components/common/ThemePanels";
import { HEAVY_RAIN_1H_MM, HEAVY_RAIN_MM, VERY_HEAVY_RAIN_MM } from "@/lib/hydroHistory";
import { hourlyRainCategory, rainCategory, RAIN_CATEGORIES } from "@/lib/thaiWaterRain";
import { C, bucketText, dayLabel, dayTicks, fmt, sortRows, timeLabel } from "@/components/eoc/hydro/hydroUi";
import { ChartTip, Segmented, SortTh, nextSort } from "@/components/eoc/hydro/HydroParts";

const axis = { fontSize: 12, fill: C.muted };

function RainDailyChart({ daily }) {
  return (
    <div className="h-72" role="img" aria-label="กราฟฝนรายวันและฝนสะสม">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={daily} margin={{ top: 8, right: 0, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="date" tickFormatter={dayLabel} tick={axis} minTickGap={16} />
          <YAxis yAxisId="mm" tick={axis} />
          <YAxis yAxisId="cum" orientation="right" tick={axis} width={44} />
          <Tooltip content={<ChartTip isDate extra={(d) => (d?.stations ? `${d.max_station ? `มากสุดที่ ${d.max_station} · ` : ""}มีฝน ${d.rain_stations}/${d.stations} สถานี${d.heavy_stations ? ` · ฝนหนัก ${d.heavy_stations} สถานี` : ""}` : null)} />} />
          <ReferenceLine yAxisId="mm" y={HEAVY_RAIN_MM} stroke={C.amber} strokeDasharray="4 4" label={{ value: "ฝนหนัก", position: "insideTopLeft", fill: C.amber, fontSize: 11 }} />
          <ReferenceLine yAxisId="mm" y={VERY_HEAVY_RAIN_MM} stroke={C.red} strokeDasharray="4 4" label={{ value: "หนักมาก", position: "insideTopLeft", fill: C.red, fontSize: 11 }} />
          <Bar isAnimationActive={false} yAxisId="mm" dataKey="max_mm" name="สถานีที่ฝนมากสุด" unit="มม." radius={[4, 4, 0, 0]} maxBarSize={28} fill={C.rain}>
            {daily.map((d) => <Cell key={d.date} fill={(d.max_mm ?? 0) > 0 ? rainCategory(d.max_mm).color : C.rain} />)}
          </Bar>
          <Line isAnimationActive={false} yAxisId="mm" dataKey="avg_mm" name="เฉลี่ยทุกสถานี" unit="มม." stroke={C.deep} strokeWidth={2} dot={false} connectNulls />
          <Line isAnimationActive={false} yAxisId="cum" dataKey="cum_avg_mm" name="สะสม (เฉลี่ย)" unit="มม." stroke="#7c3aed" strokeWidth={1.8} strokeDasharray="5 3" dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

function RainIntensityChart({ intensity }) {
  const bucket = intensity.bucket_hours;
  const hourly = bucket === 1;
  return (
    <div className="h-64" role="img" aria-label={`กราฟความแรงฝน${bucketText(bucket)}`}>
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={intensity.area} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid stroke={C.grid} vertical={false} />
          <XAxis dataKey="t" ticks={dayTicks(intensity.area, bucket)} tickFormatter={dayLabel} tick={axis} minTickGap={32} />
          <YAxis tick={axis} />
          <Tooltip content={<ChartTip bucket={bucket} extra={(d) => (d ? `${d.max_station ? `แรงสุดที่ ${d.max_station} · ` : ""}มีฝน ${d.raining}/${d.stations} สถานี` : null)} />} />
          {hourly ? <ReferenceLine y={HEAVY_RAIN_1H_MM} stroke={C.amber} strokeDasharray="4 4" label={{ value: "ฝนหนัก 20 มม./ชม.", position: "insideTopLeft", fill: C.amber, fontSize: 11 }} /> : null}
          <Bar isAnimationActive={false} dataKey="max_mm" name="สถานีที่ฝนแรงสุด" unit="มม." fill={C.rain} maxBarSize={14}>
            {hourly ? intensity.area.map((d) => <Cell key={d.t} fill={(d.max_mm ?? 0) > 0 ? hourlyRainCategory(d.max_mm).color : C.rain} />) : null}
          </Bar>
          <Line isAnimationActive={false} dataKey="avg_mm" name="เฉลี่ยทุกสถานี" unit="มม." stroke={C.deep} strokeWidth={1.6} dot={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

// ตารางความร้อน: แถว = อำเภอ · คอลัมน์ = วัน · สี = เกณฑ์ฝน 24 ชม.
function RainHeatmap({ rows, dates, selected, onSelect }) {
  const [mode, setMode] = useState("daily_max");
  const n = dates.length;
  const showNumber = n <= 14;
  const labelEvery = n <= 7 ? 1 : n <= 30 ? 5 : 15;
  const cellWidth = n <= 7 ? 48 : n <= 30 ? 20 : 9;
  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-slate-600" aria-label="คำอธิบายสี (มม./วัน)">
          {RAIN_CATEGORIES.map((cat, i) => (
            <li key={cat.key} className="flex items-center gap-1">
              <span className="h-3 w-4 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: cat.color }} aria-hidden="true" />
              {cat.label}{i ? ` ≥ ${cat.min}` : ""}
            </li>
          ))}
          <li className="flex items-center gap-1"><span className="h-3 w-4 rounded-sm bg-white ring-1 ring-slate-300" aria-hidden="true" />ไม่มีข้อมูล</li>
        </ul>
        <Segmented label="ค่าที่แสดง" value={mode} onChange={setMode} options={[["daily_max", "สถานีสูงสุด"], ["daily_avg", "เฉลี่ยอำเภอ"]]} />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full border-separate border-spacing-[2px] text-xs">
          <thead>
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-white pr-2 text-left font-medium text-slate-500">อำเภอ</th>
              {dates.map((date, i) => (
                <th key={date} scope="col" className="h-5 whitespace-nowrap p-0 text-center text-[10px] font-normal text-slate-500" style={{ minWidth: cellWidth }}>
                  {i % labelEvery === 0 ? <span className={n > 7 ? "block w-0 overflow-visible" : ""}>{dayLabel(date)}</span> : <span className="sr-only">{dayLabel(date)}</span>}
                </th>
              ))}
              <th scope="col" className="pl-2 text-right font-medium text-slate-500">สะสม</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const on = selected === row.amphoe;
              return (
                <tr key={row.amphoe}>
                  <th scope="row" className="sticky left-0 z-10 bg-white pr-2 text-left font-normal">
                    <button type="button" aria-pressed={on} onClick={() => onSelect(on ? "" : row.amphoe)}
                      className={`whitespace-nowrap rounded-md px-1.5 py-1 text-[13px] ${on ? "bg-[#0b4c86] font-semibold text-white" : "text-slate-800 hover:bg-slate-100"}`}>
                      อ.{row.amphoe}
                    </button>
                  </th>
                  {dates.map((date, i) => {
                    const value = row[mode][i];
                    const missing = value === null || value === undefined;
                    const cat = rainCategory(value);
                    return (
                      <td key={date} title={`อ.${row.amphoe} ${dayLabel(date)}: ${missing ? "ไม่มีข้อมูล" : `${fmt(value)} มม.`}`}
                        className={`h-7 rounded-[3px] p-0 text-center tabular-nums ${missing ? "ring-1 ring-inset ring-slate-200" : ""}`}
                        style={missing ? undefined : { backgroundColor: cat.color, color: cat.text }}>
                        {showNumber && !missing && value >= 0.1 ? fmt(value, value >= 10 ? 0 : 1) : null}
                      </td>
                    );
                  })}
                  <td className="whitespace-nowrap pl-2 text-right font-semibold tabular-nums text-slate-900">{fmt(row.total_mm)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function DaySpark({ values = [] }) {
  const known = values.filter((v) => v !== null && v !== undefined);
  if (!known.length) return null;
  const max = Math.max(...known, 1);
  const W = 72;
  const H = 18;
  const step = W / values.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="h-[18px] w-[72px]" aria-hidden="true">
      {values.map((v, i) => (v ? <rect key={i} x={i * step} y={H - Math.max(1.5, (v / max) * H)} width={Math.max(step * 0.8, 0.7)} height={Math.max(1.5, (v / max) * H)} fill={rainCategory(v).color} /> : null))}
      <line x1="0" x2={W} y1={H - 0.5} y2={H - 0.5} stroke="#cbd5e1" strokeWidth="1" />
    </svg>
  );
}

const TEXT_KEYS = ["name", "amphoe"];
function RainStationTable({ stations, detailed }) {
  const [sort, setSort] = useState({ key: "total_mm", dir: "desc" });
  const [all, setAll] = useState(false);
  const rows = useMemo(() => sortRows(stations, sort.key, sort.dir), [stations, sort]);
  const shown = all ? rows : rows.slice(0, 10);
  const th = (label, k, align) => <SortTh label={label} k={k} align={align} sort={sort} onSort={(key) => setSort((s) => nextSort(s, key, TEXT_KEYS))} />;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-xs text-slate-500">
            {th("สถานีวัดฝน", "name")}{th("อำเภอ", "amphoe")}
            {detailed ? <th scope="col" className="py-2 pr-3 text-left font-medium">รายวัน</th> : null}
            {th("ฝนรวม (มม.)", "total_mm", "right")}{th("สูงสุดต่อวัน", "max_day_mm", "right")}
            {detailed ? <>{th("สะสม 3 วัน", "max_3d_mm", "right")}{th("แรงสุด 1 ชม.", "max_1h_mm", "right")}{th("วันมีฝน", "rain_days", "right")}</> : null}
            {th("วันฝนหนัก", "heavy_days", "right")}
          </tr>
        </thead>
        <tbody>
          {shown.map((s) => (
            <tr key={s.id} className="border-b border-slate-100">
              <td className="py-2 pr-3 text-slate-900">{s.name}{s.tambon ? <span className="text-slate-500"> · ต.{s.tambon}</span> : null}</td>
              <td className="whitespace-nowrap py-2 pr-3 text-slate-600">{s.amphoe ? `อ.${s.amphoe}` : "–"}</td>
              {detailed ? <td className="py-2 pr-3"><DaySpark values={s.daily_mm} /></td> : null}
              <td className="py-2 pr-3 text-right font-semibold tabular-nums text-slate-900">{fmt(s.total_mm)}</td>
              <td className={`py-2 pr-3 text-right tabular-nums ${(s.max_day_mm ?? 0) >= HEAVY_RAIN_MM ? "font-semibold text-amber-700" : "text-slate-700"}`}>{fmt(s.max_day_mm)}</td>
              {detailed ? (
                <>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{fmt(s.max_3d_mm)}</td>
                  <td className={`py-2 pr-3 text-right tabular-nums ${(s.max_1h_mm ?? 0) >= HEAVY_RAIN_1H_MM ? "font-semibold text-amber-700" : "text-slate-700"}`} title={s.max_1h_at ? timeLabel(s.max_1h_at) : undefined}>{fmt(s.max_1h_mm)}</td>
                  <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{s.rain_days ?? "–"}</td>
                </>
              ) : null}
              <td className="py-2 pr-3 text-right tabular-nums text-slate-700">{s.heavy_days || "–"}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length > 10 ? (
        <button type="button" onClick={() => setAll((v) => !v)} className="mt-2 min-h-9 rounded-lg px-2 text-sm font-semibold text-[#0b4c86] hover:bg-sky-50">
          {all ? "แสดง 10 สถานีแรก" : `แสดงทั้งหมด ${rows.length} สถานี`}
        </button>
      ) : null}
    </div>
  );
}

export default function HydroRainSection({ rain, dates, amphoe, onAmphoe, detailed }) {
  const daily = rain.daily || [];
  const hasRain = daily.some((d) => d.max_mm !== null);
  const stations = useMemo(() => (amphoe ? (rain.stations || []).filter((s) => s.amphoe === amphoe) : rain.stations || []), [rain.stations, amphoe]);
  const intensity = rain.intensity || { bucket_hours: 1, area: [] };
  const areaText = amphoe ? `อ.${amphoe}` : "ทั้งจังหวัด";
  const areaPicker = <Segmented label="พื้นที่" value={amphoe} onChange={onAmphoe} options={[["", "ทั้งจังหวัด"], ...(rain.districts || []).map((d) => [d, `อ.${d}`])]} />;

  if (!hasRain) {
    return (
      <Panel icon="cloud" title="ฝนรายวัน" bodyClassName="space-y-3 p-4">
        {rain.districts?.length ? areaPicker : null}
        <EmptyPanel icon="cloud" title="ยังไม่มีข้อมูลฝนในช่วงนี้" text="ระบบเก็บค่าฝนจากสถานี ThaiWater ทุก 10 นาที ข้อมูลจะเริ่มแสดงหลังเก็บได้อย่างน้อย 1 วัน" />
      </Panel>
    );
  }
  return (
    <>
      <Panel icon="cloud" title={`ฝนรายวัน · ${areaText}`} subtitle="แท่ง = สถานีที่ฝนมากที่สุดของวัน (สีตามเกณฑ์ฝน 24 ชม.) · เส้นทึบ = เฉลี่ยทุกสถานี · เส้นประ = ฝนสะสมเฉลี่ยตั้งแต่ต้นช่วง (แกนขวา)" bodyClassName="space-y-3 p-4">
        {areaPicker}
        <RainDailyChart daily={daily} />
      </Panel>

      {detailed && intensity.area.length ? (
        <Panel icon="cloud" title={`ความแรงฝน${bucketText(intensity.bucket_hours)} · ${areaText}`} subtitle={`ฝนที่ตกในแต่ละช่วง (${bucketText(intensity.bucket_hours)}) · แท่ง = สถานีที่ฝนแรงที่สุด · เส้น = เฉลี่ยทุกสถานี`} bodyClassName="p-4">
          <RainIntensityChart intensity={intensity} />
        </Panel>
      ) : null}

      {detailed && rain.by_district?.length ? (
        <Panel icon="map" title="ฝนรายอำเภอ × วัน" subtitle="กดชื่ออำเภอเพื่อดูกราฟและสถานีของอำเภอนั้น" bodyClassName="p-4">
          <RainHeatmap rows={rain.by_district} dates={dates} selected={amphoe} onSelect={onAmphoe} />
        </Panel>
      ) : null}

      <Panel icon="cloud" title={`สถานีวัดฝน · ${areaText}`} subtitle={`${stations.length} สถานี · กดหัวตารางเพื่อเรียงลำดับ`} bodyClassName="p-4">
        <RainStationTable stations={stations} detailed={detailed} />
      </Panel>
    </>
  );
}
