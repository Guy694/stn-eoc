"use client";

// แผนที่ผู้เข้าชม: ใครเข้าชมจากที่ไหน — heatmap หรือจุดเล็ก (ใช้ตัวกรองเดียวกับรายการด้านล่าง)
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { cn } from "@/lib/utils";

const VisitorMapCanvas = dynamic(() => import("@/components/admin/visitors/VisitorMapCanvas"), {
  ssr: false,
  loading: () => <div className="grid h-full place-items-center text-sm text-slate-500">กำลังโหลดแผนที่…</div>
});

const API = "/stn-eoc/api/admin/visitor-log";

function Segmented({ value, onChange, options, label }) {
  return (
    <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-bold" role="tablist" aria-label={label}>
      {options.map(([key, text]) => (
        <button key={key} type="button" role="tab" aria-selected={value === key} onClick={() => onChange(key)} className={cn("rounded-md px-3 py-1", value === key ? "bg-white text-[#0b4c86] shadow-sm" : "text-slate-600 hover:text-slate-900")}>{text}</button>
      ))}
    </div>
  );
}

/** params: URLSearchParams ของตัวกรอง (ช่วงเวลา ส่วนของเว็บ ผู้ใช้ GPS คำค้น) */
export default function VisitorMap({ params, onPickIp, refreshKey = 0 }) {
  const [mode, setMode] = useState("heat");
  const [view, setView] = useState("fit");
  const [state, setState] = useState({ loading: true, error: "", points: [], unlocated: 0, truncated: false });
  const query = params.toString();

  useEffect(() => {
    let alive = true;
    setState((current) => ({ ...current, loading: true, error: "" }));
    apiRequest(`${API}?${query}&mode=points`)
      .then((json) => { if (alive) setState({ loading: false, error: "", points: json.points || [], unlocated: json.unlocated || 0, truncated: Boolean(json.truncated) }); })
      .catch((error) => { if (alive) setState((current) => ({ ...current, loading: false, error: error.message })); });
    return () => { alive = false; };
  }, [query, refreshKey]);

  const visits = state.points.reduce((sum, point) => sum + point.visits, 0);
  const gpsPoints = state.points.filter((point) => point.kind === "gps").length;

  return (
    <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-col gap-2 border-b border-slate-100 px-4 py-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h4 className="font-black text-slate-900">แผนที่ผู้เข้าชม</h4>
          <p className="text-xs text-slate-500">
            {state.loading ? "กำลังโหลด…" : `${formatNumber(state.points.length)} ตำแหน่ง · ${formatNumber(visits)} ครั้ง${gpsPoints ? ` · GPS ${formatNumber(gpsPoints)} ตำแหน่ง` : ""}${state.unlocated ? ` · ไม่ทราบตำแหน่ง ${formatNumber(state.unlocated)} ครั้ง` : ""}`}
            {state.truncated ? " · แสดงเฉพาะตำแหน่งที่เข้าชมมากที่สุด" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Segmented label="รูปแบบแผนที่" value={mode} onChange={setMode} options={[["heat", "ความหนาแน่น"], ["dots", "จุด"]]} />
          <Segmented label="มุมมอง" value={view} onChange={setView} options={[["fit", "พอดีทุกจุด"], ["satun", "สตูล"], ["thailand", "ทั้งประเทศ"]]} />
        </div>
      </div>
      {state.error ? <p role="alert" className="px-4 py-3 text-sm text-red-800">{state.error}</p> : null}
      <div className="h-[26rem] lg:h-[32rem]">
        <VisitorMapCanvas points={state.points} mode={mode} view={view} onPickIp={onPickIp} />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-slate-100 px-4 py-2 text-xs text-slate-600">
        {mode === "heat" ? (
          <span className="flex items-center gap-2">
            น้อย <span className="h-2 w-28 rounded-full" style={{ background: "linear-gradient(90deg,#2563eb,#06b6d4,#22c55e,#facc15,#dc2626)" }} aria-hidden="true" /> มาก
          </span>
        ) : (
          <>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0b4c86]" aria-hidden="true" />ส่วนใหญ่เปิดหน้าเจ้าหน้าที่</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-[#0e7490]" aria-hidden="true" />ประชาชน</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-300 ring-2 ring-[#15803d]" aria-hidden="true" />GPS ที่ผู้ใช้อนุญาต</span>
          </>
        )}
        <span className="ml-auto">แตะจุดเพื่อดูว่าใครเข้าชม · ตำแหน่งจาก IP เป็นระดับเมือง ไม่ใช่ที่อยู่จริง</span>
      </div>
    </section>
  );
}
