"use client";

// แนวโน้มน้ำ ฝน และน้ำทะเลหนุน: กราฟจากข้อมูลที่ระบบเก็บรายชั่วโมง (ThaiWater, ปภ., IOC/Open-Meteo)
import { useCallback, useEffect, useMemo, useState } from "react";
import { CloudRain, Download, Droplets, RefreshCw, Waves } from "lucide-react";
import {
  Bar, CartesianGrid, ComposedChart, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis
} from "recharts";
import { PageHero, Panel, EmptyPanel, heroButtonClass } from "@/components/common/ThemePanels";
import { MetricCard, MetricGrid } from "@/components/common/MetricCards";
import { downloadCsv } from "@/lib/exportCsv";
import { HEAVY_RAIN_MM, RANGE_DAYS, VERY_HEAVY_RAIN_MM } from "@/lib/hydroHistory";

const API = "/stn-eoc/api/eoc/hydro-trends";
const C = { navy: "#0b4c86", teal: "#2a9db0", deep: "#0c2f4a", red: "#dc2626", amber: "#d97706", grid: "#e2e8f0", muted: "#64748b" };
const TH_MONTH = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

function dayLabel(date) {
  const [, m, d] = String(date).slice(0, 10).split("-");
  return `${Number(d)} ${TH_MONTH[Number(m) - 1] || ""}`;
}
function timeLabel(t, days) {
  const text = String(t);
  return days <= 7 ? `${dayLabel(text)} ${text.slice(11, 16)}` : dayLabel(text);
}
const fmt = (value, digits = 1) => (value === null || value === undefined ? "–" : Number(value).toLocaleString("th-TH", { minimumFractionDigits: digits, maximumFractionDigits: digits }));
const signed = (value) => (value === null || value === undefined ? "–" : `${value > 0 ? "+" : ""}${fmt(value, 2)}`);

function ChartTip({ active, payload, label, unit, days, isDate }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs shadow-lg">
      <p className="font-semibold text-slate-900">{isDate ? dayLabel(label) : timeLabel(label, days)}</p>
      {payload.filter((p) => p.value !== null && p.value !== undefined).map((p) => (
        <p key={p.dataKey} className="mt-0.5 flex items-center gap-1.5 text-slate-700">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: p.color }} aria-hidden="true" />{p.name}: <b className="tabular-nums">{fmt(p.value, unit === "มม." ? 1 : 2)}</b> {unit}
        </p>
      ))}
    </div>
  );
}

function Segmented({ options, value, onChange, label, tone = "light" }) {
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

// กราฟเส้นเล็กในการ์ดสถานี: ระดับน้ำตามช่วงที่เลือก · เส้นประ = ตลิ่ง (เมื่ออยู่ใกล้ช่วงของกราฟ)
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

function CoverageNote({ coverage, from }) {
  const later = [["ฝน", coverage.rain], ["ระดับน้ำในคลอง", coverage.water], ["น้ำทะเล", coverage.sea]]
    .filter(([, start]) => !start || start.slice(0, 10) > from);
  if (!later.length) return null;
  return (
    <p className="rounded-xl bg-amber-50 px-4 py-3 text-sm text-amber-900">
      ระบบเริ่มเก็บข้อมูลไม่นาน ช่วงก่อนหน้านี้จึงยังไม่มีข้อมูล: {later.map(([name, start]) => `${name} ${start ? `เริ่ม ${dayLabel(start)} ${start.slice(11, 16)} น.` : "ยังไม่มีข้อมูล"}`).join(" · ")}
    </p>
  );
}

/** publicMode = หน้าประชาชน (/public/water-trends): ใช้ API สาธารณะ และคำอธิบายแบบประชาชน */
export default function HydroTrendsWorkspace({ publicMode = false }) {
  const api = publicMode ? "/stn-eoc/api/public/hydro-trends" : API;
  const [days, setDays] = useState(7);
  const [amphoe, setAmphoe] = useState("");
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [stationCode, setStationCode] = useState("");

  const load = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: "" }));
    try {
      const response = await fetch(`${api}?days=${days}${amphoe ? `&amphoe=${encodeURIComponent(amphoe)}` : ""}`, { cache: "no-store" });
      const json = await response.json();
      if (!response.ok || !json.success) throw new Error(json.message || "โหลดข้อมูลไม่สำเร็จ");
      setState({ loading: false, data: json.data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [api, days, amphoe]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  // สถานี ปภ. ก่อน แล้วตามด้วย ThaiWater (ในกลุ่มเดียวกันเรียงจากใกล้/เกินตลิ่งมากที่สุด)
  const waterStations = useMemo(() => [...(data?.water?.stations || [])].sort((a, b) =>
    (a.source === "ปภ." ? 0 : 1) - (b.source === "ปภ." ? 0 : 1) || (b.peak?.diff ?? -99) - (a.peak?.diff ?? -99)
  ), [data]);
  const station = waterStations.find((s) => s.code === stationCode) || waterStations[0] || null;
  const rainDaily = data?.rain?.daily || [];
  const rainStations = data?.rain?.stations || [];
  const sea = data?.sea || {};

  const heavyDays = rainDaily.filter((d) => (d.max_mm ?? 0) >= HEAVY_RAIN_MM).length;
  const wettest = rainStations[0] || null;
  const overBank = waterStations.filter((s) => s.hours_over_bank > 0);
  const hasRain = rainDaily.some((d) => d.max_mm !== null);
  const seaHasData = (sea.series || []).some((p) => p.model !== null || p.observed !== null);

  const exportCsv = () => {
    if (!data) return;
    downloadCsv([
      [`แนวโน้มน้ำและฝน จ.สตูล ${data.range.from} ถึง ${data.range.to}${data.rain.amphoe ? ` (อ.${data.rain.amphoe})` : ""}`],
      [],
      ["ฝนรายวัน (07:00–07:00)", "เฉลี่ย (มม.)", "สูงสุด (มม.)", "สถานีที่ฝนมากสุด", "จำนวนสถานี"],
      ...rainDaily.map((d) => [d.date, d.avg_mm ?? "", d.max_mm ?? "", d.max_station || "", d.stations]),
      [],
      ["สถานีวัดฝน", "อำเภอ", "ฝนรวม (มม.)", "สูงสุดต่อวัน (มม.)", "วันฝนหนัก"],
      ...rainStations.map((s) => [s.name, s.amphoe || "", s.total_mm ?? "", s.max_day_mm ?? "", s.heavy_days]),
      [],
      ["สถานีวัดระดับน้ำ", "แหล่งข้อมูล", "ตลิ่ง (ม.)", "สูงสุด (ม.)", "เวลาสูงสุด", "เทียบตลิ่ง (ม.)", "ชม.ที่ล้นตลิ่ง"],
      ...waterStations.map((s) => [s.name, s.source, s.bank ?? "", s.peak?.level ?? "", s.peak?.t || "", s.peak?.diff ?? "", s.hours_over_bank])
    ], `hydro-trends-${data.range.from}-${data.range.to}.csv`);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-4 font-[family-name:var(--font-kanit)]">
      <PageHero
        icon="waves"
        eyebrow={publicMode ? "ข้อมูลจากสถานีตรวจวัด จ.สตูล" : "วิเคราะห์ข้อมูล"}
        title={publicMode ? "แนวโน้มระดับน้ำและฝน" : "แนวโน้มน้ำ ฝน และน้ำทะเลหนุน"}
        subtitle={publicMode
          ? "ฝนรายวัน ระดับน้ำในคลองเทียบตลิ่ง และน้ำทะเลหนุนหน้าสตูล ย้อนหลัง 7–90 วัน ใช้ประกอบการเฝ้าระวังน้ำท่วม"
          : "จากค่าที่ระบบเก็บทุกชั่วโมง: ฝนรายสถานี (ThaiWater) ระดับน้ำในคลอง (ThaiWater, ปภ.) และระดับน้ำทะเลหน้าสตูล"}
        actions={(
          <>
            <Segmented tone="dark" label="ช่วงเวลา" value={days} onChange={setDays} options={RANGE_DAYS.map((d) => [d, `${d} วัน`])} />
            <button type="button" onClick={load} disabled={state.loading} className={heroButtonClass}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />รีเฟรช</button>
            <button type="button" onClick={exportCsv} disabled={!data} className={heroButtonClass}><Download className="h-4 w-4" aria-hidden="true" />CSV</button>
          </>
        )}
        meta={data ? `${dayLabel(data.range.from)} – ${dayLabel(data.range.to)} · ฝนนับวันแบบกรมอุตุฯ (07:00 ถึง 07:00 วันถัดไป)` : null}
      />

      {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error} <button type="button" onClick={load} className="ml-2 font-semibold underline">ลองใหม่</button></p> : null}
      {!data && state.loading ? <div className="h-96 animate-pulse rounded-2xl bg-white" aria-hidden="true" /> : null}

      {data ? (
        <>
          <CoverageNote coverage={data.coverage} from={data.range.from} />

          <MetricGrid cols="grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={CloudRain} tone={heavyDays ? "amber" : "blue"} label="วันที่มีฝนหนัก" value={heavyDays} unit="วัน" note={`สถานีใดสถานีหนึ่ง ≥ ${HEAVY_RAIN_MM} มม.`} />
            <MetricCard icon={Droplets} tone="blue" label="ฝนสะสมมากสุด" value={wettest ? fmt(wettest.total_mm) : "–"} unit="มม." note={wettest ? `${wettest.name}${wettest.amphoe ? ` อ.${wettest.amphoe}` : ""}` : "ยังไม่มีข้อมูล"} />
            <MetricCard icon={Waves} tone={overBank.length ? "red" : "green"} label="สถานีที่เคยล้นตลิ่ง" value={overBank.length} unit={`/${waterStations.length}`} note={overBank.length ? overBank.slice(0, 2).map((s) => s.name).join(", ") : "ไม่มีสถานีล้นตลิ่งในช่วงนี้"} />
            <MetricCard icon={Waves} tone={sea.high_days ? "amber" : "blue"} label="น้ำทะเลสูงสุด" value={sea.peak ? fmt(sea.peak.level, 2) : "–"} unit="ม." note={sea.peak ? `${dayLabel(sea.peak.t)} ${sea.peak.t.slice(11, 16)} น. · หนุนสูง ${sea.high_days || 0} วัน` : "ยังไม่มีข้อมูล"} />
          </MetricGrid>

          {/* ฝน */}
          <Panel icon="cloud" title="ฝนรายวัน" subtitle="แท่ง = สถานีที่ฝนมากที่สุดของวัน · เส้น = ค่าเฉลี่ยทุกสถานี" bodyClassName="p-4"
            action={<Segmented label="พื้นที่" value={amphoe} onChange={setAmphoe} options={[["", "ทั้งจังหวัด"], ...data.rain.districts.map((d) => [d, `อ.${d}`])]} />}>
            {hasRain ? (
              <>
                <div className="h-72" role="img" aria-label="กราฟฝนรายวัน">
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={rainDaily} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
                      <CartesianGrid stroke={C.grid} vertical={false} />
                      <XAxis dataKey="date" tickFormatter={dayLabel} tick={{ fontSize: 12, fill: C.muted }} minTickGap={16} />
                      <YAxis tick={{ fontSize: 12, fill: C.muted }} unit="" />
                      <Tooltip content={<ChartTip unit="มม." isDate />} />
                      <ReferenceLine y={HEAVY_RAIN_MM} stroke={C.amber} strokeDasharray="4 4" label={{ value: "ฝนหนัก", position: "insideTopRight", fill: C.amber, fontSize: 11 }} />
                      <ReferenceLine y={VERY_HEAVY_RAIN_MM} stroke={C.red} strokeDasharray="4 4" label={{ value: "หนักมาก", position: "insideTopRight", fill: C.red, fontSize: 11 }} />
                      <Bar dataKey="max_mm" name="สูงสุด" fill={C.teal} radius={[4, 4, 0, 0]} maxBarSize={28} />
                      <Line dataKey="avg_mm" name="เฉลี่ย" stroke={C.deep} strokeWidth={2} dot={false} connectNulls />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-4 overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead><tr className="border-b border-slate-200 text-left text-xs text-slate-500"><th className="py-2 pr-3 font-medium">สถานีวัดฝน</th><th className="py-2 pr-3 font-medium">อำเภอ</th><th className="py-2 pr-3 text-right font-medium">ฝนรวม (มม.)</th><th className="py-2 pr-3 text-right font-medium">สูงสุดต่อวัน</th><th className="py-2 text-right font-medium">วันฝนหนัก</th></tr></thead>
                    <tbody>
                      {rainStations.slice(0, 12).map((s) => (
                        <tr key={s.id} className="border-b border-slate-100">
                          <td className="py-2 pr-3 text-slate-900">{s.name}{s.tambon ? <span className="text-slate-500"> · ต.{s.tambon}</span> : null}</td>
                          <td className="py-2 pr-3 text-slate-600">{s.amphoe ? `อ.${s.amphoe}` : "–"}</td>
                          <td className="py-2 pr-3 text-right tabular-nums font-semibold text-slate-900">{fmt(s.total_mm)}</td>
                          <td className={`py-2 pr-3 text-right tabular-nums ${(s.max_day_mm ?? 0) >= HEAVY_RAIN_MM ? "font-semibold text-amber-700" : "text-slate-700"}`}>{fmt(s.max_day_mm)}</td>
                          <td className="py-2 text-right tabular-nums text-slate-700">{s.heavy_days || "–"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {rainStations.length > 12 ? <p className="mt-2 text-xs text-slate-500">แสดง 12 จาก {rainStations.length} สถานี (ดาวน์โหลด CSV เพื่อดูทั้งหมด)</p> : null}
                </div>
              </>
            ) : <EmptyPanel icon="cloud" title="ยังไม่มีข้อมูลฝนในช่วงนี้" text="ระบบเก็บค่าฝนจากสถานี ThaiWater ทุก 10 นาที ข้อมูลจะเริ่มแสดงหลังเก็บได้อย่างน้อย 1 วัน" />}
          </Panel>

          {/* ระดับน้ำในคลอง */}
          <Panel icon="waves" title="ระดับน้ำในคลอง" subtitle={`จุดบนกราฟ = ค่าสูงสุดของ${days <= 7 ? "แต่ละชั่วโมง" : days <= 30 ? "ทุก 3 ชั่วโมง" : "แต่ละวัน"} · เส้นแดง = ตลิ่ง`} bodyClassName="p-4">
            {waterStations.length ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_20rem]">
                <div className="min-w-0">
                  <label className="mb-2 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    สถานี
                    <select value={station?.code || ""} onChange={(e) => setStationCode(e.target.value)} className="min-h-10 max-w-full rounded-xl border border-slate-300 bg-white px-3 text-sm text-slate-900">
                      {waterStations.map((s) => <option key={s.code} value={s.code}>{s.name} ({s.source})</option>)}
                    </select>
                  </label>
                  <div className="h-72" role="img" aria-label={`กราฟระดับน้ำ สถานี${station?.name || ""}`}>
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={station?.series || []} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                        <CartesianGrid stroke={C.grid} vertical={false} />
                        <XAxis dataKey="t" tickFormatter={(t) => (days <= 7 ? dayLabel(t) : dayLabel(t))} tick={{ fontSize: 12, fill: C.muted }} minTickGap={28} />
                        <YAxis tick={{ fontSize: 12, fill: C.muted }} domain={["auto", (max) => Math.max(max, station?.bank ?? max) + 0.2]} tickFormatter={(v) => fmt(v, 1)} />
                        <Tooltip content={<ChartTip unit="ม." days={days} />} />
                        {station?.bank !== null && station?.bank !== undefined ? (
                          <>
                            <ReferenceLine y={station.bank} stroke={C.red} strokeDasharray="5 4" label={{ value: `ตลิ่ง ${fmt(station.bank, 2)}`, position: "insideTopLeft", fill: C.red, fontSize: 11 }} />
                            <ReferenceLine y={station.bank - 0.5} stroke={C.amber} strokeDasharray="2 4" />
                          </>
                        ) : null}
                        <Line dataKey="level" name="ระดับน้ำ" stroke={C.navy} strokeWidth={2} dot={false} connectNulls />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
                <ul className="max-h-[26rem] space-y-1.5 overflow-y-auto pr-1" aria-label="สถานี ปภ. ก่อน แล้วตามด้วย ThaiWater">
                  {waterStations.map((s, i) => {
                    const on = s.code === station?.code;
                    const over = s.hours_over_bank > 0;
                    const near = !over && s.hours_near_bank > 0;
                    const groupStart = i === 0 || waterStations[i - 1].source !== s.source;
                    return (
                      <li key={s.code}>
                        {groupStart ? <p className={`px-1 pb-1 text-xs font-semibold text-slate-500 ${i ? "pt-2" : ""}`}>{s.source === "ปภ." ? "สถานี ปภ. (กล้อง CCTV ระดับน้ำ)" : "สถานี ThaiWater (สสน.)"}</p> : null}
                        <button type="button" onClick={() => setStationCode(s.code)} aria-pressed={on}
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
            ) : <EmptyPanel icon="waves" title="ยังไม่มีข้อมูลระดับน้ำในช่วงนี้" text="ระบบเก็บระดับน้ำจาก ThaiWater และสถานี ปภ. ทุก 10 นาที" />}
          </Panel>

          {/* น้ำทะเลหนุน */}
          <Panel icon="waves" title="น้ำทะเลหนุน หน้าสตูล" subtitle="เส้นน้ำเงิน = แบบจำลองระดับน้ำทะเลหน้าสตูล · เส้นฟ้า = ค่าวัดจริงสถานีลังกาวี (IOC) · เส้นประ = เกณฑ์หนุนสูงจากสถิติ 30 วัน" bodyClassName="p-4">
            {seaHasData ? (
              <div className="h-72" role="img" aria-label="กราฟระดับน้ำทะเล">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={sea.series} margin={{ top: 8, right: 8, bottom: 0, left: -6 }}>
                    <CartesianGrid stroke={C.grid} vertical={false} />
                    <XAxis dataKey="t" tickFormatter={dayLabel} tick={{ fontSize: 12, fill: C.muted }} minTickGap={28} />
                    <YAxis tick={{ fontSize: 12, fill: C.muted }} tickFormatter={(v) => fmt(v, 1)} domain={["auto", "auto"]} />
                    <Tooltip content={<ChartTip unit="ม." days={days} />} />
                    {Number.isFinite(sea.thresholds?.elevated) ? <ReferenceLine y={sea.thresholds.elevated} stroke={C.amber} strokeDasharray="4 4" label={{ value: "หนุนสูงกว่าปกติ", position: "insideTopLeft", fill: C.amber, fontSize: 11 }} /> : null}
                    {Number.isFinite(sea.thresholds?.high) ? <ReferenceLine y={sea.thresholds.high} stroke={C.red} strokeDasharray="4 4" label={{ value: "หนุนสูง", position: "insideTopLeft", fill: C.red, fontSize: 11 }} /> : null}
                    <Line dataKey="model" name="แบบจำลองหน้าสตูล" stroke={C.navy} strokeWidth={2} dot={false} connectNulls />
                    <Line dataKey="observed" name="วัดจริง (ลังกาวี)" stroke={C.teal} strokeWidth={1.5} dot={false} connectNulls />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : <EmptyPanel icon="waves" title="ยังไม่มีข้อมูลน้ำทะเลในช่วงนี้" text="ระบบเก็บระดับน้ำทะเลทุก 10 นาที (บันทึกชั่วโมงละ 1 ค่า)" />}
          </Panel>

          <p className="text-xs leading-5 text-slate-500">
            ที่มา: คลังข้อมูลน้ำแห่งชาติ (ThaiWater) สสน. · ระบบ CCTV ระดับน้ำ กรมป้องกันและบรรเทาสาธารณภัย · IOC Sea Level Monitoring · Open-Meteo Marine ·
            ค่าเป็นข้อมูลอัตโนมัติจากสถานี อาจมีค่าผิดพลาดหรือขาดช่วงเมื่อสถานีขัดข้อง
          </p>
        </>
      ) : null}
    </div>
  );
}
