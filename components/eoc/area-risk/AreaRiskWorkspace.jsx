"use client";

// วิเคราะห์และพยากรณ์พื้นที่เสี่ยงน้ำท่วมรายตำบล
//  - ตอนนี้: ภัยจริงตอนนี้ × ความเปราะบาง
//  - พยากรณ์ 7 วัน: ฝน ECMWF รายตำบล + น้ำในคลอง (ThaiWater/GloFAS) + น้ำทะเลหนุน (พยากรณ์น้ำขึ้น) × ความเปราะบาง
//  - จำลองสถานการณ์: "ถ้าฝนตก X มม. คลอง... น้ำทะเล..." → ตำบล/หมู่บ้านที่คาดว่าท่วม
//  - ความเปราะบางพื้นฐาน: ประวัติน้ำท่วม ภูมิประเทศ คน และกลุ่มเปราะบาง
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, CloudRain, Database, Layers, RefreshCw, TriangleAlert, Waves } from "lucide-react";
import { AdminPage, Button, FilterSelect, StatusPill, Tabs, Toolbar } from "@/components/admin/crud";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { BASELINE_LEVELS, areaKey } from "@/lib/areaRisk";
import { CANAL_STATES, EXTENT_MIN_FREQ, SEA_STATES, runScenario } from "@/lib/floodForecast";
import { RISK_LEVELS, RISK_META } from "@/lib/weatherRiskConfig";

const BacktestPanel = dynamic(() => import("@/components/eoc/area-risk/BacktestPanel"), { ssr: false });
const AreaRiskMap = dynamic(() => import("@/components/eoc/area-risk/AreaRiskMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" aria-label="กำลังโหลดแผนที่" />
});

const NOW_COLORS = { normal: "#cbd5e1", watch: RISK_META.watch.color, high: RISK_META.high.color, critical: RISK_META.critical.color };
const BASE_COLORS = { low: "#e7e5e4", medium: "#fdba74", high: "#c2410c" };
const SEA_LABEL = Object.fromEntries(SEA_STATES.map((s) => [s.key, s.label]));
const CANAL_LABEL = Object.fromEntries(CANAL_STATES.map((s) => [s.key, s.label]));
const RAIN_PRESETS = [
  { value: 35, label: "ฝนหนัก 35" },
  { value: 60, label: "หนักมาก 60" },
  { value: 90, label: "90" },
  { value: 150, label: "150 มม." }
];

const dayLabel = (date, index) => {
  const d = new Date(`${date}T12:00:00+07:00`);
  const text = d.toLocaleDateString("th-TH", { weekday: "short", day: "numeric", month: "short", timeZone: "Asia/Bangkok" });
  return index === 0 ? `วันนี้` : index === 1 ? `พรุ่งนี้` : text;
};

function calibrationText(calibration) {
  const t = calibration?.thresholds || { watch: 12, high: 20, critical: 30 };
  const floor = calibration?.factor_floor ?? 0.5;
  return `${floor}–1.5 → เฝ้าระวัง ≥ ${t.watch}, เสี่ยงสูง ≥ ${t.high}, วิกฤต ≥ ${t.critical}${calibration?.source === "backtest" ? " (ปรับเทียบแล้ว)" : ""}`;
}

function LevelBadge({ level, score }) {
  return (
    <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: level === "normal" ? "#64748b" : RISK_META[level].color }}>
      {RISK_META[level].label}{score !== undefined ? ` (${score})` : ""}
    </span>
  );
}

function ScoreBar({ label, part, tone }) {
  const pct = Math.round((part.score / part.max) * 100);
  return (
    <div>
      <div className="flex justify-between text-xs font-semibold text-slate-600"><span>{label}</span><span className="tabular-nums">{part.score}/{part.max}</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: tone }} /></div>
      {part.factors.length ? (
        <ul className="mt-1 space-y-0.5 text-xs text-slate-600">
          {part.factors.map((factor) => <li key={factor.label} className="flex justify-between gap-2"><span>{factor.label}</span><span className="shrink-0 tabular-nums text-slate-400">+{factor.points}</span></li>)}
        </ul>
      ) : <p className="mt-1 text-xs text-slate-400">ไม่มีปัจจัย</p>}
    </div>
  );
}

function ExtentBox({ extent }) {
  if (!extent) return <p className="text-xs text-slate-500">ไม่มีแปลงที่ดาวเทียมเคยพบน้ำท่วมในระดับนี้ — ถ้าท่วม น่าจะเป็นน้ำท่วมขังเฉพาะจุด</p>;
  return (
    <section className="rounded-xl border border-blue-200 bg-blue-50 p-3">
      <h4 className="text-sm font-black text-blue-900">จุดที่คาดว่าน้ำท่วม</h4>
      <p className="mt-0.5 text-xs text-blue-900">
        แปลงที่ดาวเทียมเคยพบน้ำท่วม{extent.min_freq > 1 ? ` ≥ ${extent.min_freq} ปี` : ""} รวมราว <b>{formatNumber(extent.rai)} ไร่</b>
        {extent.villages.length ? <> • {extent.villages.length} หมู่บ้าน {formatNumber(extent.households)} ครัวเรือน</> : null}
      </p>
      {extent.villages.length ? (
        <ul className="mt-1.5 flex flex-wrap gap-1">
          {extent.villages.slice(0, 12).map((village) => (
            <li key={village.name} className="rounded-full bg-white px-2 py-0.5 text-[11px] text-blue-900 ring-1 ring-blue-200">{village.name} <span className="text-blue-500">{formatNumber(village.households)} ครัวเรือน</span></li>
          ))}
          {extent.villages.length > 12 ? <li className="text-[11px] text-blue-700">และอีก {extent.villages.length - 12} หมู่บ้าน</li> : null}
        </ul>
      ) : null}
    </section>
  );
}

function FactorList({ factors }) {
  if (!factors?.length) return <p className="text-xs text-slate-400">ไม่มีปัจจัยเสี่ยงในเงื่อนไขนี้</p>;
  return (
    <ul className="space-y-0.5 text-xs text-slate-700">
      {factors.map((factor) => <li key={factor.label} className="flex justify-between gap-2"><span>{factor.label}</span><span className="shrink-0 tabular-nums text-slate-400">+{factor.points}</span></li>)}
    </ul>
  );
}

function NowDetail({ area }) {
  const now = RISK_META[area.now_level];
  const base = BASELINE_LEVELS[area.baseline_level];
  return (
    <div className="space-y-4 p-4">
      <div>
        <h3 className="font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]">ต.{area.tambon} <span className="text-base font-normal text-slate-500">อ.{area.district}</span></h3>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          <span className="rounded-full px-2.5 py-0.5 text-xs font-bold text-white" style={{ backgroundColor: area.now_level === "normal" ? "#64748b" : now.color }}>ตอนนี้: {now.label} ({area.now_score})</span>
          <span className="rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ backgroundColor: BASE_COLORS[area.baseline_level], color: area.baseline_level === "high" ? "#fff" : "#1c1917" }}>{base.label} ({area.baseline_index}/60)</span>
          {area.coastal ? <span className="rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-800">ติดทะเล</span> : null}
        </div>
      </div>
      {area.actions.length ? (
        <section className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <h4 className="flex items-center gap-1.5 text-sm font-black text-amber-900"><TriangleAlert className="h-4 w-4" aria-hidden="true" />สิ่งที่ควรทำ</h4>
          <ul className="mt-1.5 space-y-1 text-sm text-amber-950">{area.actions.map((item) => <li key={item}>• {item}</li>)}</ul>
        </section>
      ) : null}
      <ScoreBar label="ภัยตอนนี้" part={area.hazard} tone="#dc2626" />
      <ScoreBar label="ความเปราะบางของพื้นที่ (ประวัติน้ำท่วม + ภูมิประเทศ)" part={area.susceptibility} tone="#c2410c" />
      <ScoreBar label="คนและกลุ่มเปราะบาง" part={area.exposure} tone="#7c3aed" />
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">ครัวเรือน</dt><dd className="font-bold">{formatNumber(area.households)}</dd></div>
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">ความสูงเฉลี่ย / ต่ำกว่า 10 ม.</dt><dd className="font-bold">{area.terrain ? `${area.terrain.mean_m} ม. / ${area.terrain.low10_pct}%` : "-"}</dd></div>
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">ติดเตียง/พิการ/ตั้งครรภ์</dt><dd className="font-bold">{area.vulnerable ? formatNumber(area.vulnerable.priority) : "ไม่มีข้อมูล"}</dd></div>
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">ศูนย์พักพิงในตำบล</dt><dd className="font-bold">{area.shelters.length ? `${area.shelters.length} แห่ง • ว่าง ${formatNumber(area.shelters.reduce((s, x) => s + x.vacancy, 0))}` : "ไม่มี"}</dd></div>
      </dl>
      {area.missing.length ? <p className="text-xs text-slate-500">ข้อมูลที่ยังไม่มีสำหรับตำบลนี้: {area.missing.join(", ")}</p> : null}
      <Link href="/eoc/flood/vulnerable-persons" className="inline-flex text-sm font-bold text-[#0b4c86] underline-offset-4 hover:underline">เปิดแผนที่กลุ่มเปราะบางรายบุคคล</Link>
    </div>
  );
}

function ForecastDetail({ area, dayIndex, dates, onPickDay }) {
  const day = area.forecast.days[dayIndex];
  return (
    <div className="space-y-3 p-4">
      <div>
        <h3 className="font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]">ต.{area.tambon} <span className="text-base font-normal text-slate-500">อ.{area.district}</span></h3>
        <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs">
          <LevelBadge level={day.level} score={day.score} />
          {area.coastal ? <span className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-800">ติดทะเล</span> : null}
          {area.riverine ? <span className="rounded-full bg-teal-100 px-2 py-0.5 font-bold text-teal-800">ริมคลอง/ที่ราบน้ำท่วมถึง</span> : null}
          <span className="text-slate-500">ความเปราะบาง ×{day.factor}</span>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1" role="group" aria-label="ระดับความเสี่ยง 7 วัน">
        {area.forecast.days.map((d, i) => (
          <button key={d.date} type="button" onClick={() => onPickDay(i)} className={`rounded-md px-0.5 py-1 text-center text-[10px] ${i === dayIndex ? "ring-2 ring-[#0c2f4a]" : ""}`} style={{ backgroundColor: NOW_COLORS[d.level], color: d.level === "normal" ? "#334155" : "#fff" }}>
            <span className="block font-bold">{dayLabel(dates[i], i)}</span>
            <span className="block">{d.rain24} มม.</span>
          </button>
        ))}
      </div>
      <dl className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">ฝน 24 ชม. / สะสม 3 วัน</dt><dd className="font-bold">{day.rain24} / {day.rain72} มม.</dd></div>
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">น้ำในคลอง</dt><dd className="font-bold">{area.riverine ? CANAL_LABEL[day.canal] || day.canal : "ไม่เกี่ยว (ไม่มีคลองใกล้)"}</dd></div>
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">น้ำทะเล</dt><dd className="font-bold">{area.coastal ? SEA_LABEL[day.sea] || day.sea : "ไม่ติดทะเล"}</dd></div>
        <div className="rounded-lg bg-slate-50 p-2"><dt className="text-slate-500">ฝนตรงช่วงน้ำขึ้น</dt><dd className="font-bold">{day.compound ? "ใช่" : "ไม่"}</dd></div>
      </dl>
      <div><h4 className="mb-1 text-xs font-black text-slate-700">เหตุผล</h4><FactorList factors={day.factors} /></div>
      {day.level !== "normal" ? <ExtentBox extent={day.extent} /> : null}
    </div>
  );
}

function ScenarioDetail({ result, area }) {
  return (
    <div className="space-y-3 p-4">
      <h3 className="font-[family-name:var(--font-kanit)] text-xl font-semibold text-[#0c2f4a]">ต.{result.tambon} <span className="text-base font-normal text-slate-500">อ.{result.district}</span></h3>
      <div className="flex flex-wrap items-center gap-1.5 text-xs">
        <LevelBadge level={result.level} score={result.score} />
        {area?.coastal ? <span className="rounded-full bg-sky-100 px-2 py-0.5 font-bold text-sky-800">ติดทะเล</span> : null}
        {area?.riverine ? <span className="rounded-full bg-teal-100 px-2 py-0.5 font-bold text-teal-800">ริมคลอง/ที่ราบน้ำท่วมถึง</span> : null}
        <span className="text-slate-500">ความเปราะบาง ×{result.factor}</span>
      </div>
      <FactorList factors={result.factors} />
      {result.level !== "normal" ? <ExtentBox extent={result.extent} /> : null}
    </div>
  );
}

function ScenarioControls({ value, onChange }) {
  const set = (key) => (next) => onChange({ ...value, [key]: next });
  return (
    <section className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-4 lg:grid-cols-[1.3fr_1fr_1fr]">
      <div>
        <label className="flex items-baseline justify-between text-sm font-bold text-slate-800" htmlFor="sc-rain">
          <span className="flex items-center gap-1.5"><CloudRain className="h-4 w-4 text-sky-600" aria-hidden="true" />ฝน 24 ชม.</span>
          <span className="font-[family-name:var(--font-kanit)] text-xl text-sky-700">{value.rain24} มม.</span>
        </label>
        <input id="sc-rain" type="range" min={0} max={300} step={5} value={value.rain24} onChange={(e) => onChange({ ...value, rain24: Number(e.target.value), rain72: Math.max(value.rain72, Number(e.target.value)) })} className="mt-1 w-full accent-sky-600" />
        <div className="mt-1 flex flex-wrap gap-1">
          {RAIN_PRESETS.map((preset) => (
            <button key={preset.value} type="button" onClick={() => onChange({ ...value, rain24: preset.value, rain72: Math.max(value.rain72, preset.value) })} className={`rounded-full px-2 py-0.5 text-xs font-bold ring-1 ${value.rain24 === preset.value ? "bg-sky-600 text-white ring-sky-600" : "text-slate-600 ring-slate-300"}`}>{preset.label}</button>
          ))}
        </div>
        <label className="mt-2 flex items-baseline justify-between text-xs font-bold text-slate-600" htmlFor="sc-rain72">ฝนสะสม 3 วัน <span>{value.rain72} มม.</span></label>
        <input id="sc-rain72" type="range" min={value.rain24} max={600} step={10} value={value.rain72} onChange={(e) => set("rain72")(Number(e.target.value))} className="w-full accent-sky-600" />
      </div>
      <fieldset>
        <legend className="text-sm font-bold text-slate-800">น้ำในคลอง</legend>
        <div className="mt-1 grid gap-1">
          {CANAL_STATES.filter((s) => ["normal", "near", "overflow"].includes(s.key)).map((s) => (
            <label key={s.key} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ${value.canal === s.key ? "bg-teal-50 font-bold text-teal-900 ring-teal-400" : "ring-slate-200"}`}>
              <input type="radio" name="sc-canal" className="accent-teal-600" checked={value.canal === s.key} onChange={() => set("canal")(s.key)} />{s.label}
            </label>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend className="text-sm font-bold text-slate-800">น้ำทะเลหนุน</legend>
        <div className="mt-1 grid gap-1">
          {SEA_STATES.map((s) => (
            <label key={s.key} className={`flex cursor-pointer items-center gap-2 rounded-lg px-2 py-1.5 text-sm ring-1 ${value.sea === s.key ? "bg-sky-50 font-bold text-sky-900 ring-sky-400" : "ring-slate-200"}`}>
              <input type="radio" name="sc-sea" className="accent-sky-600" checked={value.sea === s.key} onChange={() => set("sea")(s.key)} />{s.label}
            </label>
          ))}
        </div>
        <label className="mt-2 flex items-center gap-2 text-xs text-slate-700">
          <input type="checkbox" checked={value.compoundTiming} onChange={(e) => set("compoundTiming")(e.target.checked)} />ฝนตกหนักตรงช่วงน้ำขึ้นสูงสุด
        </label>
      </fieldset>
    </section>
  );
}

export default function AreaRiskWorkspace({ initialData = null, initialBacktest = null }) {
  const [state, setState] = useState({ loading: !initialData, data: initialData, error: "" });
  const [mode, setMode] = useState("now");
  const [district, setDistrict] = useState("all");
  const [selected, setSelected] = useState(null);
  const [dayIndex, setDayIndex] = useState(0);
  const [scenario, setScenario] = useState({ rain24: 90, rain72: 150, canal: "near", sea: "high", compoundTiming: false });
  const [showPatches, setShowPatches] = useState(true);
  const [patchData, setPatchData] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState({ loading: false, data: await apiRequest("/stn-eoc/api/eoc/area-risk"), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { if (!initialData) load(); }, [load, initialData]);

  const data = state.data;
  const forecast = data?.forecast || null;
  const areas = useMemo(() => data?.areas || [], [data]);
  const byKey = useMemo(() => new Map(areas.map((area) => [area.key, area])), [areas]);
  const fcByKey = useMemo(() => new Map((forecast?.areas || []).map((area) => [area.key, area])), [forecast]);
  const scenarioRun = useMemo(() => (forecast ? runScenario(forecast.areas, scenario, forecast.calibration) : null), [forecast, scenario]);
  const scByKey = useMemo(() => new Map((scenarioRun?.results || []).map((r) => [r.key, r])), [scenarioRun]);
  const districts = useMemo(() => [...new Set(areas.map((area) => area.district))].sort((a, b) => a.localeCompare(b, "th")), [areas]);

  // ระดับและคะแนนของแต่ละตำบลตามโหมดที่เลือก
  const levelOf = useCallback((key) => {
    if (mode === "now") return byKey.get(key)?.now_level;
    if (mode === "baseline") return byKey.get(key)?.baseline_level;
    if (mode === "forecast") return fcByKey.get(key)?.forecast.days[dayIndex]?.level;
    return scByKey.get(key)?.level;
  }, [mode, byKey, fcByKey, scByKey, dayIndex]);
  const scoreOf = useCallback((key) => {
    if (mode === "now") return byKey.get(key)?.now_score ?? 0;
    if (mode === "baseline") return byKey.get(key)?.baseline_index ?? 0;
    if (mode === "forecast") return fcByKey.get(key)?.forecast.days[dayIndex]?.score ?? 0;
    return scByKey.get(key)?.score ?? 0;
  }, [mode, byKey, fcByKey, scByKey, dayIndex]);

  const listed = useMemo(() => areas
    .filter((area) => district === "all" || area.district === district)
    .sort((a, b) => scoreOf(b.key) - scoreOf(a.key)), [areas, district, scoreOf]);
  const colorOf = useCallback((key) => {
    const area = byKey.get(key);
    if (!area) return "#e2e8f0";
    if (district !== "all" && area.district !== district) return "#f1f5f9";
    const level = levelOf(key);
    return mode === "baseline" ? BASE_COLORS[level] || "#e2e8f0" : NOW_COLORS[level] || "#e2e8f0";
  }, [byKey, district, levelOf, mode]);
  const labelOf = useCallback((key) => {
    const area = byKey.get(key);
    const level = levelOf(key);
    const label = mode === "baseline" ? BASELINE_LEVELS[level]?.label : RISK_META[level]?.label;
    return area ? `ต.${area.tambon} อ.${area.district} — ${label || "-"}` : key;
  }, [byKey, levelOf, mode]);

  // แปลงที่คาดว่าน้ำท่วม (พยากรณ์/จำลอง): โหลดแปลงน้ำท่วมซ้ำ GISTDA ครั้งเดียวเมื่อเปิดใช้
  const patchMode = mode === "forecast" || mode === "scenario";
  useEffect(() => {
    if (!patchMode || !showPatches || patchData) return;
    apiRequest("/stn-eoc/api/public/flood-freq?min=1").then((json) => setPatchData(json.geojson || null)).catch(() => setPatchData({ type: "FeatureCollection", features: [] }));
  }, [patchMode, showPatches, patchData]);
  const patches = useMemo(() => {
    if (!patchMode || !showPatches || !patchData?.features) return null;
    const features = patchData.features.filter((feature) => {
      const key = areaKey(feature.properties.district, feature.properties.tambon);
      const minFreq = EXTENT_MIN_FREQ[levelOf(key)];
      return minFreq && feature.properties.freq >= minFreq && (district === "all" || byKey.get(key)?.district === district);
    });
    return { type: "FeatureCollection", features };
  }, [patchMode, showPatches, patchData, levelOf, district, byKey]);

  const nowCounts = data?.counts || {};
  const nowAtRisk = (nowCounts.watch || 0) + (nowCounts.high || 0) + (nowCounts.critical || 0);
  const modeCounts = mode === "now" ? nowCounts : mode === "forecast" ? forecast?.counts?.[dayIndex] || {} : mode === "scenario" ? scenarioRun?.counts || {} : null;
  const scenarioTotals = useMemo(() => {
    if (!scenarioRun) return null;
    const hit = scenarioRun.results.filter((r) => r.extent);
    return {
      tambons: scenarioRun.results.filter((r) => r.level !== "normal").length,
      rai: hit.reduce((s, r) => s + r.extent.rai, 0),
      villages: hit.reduce((s, r) => s + r.extent.villages.length, 0),
      households: hit.reduce((s, r) => s + r.extent.households, 0)
    };
  }, [scenarioRun]);

  const selectedArea = selected ? byKey.get(selected) : null;
  const detail = !selected ? <p className="p-4 text-sm text-slate-500">เลือกตำบลบนแผนที่หรือในรายการเพื่อดูเหตุผลและจุดที่คาดว่าน้ำท่วม</p>
    : mode === "forecast" && fcByKey.get(selected) ? <ForecastDetail area={fcByKey.get(selected)} dayIndex={dayIndex} dates={forecast.dates} onPickDay={setDayIndex} />
      : mode === "scenario" && scByKey.get(selected) ? <ScenarioDetail result={scByKey.get(selected)} area={fcByKey.get(selected)} />
        : selectedArea ? <NowDetail area={selectedArea} /> : null;

  return (
    <AdminPage
      title="วิเคราะห์และพยากรณ์พื้นที่เสี่ยงน้ำท่วม"
      description="รวมฝน (วัดจริง + พยากรณ์ ECMWF รายตำบล) ระดับน้ำในคลอง (ปภ. + GloFAS) น้ำทะเลหนุน (พยากรณ์น้ำขึ้น + ค่าวัดจริง) ประวัติน้ำท่วมจากดาวเทียมและของ EOC ความสูงพื้นที่ จำนวนครัวเรือน และกลุ่มเปราะบาง"
      actions={<Button variant="secondary" disabled={state.loading} onClick={load}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />วิเคราะห์ใหม่</Button>}
    >
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {state.loading && !data ? <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">กำลังรวบรวมข้อมูลจากทุกแหล่ง ครั้งแรกอาจใช้เวลาราว 10–30 วินาที…</p> : null}

      {data ? (
        <>
          <Tabs value={mode} onChange={setMode} items={[
            { value: "now", label: "ตอนนี้", count: nowAtRisk },
            { value: "forecast", label: "พยากรณ์ 7 วัน" },
            { value: "scenario", label: "จำลองสถานการณ์" },
            { value: "baseline", label: "ความเปราะบางพื้นฐาน" },
            { value: "accuracy", label: "ความแม่นยำ (ทดสอบย้อนหลัง)" }
          ]} />

          {mode === "accuracy" ? <BacktestPanel initialData={initialBacktest} /> : null}

          {mode === "forecast" && forecast ? (
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-7" role="group" aria-label="เลือกวันพยากรณ์">
              {forecast.dates.map((date, i) => {
                const c = forecast.counts[i] || {};
                const risky = (c.watch || 0) + (c.high || 0) + (c.critical || 0);
                const worst = c.critical ? "critical" : c.high ? "high" : c.watch ? "watch" : "normal";
                const sea = forecast.sea_by_date?.[date];
                return (
                  <button key={date} type="button" onClick={() => setDayIndex(i)} aria-pressed={dayIndex === i}
                    className={`rounded-xl border bg-white p-2 text-left transition ${dayIndex === i ? "border-[#0b4c86] ring-2 ring-[#0b4c86]" : "border-slate-200 hover:border-slate-400"}`}>
                    <span className="block text-xs font-black text-slate-800">{dayLabel(date, i)}</span>
                    <span className="mt-1 flex items-center gap-1 text-[11px] text-slate-600"><span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: NOW_COLORS[worst] }} />{risky ? `${risky} ตำบล` : "ปกติ"}</span>
                    <span className="block text-[11px] text-sky-700"><CloudRain className="mr-0.5 inline h-3 w-3" aria-hidden="true" />สูงสุด {forecast.rain_by_date?.[date] ?? 0} มม.</span>
                    {sea && sea !== "normal" ? <span className="block text-[11px] font-bold text-amber-700"><Waves className="mr-0.5 inline h-3 w-3" aria-hidden="true" />{SEA_LABEL[sea]}</span> : null}
                  </button>
                );
              })}
            </div>
          ) : null}
          {mode === "forecast" && !forecast ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ยังสร้างพยากรณ์ไม่ได้ (ดูรายการแหล่งข้อมูลด้านล่าง)</p> : null}

          {mode === "scenario" && forecast ? (
            <>
              <ScenarioControls value={scenario} onChange={setScenario} />
              {scenarioTotals ? (
                <p className={`rounded-xl px-4 py-3 text-sm ${scenarioTotals.tambons ? "border border-orange-200 bg-orange-50 text-orange-900" : "border border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
                  {scenarioTotals.tambons
                    ? <>ถ้าเกิดสถานการณ์นี้ คาดว่ามี <b>{scenarioTotals.tambons} ตำบล</b> เสี่ยงน้ำท่วม — พื้นที่ที่น่าจะท่วมราว <b>{formatNumber(scenarioTotals.rai)} ไร่</b> ใน {formatNumber(scenarioTotals.villages)} หมู่บ้าน ({formatNumber(scenarioTotals.households)} ครัวเรือน)</>
                    : "สถานการณ์นี้ยังไม่ทำให้ตำบลใดเข้าเกณฑ์เสี่ยงน้ำท่วม"}
                </p>
              ) : null}
            </>
          ) : null}

          {mode === "now" ? (
            <p className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${nowAtRisk ? "border border-orange-200 bg-orange-50 text-orange-900" : "border border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
              {nowAtRisk ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
              {nowAtRisk ? `ตอนนี้มี ${nowAtRisk} ตำบลที่ต้องเฝ้าระวังขึ้นไป — เรียงตำบลที่ควรไปก่อนไว้บนสุด` : "ตอนนี้ไม่มีตำบลที่มีภัยน้ำท่วม • ดูแท็บ \"พยากรณ์ 7 วัน\" เพื่อเตรียมการล่วงหน้า"}
              {data.sea?.status ? <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold"><Waves className="h-3.5 w-3.5" aria-hidden="true" />น้ำทะเล {data.sea.status.label}</span> : null}
            </p>
          ) : null}

          {mode !== "accuracy" ? (<>
          <Toolbar right={(
            <>
              {patchMode ? (
                <label className="flex items-center gap-1.5 self-center text-xs font-bold text-slate-700">
                  <input type="checkbox" checked={showPatches} onChange={(e) => setShowPatches(e.target.checked)} />
                  <Layers className="h-3.5 w-3.5" aria-hidden="true" />แสดงแปลงที่คาดว่าน้ำท่วม
                </label>
              ) : null}
              <span className="self-center text-xs text-slate-500">วิเคราะห์เมื่อ {formatDateTime(data.generated_at)}</span>
            </>
          )}>
            <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={[{ value: "all", label: "ทุกอำเภอ" }, ...districts.map((name) => ({ value: name, label: `อ.${name}` }))]} />
          </Toolbar>

          <div className="grid grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="relative h-[55vh] min-h-[380px] overflow-hidden rounded-2xl border border-slate-200 bg-white xl:h-[660px]">
              <AreaRiskMap geometry={data.geometry} colorOf={colorOf} labelOf={labelOf} selectedKey={selected} onSelect={setSelected} version={`${mode}-${district}-${dayIndex}-${JSON.stringify(scenario)}-${data.generated_at}`} patches={patches} />
              <div className="absolute bottom-2 left-2 z-[500] rounded-lg bg-white/95 p-2 text-[11px] shadow ring-1 ring-slate-200">
                {(mode === "baseline" ? Object.values(BASELINE_LEVELS).reverse().map((item) => [BASE_COLORS[item.key], item.label]) : RISK_LEVELS.map((level) => [NOW_COLORS[level], RISK_META[level].label])).map(([color, label]) => (
                  <p key={label} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: color }} />{label}</p>
                ))}
                {patches ? <p className="mt-0.5 flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-[#2563eb]" />แปลงที่คาดว่าน้ำท่วม</p> : null}
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-3 xl:h-[660px]">
              <section className="min-h-0 flex-1 overflow-y-auto rounded-2xl border border-slate-200 bg-white" aria-label="รายละเอียดตำบล">{detail}</section>
              <section className="max-h-[280px] overflow-y-auto rounded-2xl border border-slate-200 bg-white" aria-label="อันดับตำบล">
                {modeCounts ? (
                  <p className="sticky top-0 flex flex-wrap gap-x-3 border-b border-slate-100 bg-white px-3 py-1.5 text-[11px] text-slate-600">
                    {[...RISK_LEVELS].reverse().map((level) => <span key={level}><span className="mr-1 inline-block h-2 w-2 rounded-sm" style={{ backgroundColor: NOW_COLORS[level] }} />{RISK_META[level].label} {modeCounts[level] || 0}</span>)}
                  </p>
                ) : null}
                <ol className="divide-y divide-slate-100">
                  {listed.map((area, index) => {
                    const level = levelOf(area.key);
                    return (
                      <li key={area.key}>
                        <button type="button" onClick={() => setSelected(area.key)} className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${selected === area.key ? "bg-[#eef5fb]" : ""}`}>
                          <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{index + 1}</span>
                          <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: mode === "baseline" ? BASE_COLORS[level] : NOW_COLORS[level] }} />
                          <span className="min-w-0 flex-1 truncate"><b>ต.{area.tambon}</b> <span className="text-slate-500">อ.{area.district}</span></span>
                          <span className="shrink-0 text-xs tabular-nums text-slate-500">{mode === "baseline" ? `${scoreOf(area.key)}/60` : scoreOf(area.key)}</span>
                        </button>
                      </li>
                    );
                  })}
                </ol>
              </section>
            </div>
          </div>

          <details className="rounded-2xl border border-slate-200 bg-white p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-slate-800"><Database className="h-4 w-4" aria-hidden="true" />แหล่งข้อมูลและวิธีคิด ({data.sources.filter((s) => s.status === "ok").length}/{data.sources.length} พร้อมใช้)</summary>
            <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
              {data.sources.map((source) => (
                <li key={source.name} className="flex items-start gap-2">
                  <StatusPill tone={source.status === "ok" ? "green" : "red"}>{source.status === "ok" ? "พร้อม" : "ไม่มีข้อมูล"}</StatusPill>
                  <span><b>{source.name}</b>{source.detail ? <span className="text-slate-500"> — {source.detail}</span> : null}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 space-y-1 text-xs leading-5 text-slate-500">
              <p><b>พยากรณ์/จำลอง:</b> ภัย = ฝน 24 ชม. (35/60/100/150 มม. → 4/8/12/16) + ฝนสะสม 3 วัน (≥120/200 มม. → 3/6) + น้ำในคลอง เฉพาะตำบลริมคลอง (สูงกว่าปกติ 5, ใกล้ตลิ่ง 8, สูงมาก 10, ล้นตลิ่ง 14) + น้ำทะเลหนุน เฉพาะตำบลติดทะเล (3/7/10) + ซ้ำซ้อนเมื่อหนุนพร้อมฝนหนัก/คลองสูง (5, ตรงช่วงน้ำขึ้น 7) → × ความเปราะบาง {calibrationText(forecast?.calibration)}</p>
              <p><b>จุดที่คาดว่าท่วม:</b> แปลงที่ดาวเทียม GISTDA เคยพบน้ำท่วม (2554–2567) — วิกฤต: ทุกแปลง, เสี่ยงสูง: ท่วม ≥ 2 ปี, เฝ้าระวัง: ท่วม ≥ 3 ปี และหมู่บ้านที่แปลงนั้นตั้งอยู่</p>
              <p><b>ตอนนี้:</b> ภัยตอนนี้ (0–40) × (1 + ความเปราะบางพื้นฐาน/60) → เฝ้าระวัง ≥ 12, เสี่ยงสูง ≥ 28, วิกฤต ≥ 45 • ความสูงพื้นที่จาก SRTM เป็นความสูงผิวบน (รวมต้นไม้)</p>
              <p>{forecast?.calibration?.source === "backtest" ? "เกณฑ์พยากรณ์ปรับเทียบกับเหตุการณ์น้ำท่วมจริงของสตูลแล้ว (ดูแท็บ \"ความแม่นยำ\")" : "เกณฑ์พยากรณ์ยังเป็นค่าเริ่มต้นจากเกณฑ์ฝนกรมอุตุฯ — ดูผลทดสอบย้อนหลังและเกณฑ์ที่แนะนำในแท็บ \"ความแม่นยำ\""}</p>
            </div>
          </details>
          </>) : null}
        </>
      ) : null}
    </AdminPage>
  );
}
