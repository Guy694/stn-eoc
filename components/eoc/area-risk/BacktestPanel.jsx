"use client";

// ความแม่นยำของพยากรณ์จุดเสี่ยง: ทดสอบย้อนหลังกับเหตุการณ์น้ำท่วมจริง + ใช้เกณฑ์ที่ปรับเทียบ (ผู้ดูแลระบบ)
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, CircleX, History, RefreshCw, SlidersHorizontal } from "lucide-react";
import { Button, StatusPill } from "@/components/admin/crud";
import { useAuth } from "@/context/AuthContext";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { CANAL_STATES, SEA_STATES } from "@/lib/floodForecast";
import { RISK_META } from "@/lib/weatherRiskConfig";

const CANAL_LABEL = Object.fromEntries(CANAL_STATES.map((s) => [s.key, s.label]));
const SEA_LABEL = Object.fromEntries(SEA_STATES.map((s) => [s.key, s.label]));
const pct = (v) => (v == null ? "-" : `${Math.round(v * 100)}%`);
const thaiDate = (d) => new Date(`${d}T12:00:00+07:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short", year: "2-digit", timeZone: "Asia/Bangkok" });
const thresholdText = (t, floor) => `เฝ้าระวัง ≥ ${t.watch} • เสี่ยงสูง ≥ ${t.high} • วิกฤต ≥ ${t.critical}${floor != null ? ` • ตัวคูณขั้นต่ำ ${floor}` : ""}`;

function Scorecard({ title, metrics, thresholds, floor, tone }) {
  return (
    <div className={`rounded-xl border p-4 ${tone === "best" ? "border-emerald-300 bg-emerald-50/60" : "border-slate-200 bg-white"}`}>
      <p className="text-sm font-black text-slate-800">{title}</p>
      <p className="mt-0.5 text-[11px] text-slate-500">{thresholdText(thresholds, floor)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        <div>
          <dt className="text-[11px] text-slate-500">จับตำบลที่ท่วมจริงได้</dt>
          <dd className="text-2xl font-black tabular-nums text-slate-900">{pct(metrics.pod)}</dd>
          <dd className="text-[11px] text-slate-500">{metrics.hits}/{metrics.hits + metrics.misses} ตำบล</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">เตือนแล้วไม่ท่วม</dt>
          <dd className="text-2xl font-black tabular-nums text-slate-900">{metrics.false_alarms_per_year ?? "-"}</dd>
          <dd className="text-[11px] text-slate-500">ครั้ง/ปี (ทั้งจังหวัด)</dd>
        </div>
        <div>
          <dt className="text-[11px] text-slate-500">คะแนนรวม (CSI)</dt>
          <dd className="text-2xl font-black tabular-nums text-slate-900">{metrics.csi ?? "-"}</dd>
          <dd className="text-[11px] text-slate-500">1 = แม่นทั้งหมด</dd>
        </div>
      </dl>
    </div>
  );
}

function EventCard({ event }) {
  const scored = event.areas.length;
  const hits = event.areas.filter((a) => a.hit).length;
  return (
    <article className="rounded-xl border border-slate-200 bg-white">
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-slate-100 px-4 py-3">
        <h4 className="text-sm font-black text-slate-900">{event.label}</h4>
        <span className="text-xs text-slate-500">{thaiDate(event.start)} – {thaiDate(event.end)}</span>
        {event.province_level
          ? <StatusPill tone="gray">ไม่ระบุตำบล • ระบบเตือน {event.alarmed_tambons} ตำบล</StatusPill>
          : <StatusPill tone={hits / Math.max(1, scored) >= 0.5 ? "green" : "amber"}>เตือนถูก {hits}/{scored} ตำบล</StatusPill>}
        <span className="w-full text-[11px] text-slate-500">ที่มา: {event.sources.join(" • ")}</span>
      </header>
      {scored ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-xs">
            <thead className="bg-slate-50 text-[11px] text-slate-500">
              <tr><th className="px-3 py-1.5 font-bold">ตำบล</th><th className="px-2 py-1.5 font-bold">ผล</th><th className="px-2 py-1.5 font-bold">ระดับ (คะแนน)</th><th className="px-2 py-1.5 font-bold">ฝน 24 ชม./3 วัน</th><th className="px-2 py-1.5 font-bold">คลอง</th><th className="px-2 py-1.5 font-bold">ทะเล</th><th className="px-2 py-1.5 font-bold">เตือนครั้งแรก</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {[...event.areas].sort((a, b) => Number(a.hit) - Number(b.hit) || b.score - a.score).map((row) => (
                <tr key={row.key}>
                  <td className="px-3 py-1.5"><b>ต.{row.tambon}</b> <span className="text-slate-500">อ.{row.district}</span></td>
                  <td className="px-2 py-1.5">{row.hit ? <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />เตือนถูก</span> : <span className="inline-flex items-center gap-1 font-bold text-red-700"><CircleX className="h-3.5 w-3.5" aria-hidden="true" />พลาด</span>}</td>
                  <td className="px-2 py-1.5">{RISK_META[row.level]?.label} ({row.score})</td>
                  <td className="px-2 py-1.5 tabular-nums">{row.rain24}/{row.rain72} มม.</td>
                  <td className="px-2 py-1.5">{CANAL_LABEL[row.canal] || "-"}</td>
                  <td className="px-2 py-1.5">{SEA_LABEL[row.sea] || "-"}</td>
                  <td className="px-2 py-1.5">{row.first_alarm ? thaiDate(row.first_alarm) : "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </article>
  );
}

export default function BacktestPanel({ initialData = null }) {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const [state, setState] = useState({ loading: !initialData, data: initialData, error: "" });
  const [view, setView] = useState("best");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState("");

  const load = useCallback(async (fresh = false) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const json = await apiRequest(`/stn-eoc/api/eoc/area-risk/backtest${fresh ? "?fresh=1" : ""}`);
      setState({ loading: false, data: json.data, error: "" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);
  useEffect(() => { if (!initialData) load(); }, [load, initialData]);

  const apply = async (action) => {
    const best = state.data?.best;
    setSaving(true);
    setNotice("");
    try {
      await apiRequest("/stn-eoc/api/eoc/area-risk/backtest", {
        method: "POST",
        body: action === "apply" ? { action, thresholds: best.thresholds, factor_floor: best.factor_floor, metrics: best } : { action }
      });
      setNotice(action === "apply" ? "ใช้เกณฑ์ที่ปรับเทียบแล้ว — พยากรณ์ 7 วันและการจำลองจะใช้เกณฑ์นี้ทันทีเมื่อกด \"วิเคราะห์ใหม่\"" : "กลับไปใช้เกณฑ์ค่าเริ่มต้นแล้ว");
      await load();
    } catch (error) {
      setNotice(error.message);
    } finally {
      setSaving(false);
    }
  };

  const data = state.data;
  if (state.loading && !data) return <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600">กำลังทดสอบย้อนหลังกับเหตุการณ์น้ำท่วมจริง (ดึงฝน น้ำในคลอง และน้ำทะเลย้อนหลัง ~3 ปี) ครั้งแรกอาจใช้เวลาราว 30–60 วินาที…</p>;
  if (!data) return <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error || "ยังไม่มีผลทดสอบ"}</p>;

  const active = data.active || { source: "default" };
  const usingBest = active.source === "backtest" && active.thresholds?.watch === data.best.thresholds.watch && active.thresholds?.high === data.best.thresholds.high && active.factor_floor === data.best.factor_floor;
  const shown = view === "best" ? data.best : data.current;

  return (
    <div className="space-y-3">
      <section className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex flex-wrap items-start gap-3">
          <History className="mt-0.5 h-5 w-5 shrink-0 text-[#0b4c86]" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <h3 className="text-base font-black text-slate-900">ถ้าใช้ระบบนี้ย้อนหลัง จะเตือนน้ำท่วมจริงของสตูลได้แค่ไหน</h3>
            <p className="mt-1 text-sm text-slate-600">
              ป้อนฝน น้ำในคลอง และน้ำทะเลที่เกิดขึ้นจริง {thaiDate(data.period.start)} – {thaiDate(data.period.end)} ({data.period.days.toLocaleString("th-TH")} วัน) เข้ากฎพยากรณ์ แล้วเทียบกับ {data.events.length} เหตุการณ์น้ำท่วมจริง ({data.observed_tambon_events} ตำบล-เหตุการณ์)
            </p>
          </div>
          <Button variant="secondary" disabled={state.loading} onClick={() => load(true)}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin motion-reduce:animate-none" : ""}`} aria-hidden="true" />ทดสอบใหม่</Button>
        </div>

        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <Scorecard title={active.source === "backtest" ? "เกณฑ์ที่ใช้อยู่ (ปรับเทียบแล้ว)" : "เกณฑ์ที่ใช้อยู่ (ค่าเริ่มต้น)"} metrics={data.current} thresholds={active.thresholds || data.current.thresholds} floor={active.factor_floor} />
          <Scorecard title="เกณฑ์ที่แนะนำจากการปรับเทียบ" metrics={data.best} thresholds={data.best.thresholds} floor={data.best.factor_floor} tone="best" />
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          {isAdmin ? (
            <>
              <Button disabled={saving || usingBest} onClick={() => apply("apply")}><SlidersHorizontal className="h-4 w-4" aria-hidden="true" />{usingBest ? "ใช้เกณฑ์นี้อยู่แล้ว" : "ใช้เกณฑ์ที่แนะนำ"}</Button>
              {active.source === "backtest" ? <Button variant="secondary" disabled={saving} onClick={() => apply("reset")}>กลับไปใช้ค่าเริ่มต้น</Button> : null}
            </>
          ) : <p className="text-xs text-slate-500">ผู้ดูแลระบบเป็นผู้เลือกใช้เกณฑ์ที่ปรับเทียบ</p>}
          {active.source === "backtest" && active.calibrated_at ? <span className="text-xs text-slate-500">ปรับเทียบเมื่อ {formatDateTime(active.calibrated_at)}{active.by ? ` โดย ${active.by}` : ""}</span> : null}
        </div>
        {notice ? <p className="mt-2 rounded-lg bg-sky-50 px-3 py-2 text-sm text-sky-900" role="status">{notice}</p> : null}
        {data.confidence === "low" ? <p className="mt-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-900">ยังมีเหตุการณ์จริงให้เทียบน้อย ผลปรับเทียบจึงเป็นค่าเบื้องต้น — ยิ่งบันทึกน้ำท่วมใน EOC ครบทุกตำบล (พร้อมวันที่เริ่มท่วม) ผลยิ่งน่าเชื่อถือ</p> : null}
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-black text-slate-800">รายละเอียดรายเหตุการณ์</span>
        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 text-xs font-bold" role="group" aria-label="เลือกชุดเกณฑ์ที่จะแสดง">
          {[["best", "เกณฑ์ที่แนะนำ"], ["current", "เกณฑ์ที่ใช้อยู่"]].map(([value, label]) => (
            <button key={value} type="button" aria-pressed={view === value} onClick={() => setView(value)} className={`rounded-md px-3 py-1 ${view === value ? "bg-[#0b4c86] text-white" : "text-slate-600 hover:bg-slate-50"}`}>{label}</button>
          ))}
        </div>
      </div>
      {[...shown.per_event].reverse().map((event) => <EventCard key={event.id} event={event} />)}

      <section className="rounded-xl border border-slate-200 bg-white">
        <h4 className="border-b border-slate-100 px-4 py-3 text-sm font-black text-slate-900">เตือนแล้วไม่มีบันทึกน้ำท่วม (สูงสุด 15 ครั้ง)</h4>
        {shown.false_alarm_list.length ? (
          <ul className="divide-y divide-slate-100 text-xs">
            {shown.false_alarm_list.map((row) => (
              <li key={`${row.key}-${row.start}`} className="flex flex-wrap gap-x-3 px-4 py-1.5">
                <span className="min-w-[180px]"><b>ต.{row.tambon}</b> <span className="text-slate-500">อ.{row.district}</span></span>
                <span>{thaiDate(row.start)}{row.end !== row.start ? ` – ${thaiDate(row.end)}` : ""}</span>
                <span>{RISK_META[row.level]?.label} ({row.score})</span>
                <span className="text-slate-500">ฝน {row.rain24} มม.</span>
              </li>
            ))}
          </ul>
        ) : <p className="px-4 py-3 text-sm text-slate-500">ไม่มี</p>}
        <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-500">ถ้าวันไหนในรายการนี้มีน้ำท่วมจริงแต่ไม่ได้บันทึก ให้เพิ่มบันทึกน้ำท่วมใน EOC — ระบบจะนับเป็น &quot;เตือนถูก&quot; ในการทดสอบครั้งต่อไป</p>
      </section>

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
        <summary className="cursor-pointer font-black text-slate-800">แหล่งข้อมูลและข้อควรรู้</summary>
        <ul className="mt-2 space-y-1">
          {data.sources.map((s) => (
            <li key={s.name} className="flex items-start gap-2"><StatusPill tone={s.status === "ok" ? "green" : "red"}>{s.status === "ok" ? "พร้อม" : "ไม่มีข้อมูล"}</StatusPill><span><b>{s.name}</b>{s.detail ? <span className="text-slate-500"> — {s.detail}</span> : null}</span></li>
          ))}
        </ul>
        <ul className="mt-3 list-disc space-y-1 pl-5 text-xs text-slate-600">
          {data.notes.map((note) => <li key={note}>{note}</li>)}
          <li>ปรับเทียบเพียง 2 ค่า (ระดับเกณฑ์ทั้งชุด และตัวคูณขั้นต่ำของตำบลที่ไม่เคยมีประวัติ) เพื่อไม่ให้ระบบ &quot;จำคำตอบ&quot; จากเหตุการณ์จำนวนน้อย</li>
        </ul>
      </details>
    </div>
  );
}
