"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertOctagon, AlertTriangle, ClipboardCheck, Hourglass, Plus, Truck } from "lucide-react";
import { Button, AdminPage, Field, FormDialog, FormGrid, ReadOnlyNotice, StatStrip, StatusPill, inputClass, latestTime, useNotice } from "@/components/admin/crud";
import { apiRequest } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { OXYGEN_CRITICAL_DAYS, OXYGEN_LEVELS, OXYGEN_LOW_DAYS, OXYGEN_SOURCES, formatDays, oxygenDays, oxygenLevel } from "@/lib/liquidOxygen";
import { cn } from "@/lib/utils";
import FacilitySelect from "@/components/common/FacilitySelect";

const thaiDate = (value) => (value ? new Date(`${value}T00:00:00`).toLocaleDateString("th-TH", { day: "numeric", month: "short" }) : "");

const LEVEL_STYLE = {
  critical: { card: "border-red-300 bg-red-50/60", number: "text-red-700" },
  low: { card: "border-amber-300 bg-amber-50/60", number: "text-amber-700" },
  ok: { card: "border-slate-200 bg-white", number: "text-emerald-700" },
  unknown: { card: "border-dashed border-slate-300 bg-white", number: "text-slate-400" }
};

const emptyForm = (facilityId = "", previous = null, today = "") => {
  const form = { health_facility_id: facilityId ? String(facilityId) : "", report_date: today, procurement_problem: false, problem_note: "" };
  for (const source of OXYGEN_SOURCES) {
    form[`${source.key}_qty`] = "";
    // ยกปริมาณที่ใช้ต่อวันจากรายงานครั้งก่อน (มักไม่เปลี่ยน) ให้กรอกแค่คงเหลือ
    form[`${source.key}_use_per_day`] = previous?.[`${source.key}_use_per_day`] != null ? String(Number(previous[`${source.key}_use_per_day`])) : "";
  }
  return form;
};

// แถบวันที่ใช้ได้ (สเกล 0–7 วัน) แยกส่วนตามแหล่ง พร้อมเส้นเกณฑ์ 1 วัน (วิกฤต) และ 3 วัน (ต้องจัดหา)
const GAUGE_MAX_DAYS = 7;
const SOURCE_FILL = { tank: "#0b4c86", big: "#3b82c4", small: "#93c5e8" };
function DaysGauge({ days }) {
  if (!days || days.total === null) return null;
  const pct = (value) => `${Math.min(100, (Math.max(0, value || 0) / GAUGE_MAX_DAYS) * 100)}%`;
  let used = 0;
  const segments = OXYGEN_SOURCES.map((source) => {
    const value = Math.max(0, Math.min(days[source.key] || 0, GAUGE_MAX_DAYS - used));
    const segment = { key: source.key, label: source.label, value, left: used };
    used += value;
    return segment;
  }).filter((segment) => segment.value > 0);
  return (
    <div className="mt-3" aria-hidden="true">
      <div className="relative h-3 overflow-hidden rounded-full bg-slate-100">
        {segments.map((segment) => (
          <span key={segment.key} className="absolute inset-y-0" style={{ left: pct(segment.left), width: pct(segment.value), background: SOURCE_FILL[segment.key] }} title={`${segment.label} ${formatDays(segment.value)} วัน`} />
        ))}
        <span className="absolute inset-y-0 w-0.5 bg-red-600" style={{ left: pct(OXYGEN_CRITICAL_DAYS) }} />
        <span className="absolute inset-y-0 w-0.5 bg-amber-500" style={{ left: pct(OXYGEN_LOW_DAYS) }} />
      </div>
      <div className="relative mt-0.5 h-3 text-[10px] text-slate-500">
        <span className="absolute -translate-x-1/2 text-red-700" style={{ left: pct(OXYGEN_CRITICAL_DAYS) }}>1</span>
        <span className="absolute -translate-x-1/2 text-amber-700" style={{ left: pct(OXYGEN_LOW_DAYS) }}>3 วัน</span>
        <span className="absolute right-0">{GAUGE_MAX_DAYS}+</span>
      </div>
    </div>
  );
}

function Sparkline({ points }) {
  if (points.length < 2) return null;
  const values = points.map((point) => point.total ?? 0);
  const max = Math.max(...values, OXYGEN_LOW_DAYS + 1);
  const width = 96;
  const height = 24;
  const step = width / (values.length - 1);
  const path = values.map((value, index) => `${index ? "L" : "M"}${(index * step).toFixed(1)},${(height - (value / max) * height).toFixed(1)}`).join(" ");
  const lowY = height - (OXYGEN_LOW_DAYS / max) * height;
  return (
    <svg width={width} height={height} className="overflow-visible" role="img" aria-label="แนวโน้มจำนวนวันที่ใช้ได้ 14 วันล่าสุด">
      <line x1="0" x2={width} y1={lowY} y2={lowY} stroke="#f59e0b" strokeDasharray="2 2" strokeWidth="1" />
      <path d={path} fill="none" stroke="#0b4c86" strokeWidth="1.5" />
    </svg>
  );
}

// ออกซิเจนเหลวของโรงพยาบาล: การ์ดต่อโรงพยาบาล บอก "ใช้ได้อีกกี่วัน" ตัวใหญ่ กดรายงานวันนี้ได้จากการ์ด
export default function OxygenWorkspace({ eocType = "flood" }) {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [dialog, setDialog] = useState(null);
  const [form, setForm] = useState(emptyForm());
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const url = `/stn-eoc/api/eoc/oxygen?eoc=${eocType}`;
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      setState({ loading: false, data: await apiRequest(url), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [url]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const perms = data?.permissions || {};
  const today = data?.today || "";

  // การ์ด = โรงพยาบาลทุกแห่ง (แม้ยังไม่รายงาน) + หน่วยอื่นที่เคยรายงาน
  const cards = useMemo(() => {
    if (!data?.facilities) return [];
    const latest = new Map((data.summary?.items || []).map((item) => [item.health_facility_id, item]));
    const history = new Map();
    for (const row of data.history || []) history.set(row.health_facility_id, [...(history.get(row.health_facility_id) || []), row]);
    const rank = { critical: 0, low: 1, unknown: 2, ok: 3 };
    return data.facilities
      .filter((facility) => facility.hospital || latest.has(facility.id))
      .map((facility) => {
        const report = latest.get(facility.id) || null;
        const level = report ? report.level : "unknown";
        return { facility, report, level, stale: report ? report.report_date !== today : true, history: history.get(facility.id) || [] };
      })
      .sort((a, b) => rank[a.level] - rank[b.level] || (a.report?.days.total ?? 1e9) - (b.report?.days.total ?? 1e9) || a.facility.name.localeCompare(b.facility.name, "th"));
  }, [data, today]);

  const reportedToday = cards.filter((card) => !card.stale).length;
  const preview = oxygenDays(Object.fromEntries(Object.entries(form).map(([key, value]) => [key, value === "" ? null : value])));
  const previewLevel = oxygenLevel({ days: preview });

  const openReport = (card = null) => {
    setFormError("");
    setForm(emptyForm(card?.facility.id || "", card?.report, today));
    setDialog({ card });
  };

  const submit = async () => {
    setBusy(true);
    setFormError("");
    try {
      const result = await apiRequest(url, { method: "POST", body: form });
      success(result.message || "บันทึกแล้ว");
      setDialog(null);
      await load();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.type === "checkbox" ? event.target.checked : event.target.value }));
  const session = data?.session;
  const context = session ? `${getEocTypeLabel(eocType)} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null;
  const summary = data?.summary;

  return (
    <AdminPage
      title="ออกซิเจนเหลว"
      context={context}
      freshness={session ? { value: latestTime((data?.summary?.items || []).map((row) => row.updated_at || (row.report_date ? `${row.report_date}T08:00:00+07:00` : null))), staleHours: 24, label: "รายงานล่าสุด" } : null}
      description={`คงเหลือของแต่ละโรงพยาบาลและใช้ได้อีกกี่วัน ระบบเตือนเมื่อเหลือน้อยกว่า ${OXYGEN_LOW_DAYS} วัน`}
      actions={perms.can_edit ? <Button onClick={() => openReport()}><Plus className="h-4 w-4" />รายงานหน่วยอื่น</Button> : null}
    >
      {notice}
      {state.error ? <p className="rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
      {data && !session ? <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">{data.message}</p> : null}
      {data && data.ready === false ? <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-900">ยังไม่ได้ติดตั้งตารางออกซิเจนเหลว ให้ผู้ดูแลระบบรัน <code>npm run db:migrate</code></p> : null}
      <ReadOnlyNotice message={perms.read_only_message} />

      {session ? (
        <StatStrip items={[
          { icon: AlertOctagon, label: "วิกฤต (<1 วัน)", value: summary?.critical ?? 0, className: summary?.critical ? "text-red-700" : undefined },
          { icon: Hourglass, label: `ต้องจัดหา (<${OXYGEN_LOW_DAYS} วัน)`, value: summary?.low ?? 0, className: summary?.low ? "text-amber-700" : undefined },
          { icon: Truck, label: "มีปัญหาการจัดหา", value: summary?.problems ?? 0, className: summary?.problems ? "text-amber-700" : undefined },
          { icon: ClipboardCheck, label: "รายงานแล้ววันนี้", value: `${reportedToday} / ${cards.length}`, tone: "blue", share: cards.length ? Math.round((reportedToday / cards.length) * 1000) / 10 : 0 }
        ]} />
      ) : null}

      {state.loading && !data ? <p className="text-sm text-slate-500">กำลังโหลด…</p> : null}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((card) => {
          const style = LEVEL_STYLE[card.level];
          const meta = OXYGEN_LEVELS[card.level];
          const report = card.report;
          return (
            <li key={card.facility.id} className={cn("flex flex-col rounded-xl border p-4", style.card)}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h2 className="truncate font-black text-slate-900">{card.facility.name}</h2>
                  <p className="text-xs text-slate-500">{card.facility.district_name ? `อ.${card.facility.district_name}` : ""}</p>
                </div>
                <StatusPill tone={meta.tone}>{meta.short}</StatusPill>
              </div>
              <div className="mt-3 flex items-end justify-between gap-3">
                <p className={cn("text-4xl font-black tabular-nums leading-none", style.number)}>
                  {report ? formatDays(report.days.total) : "–"}
                  <span className="ml-1 text-base font-bold text-slate-500">วัน</span>
                </p>
                <Sparkline points={card.history} />
              </div>
              {report ? <DaysGauge days={report.days} /> : null}
              {report ? (
                <dl className="mt-3 grid grid-cols-3 gap-2 text-xs">
                  {OXYGEN_SOURCES.map((source) => (
                    <div key={source.key}>
                      <dt className="flex items-center gap-1 text-slate-500"><span className="inline-block h-2 w-2 rounded-full" style={{ background: SOURCE_FILL[source.key] }} aria-hidden="true" />{source.label.replace("ถังออกซิเจนเหลว", "ถังหลัก").replace("ถังสำรองขนาด", "สำรอง")}</dt>
                      <dd className="font-bold text-slate-800">{report[`${source.key}_qty`] == null ? "-" : `${Number(report[`${source.key}_qty`]).toLocaleString("th-TH")} ${source.unit}`}</dd>
                    </div>
                  ))}
                </dl>
              ) : <p className="mt-3 text-sm text-slate-500">ยังไม่มีรายงานในเหตุการณ์นี้</p>}
              {Number(report?.procurement_problem) === 1 ? (
                <p className="mt-2 flex gap-1.5 rounded-lg bg-amber-100/70 px-2 py-1.5 text-xs text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" />{report.problem_note}</p>
              ) : null}
              <div className="mt-auto flex items-center justify-between gap-2 pt-3">
                <span className={cn("text-xs", card.stale ? "font-bold text-amber-700" : "text-slate-500")}>
                  {report ? (card.stale ? `รายงานล่าสุด ${thaiDate(report.report_date)}` : "รายงานแล้ววันนี้") : ""}
                </span>
                {perms.can_edit ? (
                  <Button variant={card.stale ? "primary" : "secondary"} className="min-h-9 px-3" onClick={() => openReport(card)}>
                    {card.stale ? "รายงานวันนี้" : "แก้ไข"}
                  </Button>
                ) : null}
              </div>
            </li>
          );
        })}
      </ul>

      <FormDialog
        open={Boolean(dialog)}
        onOpenChange={(open) => { if (!open) setDialog(null); }}
        title={dialog?.card ? `ออกซิเจนเหลว: ${dialog.card.facility.name}` : "รายงานออกซิเจนเหลว"}
        description="กรอกคงเหลือ ณ ตอนนี้ ปริมาณที่ใช้ต่อวันยกมาจากรายงานครั้งก่อน แก้ได้ถ้าเปลี่ยน"
        onSubmit={submit}
        busy={busy}
        error={formError}
        submitText="บันทึกรายงาน"
        size="md"
      >
        <FormGrid>
          {!dialog?.card ? (
            <div className="sm:col-span-2">
              <span className="mb-1 block text-sm font-bold text-slate-800">หน่วยบริการ <span className="text-red-600">*</span></span>
              <FacilitySelect facilities={data?.facilities || []} value={form.health_facility_id} onChange={(value) => setForm((current) => ({ ...current, health_facility_id: value }))} required selectClassName={inputClass} />
            </div>
          ) : null}
          <Field label="วันที่รายงาน" required wide>
            <input type="date" required max={today} className={inputClass} value={form.report_date} onChange={set("report_date")} />
          </Field>
          {OXYGEN_SOURCES.map((source) => (
            <fieldset key={source.key} className="sm:col-span-2 rounded-lg border border-slate-200 p-3">
              <legend className="px-1 text-sm font-bold text-slate-800">{source.label}</legend>
              <div className="grid grid-cols-[1fr_1fr_auto] items-end gap-2">
                <label className="text-xs text-slate-600">คงเหลือ ({source.unit})
                  <input type="number" min="0" step="any" inputMode="decimal" className={cn(inputClass, "mt-1")} value={form[`${source.key}_qty`]} onChange={set(`${source.key}_qty`)} />
                </label>
                <label className="text-xs text-slate-600">ใช้ต่อวัน ({source.unit})
                  <input type="number" min="0" step="any" inputMode="decimal" className={cn(inputClass, "mt-1")} value={form[`${source.key}_use_per_day`]} onChange={set(`${source.key}_use_per_day`)} />
                </label>
                <p className="min-w-[4.5rem] pb-2 text-right text-sm font-bold tabular-nums text-slate-700">{preview[source.key] === null ? "–" : `${formatDays(preview[source.key])} วัน`}</p>
              </div>
            </fieldset>
          ))}
          <div className={cn("sm:col-span-2 flex items-center justify-between rounded-lg px-3 py-2", LEVEL_STYLE[previewLevel].card)}>
            <span className="text-sm font-bold text-slate-700">รวมใช้ได้อีก</span>
            <span className={cn("text-2xl font-black tabular-nums", LEVEL_STYLE[previewLevel].number)}>{preview.total === null ? "–" : `${formatDays(preview.total)} วัน`}</span>
          </div>
          <label className="sm:col-span-2 flex items-center gap-2 text-sm font-semibold text-slate-800">
            <input type="checkbox" className="h-4 w-4" checked={form.procurement_problem} onChange={set("procurement_problem")} />
            มีปัญหาในการจัดหา/ขนส่ง
          </label>
          {form.procurement_problem ? (
            <Field label="ปัญหาที่พบ" required wide>
              <textarea rows={2} required className={inputClass} value={form.problem_note} placeholder="เช่น รถขนส่งเข้าพื้นที่ไม่ได้ ผู้จำหน่ายส่งของล่าช้า" onChange={set("problem_note")} />
            </Field>
          ) : null}
        </FormGrid>
      </FormDialog>
    </AdminPage>
  );
}
