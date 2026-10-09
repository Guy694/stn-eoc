"use client";

// วิเคราะห์พื้นที่เสี่ยงน้ำท่วมรายตำบล: รวมภัยตอนนี้ + ประวัติน้ำท่วม + ภูมิประเทศ + คนและกลุ่มเปราะบาง
import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Database, RefreshCw, TriangleAlert, Waves } from "lucide-react";
import { AdminPage, Button, FilterSelect, StatusPill, Tabs, Toolbar } from "@/components/admin/crud";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { BASELINE_LEVELS } from "@/lib/areaRisk";
import { RISK_LEVELS, RISK_META } from "@/lib/weatherRiskConfig";

const AreaRiskMap = dynamic(() => import("@/components/eoc/area-risk/AreaRiskMap"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-slate-100" aria-label="กำลังโหลดแผนที่" />
});

const NOW_COLORS = { normal: "#cbd5e1", watch: RISK_META.watch.color, high: RISK_META.high.color, critical: RISK_META.critical.color };
const BASE_COLORS = { low: "#e7e5e4", medium: "#fdba74", high: "#c2410c" };

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

function AreaDetail({ area }) {
  if (!area) return <p className="p-4 text-sm text-slate-500">เลือกตำบลบนแผนที่หรือในรายการเพื่อดูเหตุผลและสิ่งที่ควรทำ</p>;
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

export default function AreaRiskWorkspace() {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [mode, setMode] = useState("now");
  const [district, setDistrict] = useState("all");
  const [selected, setSelected] = useState(null);

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState({ loading: false, data: await apiRequest("/stn-eoc/api/eoc/area-risk"), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const areas = useMemo(() => data?.areas || [], [data]);
  const byKey = useMemo(() => new Map(areas.map((area) => [area.key, area])), [areas]);
  const districts = useMemo(() => [...new Set(areas.map((area) => area.district))].sort((a, b) => a.localeCompare(b, "th")), [areas]);
  const listed = useMemo(() => {
    const list = areas.filter((area) => district === "all" || area.district === district);
    return mode === "now" ? list : [...list].sort((a, b) => b.baseline_index - a.baseline_index);
  }, [areas, district, mode]);
  const colorOf = useCallback((key) => {
    const area = byKey.get(key);
    if (!area) return "#e2e8f0";
    if (district !== "all" && area.district !== district) return "#f1f5f9";
    return mode === "now" ? NOW_COLORS[area.now_level] : BASE_COLORS[area.baseline_level];
  }, [byKey, mode, district]);
  const labelOf = useCallback((key) => {
    const area = byKey.get(key);
    return area ? `ต.${area.tambon} อ.${area.district} — ${mode === "now" ? RISK_META[area.now_level].label : BASELINE_LEVELS[area.baseline_level].label}` : key;
  }, [byKey, mode]);
  const counts = data?.counts || {};
  const atRisk = (counts.watch || 0) + (counts.high || 0) + (counts.critical || 0);

  return (
    <AdminPage
      title="วิเคราะห์พื้นที่เสี่ยงน้ำท่วม (รายตำบล)"
      description="รวมฝน ระดับน้ำในคลอง น้ำทะเลหนุน รายงานจากประชาชน สถิติน้ำท่วมจากดาวเทียมและของ EOC ความสูงพื้นที่ จำนวนครัวเรือน และกลุ่มเปราะบาง เป็นคะแนนที่อธิบายได้"
      actions={<Button variant="secondary" disabled={state.loading} onClick={load}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />วิเคราะห์ใหม่</Button>}
    >
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {state.loading && !data ? <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">กำลังรวบรวมข้อมูลจากทุกแหล่ง ครั้งแรกอาจใช้เวลาราว 10–20 วินาที (คำนวณภูมิประเทศรายตำบล)…</p> : null}

      {data ? (
        <>
          <div className="grid gap-2 sm:grid-cols-4">
            {[...RISK_LEVELS].reverse().map((level) => (
              <div key={level} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                <p className="flex items-center gap-1.5 text-xs font-bold text-slate-600"><span className="h-3 w-3 rounded-sm" style={{ backgroundColor: NOW_COLORS[level] }} />{RISK_META[level].label}</p>
                <p className="font-[family-name:var(--font-kanit)] text-2xl font-semibold tabular-nums">{counts[level] || 0} <span className="text-xs font-normal text-slate-500">ตำบล</span></p>
              </div>
            ))}
          </div>
          <p className={`flex items-start gap-2 rounded-xl px-4 py-3 text-sm ${atRisk ? "border border-orange-200 bg-orange-50 text-orange-900" : "border border-emerald-200 bg-emerald-50 text-emerald-900"}`}>
            {atRisk ? <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /> : <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />}
            {atRisk
              ? `ตอนนี้มี ${atRisk} ตำบลที่ต้องเฝ้าระวังขึ้นไป — เรียงตำบลที่ควรไปก่อนไว้บนสุด`
              : `ตอนนี้ไม่มีตำบลที่มีภัยน้ำท่วม (ฝน ระดับน้ำ และน้ำทะเลปกติ) • ดูแท็บ "ความเปราะบางพื้นฐาน" เพื่อวางแผนล่วงหน้า (${data.baseline_counts?.high || 0} ตำบลเปราะบางสูง, ${data.baseline_counts?.medium || 0} ปานกลาง)`}
            {data.sea?.status ? <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-xs font-bold"><Waves className="h-3.5 w-3.5" aria-hidden="true" />น้ำทะเล {data.sea.status.label}</span> : null}
          </p>

          <Tabs value={mode} onChange={setMode} items={[{ value: "now", label: "ความเสี่ยงตอนนี้", count: atRisk }, { value: "baseline", label: "ความเปราะบางพื้นฐาน" }]} />
          <Toolbar right={<span className="self-center text-xs text-slate-500">วิเคราะห์เมื่อ {formatDateTime(data.generated_at)}</span>}>
            <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={[{ value: "all", label: "ทุกอำเภอ" }, ...districts.map((name) => ({ value: name, label: `อ.${name}` }))]} />
          </Toolbar>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_420px]">
            <div className="relative h-[55vh] min-h-[380px] overflow-hidden rounded-xl border border-slate-200 bg-white xl:h-[640px]">
              <AreaRiskMap geometry={data.geometry} colorOf={colorOf} labelOf={labelOf} selectedKey={selected} onSelect={setSelected} version={`${mode}-${district}-${data.generated_at}`} />
              <div className="absolute bottom-2 left-2 z-[500] rounded-lg bg-white/95 p-2 text-[11px] shadow ring-1 ring-slate-200">
                {(mode === "now" ? RISK_LEVELS.map((level) => [NOW_COLORS[level], RISK_META[level].label]) : Object.values(BASELINE_LEVELS).reverse().map((item) => [BASE_COLORS[item.key], item.label])).map(([color, label]) => (
                  <p key={label} className="flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm ring-1 ring-black/10" style={{ backgroundColor: color }} />{label}</p>
                ))}
              </div>
            </div>
            <div className="flex min-h-0 flex-col gap-3 xl:h-[640px]">
              <section className="min-h-0 flex-1 overflow-y-auto rounded-xl border border-slate-200 bg-white" aria-label="รายละเอียดตำบล">
                <AreaDetail area={byKey.get(selected)} />
              </section>
              <section className="max-h-[280px] overflow-y-auto rounded-xl border border-slate-200 bg-white" aria-label="อันดับตำบล">
                <ol className="divide-y divide-slate-100">
                  {listed.map((area, index) => (
                    <li key={area.key}>
                      <button type="button" onClick={() => setSelected(area.key)} className={`flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-slate-50 ${selected === area.key ? "bg-[#eef5fb]" : ""}`}>
                        <span className="w-5 shrink-0 text-right text-xs tabular-nums text-slate-400">{index + 1}</span>
                        <span className="h-3 w-3 shrink-0 rounded-sm" style={{ backgroundColor: mode === "now" ? NOW_COLORS[area.now_level] : BASE_COLORS[area.baseline_level] }} />
                        <span className="min-w-0 flex-1 truncate"><b>ต.{area.tambon}</b> <span className="text-slate-500">อ.{area.district}</span></span>
                        <span className="shrink-0 text-xs tabular-nums text-slate-500">{mode === "now" ? area.now_score : `${area.baseline_index}/60`}</span>
                      </button>
                    </li>
                  ))}
                </ol>
              </section>
            </div>
          </div>

          <details className="rounded-xl border border-slate-200 bg-white p-4">
            <summary className="flex cursor-pointer items-center gap-2 text-sm font-black text-slate-800"><Database className="h-4 w-4" aria-hidden="true" />แหล่งข้อมูลที่ใช้ ({data.sources.filter((s) => s.status === "ok").length}/{data.sources.length} พร้อมใช้)</summary>
            <ul className="mt-3 grid gap-1.5 text-sm sm:grid-cols-2">
              {data.sources.map((source) => (
                <li key={source.name} className="flex items-start gap-2">
                  <StatusPill tone={source.status === "ok" ? "green" : "red"}>{source.status === "ok" ? "พร้อม" : "ไม่มีข้อมูล"}</StatusPill>
                  <span><b>{source.name}</b>{source.detail ? <span className="text-slate-500"> — {source.detail}</span> : null}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-5 text-slate-500">
              วิธีคิด: ความเสี่ยงตอนนี้ = ภัยตอนนี้ (0–40) × (1 + ความเปราะบางพื้นฐาน/60) → เฝ้าระวัง ≥ 12, เสี่ยงสูง ≥ 28, วิกฤต ≥ 45 •
              ความเปราะบางพื้นฐาน = ประวัติน้ำท่วม/ภูมิประเทศ (0–40) + คนและกลุ่มเปราะบาง (0–20) • ความสูงพื้นที่จาก SRTM เป็นความสูงผิวบน (รวมต้นไม้) ที่ลุ่มจริงอาจต่ำกว่าที่แสดง
            </p>
          </details>
        </>
      ) : null}
    </AdminPage>
  );
}
