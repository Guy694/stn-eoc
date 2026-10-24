"use client";

// ยอดเข้าชมหน้า "ประกาศและความรู้": ประกาศของศูนย์ฯ สื่อความรู้จาก riskcom และอินโฟกราฟิก แยกรายชิ้น
import { useCallback, useEffect, useState } from "react";
import { ExternalLink, Images, Megaphone, Newspaper, RefreshCw } from "lucide-react";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { MetricCard } from "@/components/common/MetricCards";
import { CONTENT_KINDS, contentHref } from "@/lib/contentViews";

const API = "/stn-eoc/api/admin/content-views";
const RANGES = [[7, "7 วัน"], [30, "30 วัน"], [90, "90 วัน"], [365, "1 ปี"]];
const KIND_ICONS = { announcement: Megaphone, riskcom: Newspaper, infographic: Images };
const KIND_STYLE = { announcement: "bg-sky-50 text-[#0b4c86]", riskcom: "bg-emerald-50 text-emerald-800", infographic: "bg-amber-50 text-amber-800" };
const SHOW = 15;

export default function ContentViewsPanel() {
  const [days, setDays] = useState(30);
  const [kind, setKind] = useState("");
  const [all, setAll] = useState(false);
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const result = await apiRequest(`${API}?days=${days}`);
      setState({ loading: false, data: result.data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "โหลดยอดเข้าชมไม่สำเร็จ" });
    }
  }, [days]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const rangeLabel = RANGES.find(([value]) => value === days)?.[1];
  const items = (data?.items || []).filter((item) => !kind || item.kind === kind);
  const shown = all ? items : items.slice(0, SHOW);
  const max = Math.max(1, ...items.map((item) => item.views));

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="ช่วงเวลา">
          {RANGES.map(([value, label]) => (
            <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}
              className={`min-h-9 rounded-full px-3.5 text-sm font-semibold ring-1 ${days === value ? "bg-[#0b4c86] text-white ring-[#0b4c86]" : "bg-white text-slate-700 ring-slate-300 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
        <button type="button" onClick={load} disabled={state.loading} className="inline-flex items-center gap-1.5 rounded-lg border border-[#c9dcee] bg-white px-3 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc] disabled:opacity-60">
          <RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />รีเฟรช
        </button>
      </div>

      {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p> : null}
      {state.loading && !data ? <p className="py-10 text-center text-sm text-slate-500">กำลังโหลด…</p> : null}
      {data && !data.ready ? <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">ยังไม่ได้รัน migration 20261024_content_views — ตอนนี้แสดงได้เฉพาะยอดสะสมของประกาศของศูนย์ฯ</p> : null}

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            {Object.entries(CONTENT_KINDS).map(([key, label]) => (
              <MetricCard key={key} icon={KIND_ICONS[key]} tone={kind === key ? "blue" : "slate"} label={`${label} • ${rangeLabel}`}
                value={formatNumber(data.by_kind?.[key]?.views || 0)} unit="ครั้ง" note={`${formatNumber(data.by_kind?.[key]?.items || 0)} ชิ้นที่มีคนเปิด`}
                onClick={() => { setKind((current) => (current === key ? "" : key)); setAll(false); }} active={kind === key} />
            ))}
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3">
              <h4 className="font-black text-slate-900">ยอดเข้าชมแต่ละชิ้น{kind ? ` • ${CONTENT_KINDS[kind]}` : ""}</h4>
              {kind ? <button type="button" onClick={() => setKind("")} className="text-sm font-semibold text-[#0b4c86] hover:underline">ดูทุกประเภท</button> : null}
            </div>
            {shown.length ? (
              <ol className="divide-y divide-slate-100">
                {shown.map((item, index) => (
                  <li key={`${item.kind}:${item.id}`} className="flex gap-2 px-4 py-2.5 text-sm">
                    <span className="w-6 shrink-0 text-right tabular-nums text-slate-400">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className="break-words font-semibold text-slate-800">
                        <span className={`mr-1.5 inline-block rounded-full px-2 py-0.5 align-[1px] text-[11px] font-semibold ${KIND_STYLE[item.kind]}`}>{CONTENT_KINDS[item.kind]}</span>
                        {item.title}
                      </p>
                      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true"><div className="h-full bg-[#0b4c86]" style={{ width: `${(item.views / max) * 100}%` }} /></div>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs tabular-nums text-slate-600">
                        <span><b className="text-slate-900">{formatNumber(item.views)}</b> ครั้งใน {rangeLabel}</span>
                        {item.total_views !== null ? <span>• สะสมทั้งหมด {formatNumber(item.total_views)} ครั้ง</span> : null}
                        <a href={`/stn-eoc${contentHref(item.kind, item.id)}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold text-[#0b4c86] hover:underline">เปิดดู<ExternalLink className="h-3 w-3" aria-hidden="true" /><span className="sr-only">(แท็บใหม่)</span></a>
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            ) : <p className="p-4 text-sm text-slate-500">ยังไม่มีการเปิดดูในช่วงนี้</p>}
            {items.length > SHOW ? (
              <button type="button" onClick={() => setAll((value) => !value)} aria-expanded={all} className="w-full border-t border-slate-100 px-4 py-2.5 text-sm font-semibold text-[#0b4c86] hover:bg-slate-50">
                {all ? "แสดงน้อยลง" : `ดูทั้งหมด (อีก ${items.length - SHOW} ชิ้น)`}
              </button>
            ) : null}
          </section>

          <p className="rounded-xl border border-[#c9dcee] bg-[#edf5fc] p-4 text-sm text-[#083865]">
            นับเมื่อกดเข้าไปอ่านประกาศหรือสื่อความรู้ และเมื่อกดดูอินโฟกราฟิกขนาดเต็ม คนเดิม (IP เดิม) เปิดชิ้นเดิมซ้ำภายใน 1 ชั่วโมงนับครั้งเดียว ไม่เก็บข้อมูลผู้เข้าชม
            สื่อความรู้และอินโฟกราฟิกเริ่มนับตั้งแต่ติดตั้งรุ่นนี้ ส่วนประกาศของศูนย์ฯ มียอดสะสมเดิมแสดงไว้ด้วย
          </p>
        </>
      ) : null}
    </div>
  );
}
