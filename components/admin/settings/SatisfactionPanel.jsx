"use client";

// ผลประเมินความพึงพอใจระบบ (ดาว 1–5 + ข้อเสนอแนะ) — เมนูผู้เข้าชม › ความพึงพอใจ
import { useCallback, useEffect, useState } from "react";
import { MessageSquareText, RefreshCw, Smile, Star, Users } from "lucide-react";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { MetricCard } from "@/components/common/MetricCards";
import { RATING_LABELS } from "@/lib/satisfaction";

const API = "/stn-eoc/api/admin/satisfaction";
const RANGES = [[7, "7 วัน"], [30, "30 วัน"], [90, "90 วัน"], [365, "1 ปี"]];
const DEVICE = { mobile: "มือถือ", tablet: "แท็บเล็ต", desktop: "คอมพิวเตอร์", other: "อื่น ๆ" };
const ROLE = { admin: "ผู้ดูแลระบบ", commander: "ผู้บัญชาการ", officer: "เจ้าหน้าที่", user: "เจ้าหน้าที่" };

function Stars({ value, size = "h-4 w-4" }) {
  return (
    <span className="inline-flex" aria-label={`${value} ดาว`}>
      {[1, 2, 3, 4, 5].map((n) => <Star key={n} className={`${size} ${n <= value ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} aria-hidden="true" />)}
    </span>
  );
}

function Distribution({ summary }) {
  return (
    <ul className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((rating) => (
        <li key={rating} className="flex items-center gap-2 text-sm">
          <span className="w-12 shrink-0 tabular-nums text-slate-700">{rating} ดาว</span>
          <span className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
            <span className="block h-full rounded-full bg-amber-400" style={{ width: `${summary.percent[rating]}%` }} />
          </span>
          <span className="w-20 shrink-0 text-right tabular-nums text-slate-600">{formatNumber(summary.counts[rating])} ({summary.percent[rating]}%)</span>
        </li>
      ))}
    </ul>
  );
}

export default function SatisfactionPanel() {
  const [days, setDays] = useState(30);
  const [filter, setFilter] = useState({ rating: "", comments: true });
  const [state, setState] = useState({ loading: true, data: null, error: "" });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const params = new URLSearchParams({ days: String(days) });
      if (filter.rating) params.set("rating", filter.rating);
      if (filter.comments) params.set("comments", "1");
      const json = await apiRequest(`${API}?${params}`);
      setState({ loading: false, data: json.data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message || "โหลดผลประเมินไม่สำเร็จ" });
    }
  }, [days, filter]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const s = data?.summary;
  const rangeLabel = RANGES.find(([value]) => value === days)?.[1];

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

      {data ? (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={Star} tone="amber" label={`คะแนนเฉลี่ย • ${rangeLabel}`} value={s.average === null ? "–" : s.average.toFixed(2)} unit="/ 5" note={s.average === null ? "ยังไม่มีผู้ประเมิน" : RATING_LABELS[Math.round(s.average)]} />
            <MetricCard icon={Users} tone="blue" label="จำนวนผู้ประเมิน" value={formatNumber(s.total)} unit="ครั้ง" note={`ประชาชน ${formatNumber(data.public.total)} • เจ้าหน้าที่ ${formatNumber(data.staff.total)}`} />
            <MetricCard icon={Smile} tone="green" label="พอใจ–พอใจมาก (4–5 ดาว)" value={s.satisfied === null ? "–" : `${s.satisfied}%`} />
            <MetricCard icon={MessageSquareText} label="มีข้อเสนอแนะ" value={formatNumber(data.comment_count)} unit="ข้อความ" />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-black text-slate-900">ทั้งหมด</h4>
              <Distribution summary={s} />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-black text-slate-900">ประชาชน <span className="text-sm font-semibold text-slate-500">เฉลี่ย {data.public.average?.toFixed(2) ?? "–"}</span></h4>
              <Distribution summary={data.public} />
            </section>
            <section className="rounded-2xl border border-slate-200 bg-white p-4">
              <h4 className="mb-3 font-black text-slate-900">เจ้าหน้าที่ <span className="text-sm font-semibold text-slate-500">เฉลี่ย {data.staff.average?.toFixed(2) ?? "–"}</span></h4>
              <Distribution summary={data.staff} />
            </section>
          </div>

          <section className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h4 className="font-black text-slate-900">ความเห็นล่าสุด</h4>
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <select value={filter.rating} onChange={(event) => setFilter((current) => ({ ...current, rating: event.target.value }))} aria-label="กรองตามดาว"
                  className="min-h-9 rounded-lg border border-slate-300 bg-white px-2">
                  <option value="">ทุกระดับดาว</option>
                  {[5, 4, 3, 2, 1].map((n) => <option key={n} value={n}>{n} ดาว</option>)}
                </select>
                <label className="inline-flex items-center gap-1.5 text-slate-700">
                  <input type="checkbox" checked={filter.comments} onChange={(event) => setFilter((current) => ({ ...current, comments: event.target.checked }))} className="h-4 w-4 accent-[#0b4c86]" />
                  เฉพาะที่มีข้อความ
                </label>
              </div>
            </div>
            {data.items.length ? (
              <ul className="divide-y divide-slate-100">
                {data.items.map((item) => (
                  <li key={item.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={item.rating} />
                      <span className="text-xs text-slate-500">{formatDateTime(item.created_at)} • {item.area === "staff" ? `เจ้าหน้าที่${item.role ? ` (${ROLE[item.role] || item.role})` : ""}` : "ประชาชน"} • {DEVICE[item.device] || "-"}{item.page_path ? ` • หน้า ${item.page_path}` : ""}</span>
                    </div>
                    {item.comment ? <p className="mt-1.5 whitespace-pre-line break-words text-[15px] leading-6 text-slate-800">{item.comment}</p> : <p className="mt-1 text-xs text-slate-400">ไม่ได้เขียนข้อเสนอแนะ</p>}
                  </li>
                ))}
              </ul>
            ) : <p className="p-4 text-sm text-slate-500">ยังไม่มีความเห็นตามตัวกรองนี้</p>}
          </section>
          <p className="text-xs text-slate-500">ประเมินได้จากปุ่ม &quot;ประเมินความพึงพอใจ&quot; ท้ายเว็บทุกหน้า • ไม่เก็บชื่อ เบอร์โทร หรือ IP ของผู้ประเมิน • ลบอัตโนมัติเมื่อเกิน 2 ปี</p>
        </>
      ) : null}
    </div>
  );
}
