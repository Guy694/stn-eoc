"use client";

// ประกาศธงเตือนภัย/Trigger การเคลื่อนย้ายกลุ่มเปราะบาง รายพื้นที่ (เกณฑ์ของทีม SAT)
// แต่ละพื้นที่: สิ่งที่ต้องทำ + หน่วยรับผิดชอบ + จำนวนรายชื่อเป้าหมาย (กดไปดูรายชื่อในทะเบียนกลุ่มเปราะบาง)
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronDown, Flag, ListChecks, Users } from "lucide-react";
import { AdminPage, Button, Field, FormDialog, ReadOnlyNotice, inputClass, latestTime, useNotice } from "@/components/admin/crud";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { CARE_GROUPS, effectiveCareGroup } from "@/lib/careGroups";
import PaginationControls, { usePagination } from "@/components/common/PaginationControls";
import {
  ASSESSMENT_FACTORS, COORDINATION_CHAIN, FLOOD_FLAGS, TRIGGER_STAGES, areaLabel, declarationFor, flagMeta, matchesStageTarget, stageMeta, stageTitle
} from "@/lib/floodTriggers";

const API = "/stn-eoc/api/eoc/area-triggers";
const PERSONS_API = "/stn-eoc/api/eoc/vulnerable-persons";
const AREA_API = "/stn-eoc/api/eoc/vulnerable-event";
const NEUTRAL = { color: "#475569", soft: "#f1f5f9", text: "#334155" };
const sortTh = (list) => [...new Set(list.filter(Boolean))].sort((a, b) => a.localeCompare(b, "th"));

function stageStyle(stage) {
  return flagMeta(stageMeta(stage)?.flag) || NEUTRAL;
}

function FlagGlyph({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <rect x="3" y="2" width="2.2" height="20" rx="1.1" fill="#1f2937" />
      <path d="M5.2 3.5c4-1.6 7 1.6 11 0 1.4-.5 2.6-.4 3.8.2v10c-1.2-.6-2.4-.7-3.8-.2-4 1.6-7-1.6-11 0z" fill={color} />
    </svg>
  );
}

function StageBadge({ stage }) {
  const meta = stageMeta(stage);
  const style = stageStyle(stage);
  if (!meta) return null;
  const flag = flagMeta(meta.flag);
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold" style={{ background: style.soft, color: style.text, boxShadow: `inset 0 0 0 1.5px ${style.color}` }}>
      {flag ? <FlagGlyph color={flag.color} size={14} /> : null}
      Trigger {meta.trigger} {meta.name}{flag ? ` · ${flag.label}` : ""}
    </span>
  );
}

function DeclarationCard({ item, targets, canDeclare, canTick, onAdjust, onCancel, onToggle }) {
  const meta = stageMeta(item.stage);
  const style = stageStyle(item.stage);
  const [busyIndex, setBusyIndex] = useState(null);
  const doneCount = meta.actions.filter((_, index) => item.actions?.[index]?.done).length;
  const percent = Math.round((doneCount / meta.actions.length) * 100);
  const toggle = async (index, done) => {
    setBusyIndex(index);
    try {
      await onToggle(item, index, done);
    } finally {
      setBusyIndex(null);
    }
  };
  const params = new URLSearchParams({ stage: item.stage });
  if (item.district) params.set("district", item.district);
  if (item.tambon) params.set("tambon", item.tambon);
  return (
    <article className="overflow-hidden border-slate-200 rounded-2xl border bg-white" style={{ borderColor: style.color }}>
      <header className="flex flex-wrap items-center gap-2 px-4 py-3" style={{ background: style.soft }}>
        <h3 className="text-lg font-black text-slate-900">{areaLabel(item)}</h3>
        <StageBadge stage={item.stage} />
        <span className="ml-auto text-xs text-slate-600">ประกาศ {formatDateTime(item.declared_at)}{item.declared_by_name ? ` · ${item.declared_by_name}` : ""}</span>
      </header>
      <div className="grid gap-4 p-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-slate-700"><span className="font-bold text-slate-900">เกณฑ์: </span>{meta.criteria}</p>
          {item.note ? <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-800"><span className="font-bold">หมายเหตุ: </span>{item.note}</p> : null}
          <div>
            <div className="mb-2 flex flex-wrap items-center gap-x-3 gap-y-1">
              <p className="flex items-center gap-1.5 text-sm font-bold text-[#083865]"><ListChecks className="h-4 w-4" aria-hidden="true" />สิ่งที่ต้องทำ</p>
              <span className="text-xs font-semibold text-slate-600">ทำแล้ว {doneCount}/{meta.actions.length}</span>
              <span className="h-1.5 w-28 overflow-hidden rounded-full bg-slate-200" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="ความคืบหน้า">
                <span className="block h-full rounded-full bg-[#0b4c86] transition-all" style={{ width: `${percent}%` }} />
              </span>
            </div>
            <ol className="space-y-1">
              {meta.actions.map((action, index) => {
                const state = item.actions?.[index];
                const done = Boolean(state?.done);
                return (
                  <li key={action.text}>
                    <label className={`flex gap-2.5 rounded-lg px-2 py-1.5 text-sm transition ${canTick ? "cursor-pointer hover:bg-slate-50" : ""} ${done ? "bg-slate-50" : ""}`}>
                      <input
                        type="checkbox"
                        className="mt-0.5 h-4 w-4 shrink-0 accent-[#0b4c86]"
                        checked={done}
                        disabled={!canTick || busyIndex === index}
                        onChange={(event) => toggle(index, event.target.checked)}
                      />
                      <span className="min-w-0">
                        <span className={done ? "text-slate-500 line-through decoration-slate-400" : "text-slate-900"}>{index + 1}. {action.text}</span>
                        <span className="block text-xs text-slate-500">
                          ผู้รับผิดชอบ: {action.who}
                          {done && state?.updated_by_name ? <> · ทำแล้วโดย {state.updated_by_name} {formatDateTime(state.updated_at)}</> : null}
                        </span>
                      </span>
                    </label>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <aside className="space-y-2 rounded-lg border border-slate-200 p-3">
          <p className="flex items-center gap-1.5 text-sm font-bold text-slate-900"><Users className="h-4 w-4" aria-hidden="true" />รายชื่อเป้าหมาย</p>
          <p className="text-xs text-slate-600">{meta.targetLabel}</p>
          <p className="text-3xl font-black tabular-nums" style={{ color: style.color === NEUTRAL.color ? "#0b4c86" : style.color }}>{targets === null ? "–" : formatNumber(targets.total)} <span className="text-base font-bold text-slate-600">คน</span></p>
          {targets?.total ? (
            <p className="flex flex-wrap gap-1.5 text-xs">
              {CARE_GROUPS.filter((group) => targets.byCare[group.key]).map((group) => (
                <span key={group.key} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-bold" style={{ background: group.soft, color: group.text }}>
                  <span className="h-2 w-2 rounded-full" style={{ background: group.color }} aria-hidden="true" />{group.label} {formatNumber(targets.byCare[group.key])}
                </span>
              ))}
            </p>
          ) : null}
          <Link href={`/eoc/flood/vulnerable-persons?${params.toString()}`} className="inline-flex min-h-9 w-full items-center justify-center rounded-lg bg-[#0b4c86] px-3 text-sm font-bold text-white hover:bg-[#083865]">ดูรายชื่อบนแผนที่</Link>
          {canDeclare ? (
            <div className="flex gap-1.5">
              <Button variant="secondary" className="min-h-9 flex-1 px-2 text-xs" onClick={() => onAdjust(item)}>ปรับระดับ</Button>
              <Button variant="ghost" className="min-h-9 px-2 text-xs text-red-700" onClick={() => onCancel(item)}>ยกเลิก</Button>
            </div>
          ) : null}
        </aside>
      </div>
    </article>
  );
}

function DeclareDialog({ open, initial, areas, sessionId, onClose, onSaved }) {
  const [form, setForm] = useState({ scope: "district", district: "", tambon: "", stage: "t1_green", note: "" });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    setError("");
    setForm(initial
      ? { scope: initial.tambon ? "tambon" : initial.district ? "district" : "province", district: initial.district || "", tambon: initial.tambon || "", stage: initial.stage || "t1_green", note: initial.note || "", cancel: Boolean(initial.cancel) }
      : { scope: "district", district: "", tambon: "", stage: "t1_green", note: "" });
  }, [open, initial]);
  const districts = useMemo(() => sortTh(areas.map((row) => row.district)), [areas]);
  const tambons = useMemo(() => sortTh(areas.filter((row) => row.district === form.district).map((row) => row.tambon)), [areas, form.district]);
  const set = (key) => (event) => setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async () => {
    if (form.scope !== "province" && !form.district) return setError("เลือกอำเภอ");
    if (form.scope === "tambon" && !form.tambon) return setError("เลือกตำบล");
    setBusy(true);
    setError("");
    try {
      const json = await apiRequest(API, {
        method: "POST",
        body: {
          session_id: sessionId,
          district: form.scope === "province" ? null : form.district,
          tambon: form.scope === "tambon" ? form.tambon : null,
          stage: form.cancel ? null : form.stage,
          note: form.note
        }
      });
      onSaved(json.message);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <FormDialog open={open} onOpenChange={(value) => !value && onClose()} title={form.cancel ? "ยกเลิกประกาศ" : "ประกาศธง/Trigger"} description="ใช้เกณฑ์ Trigger การเคลื่อนย้ายกลุ่มเปราะบางของทีม SAT · ประกาศระดับตำบลจะใช้แทนระดับอำเภอและจังหวัด" onSubmit={submit} busy={busy} error={error} submitText={form.cancel ? "ยกเลิกประกาศ" : "ประกาศ"} size="lg">
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-3">
          <Field label="พื้นที่">
            <select className={inputClass} value={form.scope} onChange={set("scope")} disabled={Boolean(initial)}>
              <option value="province">ทั้งจังหวัด</option>
              <option value="district">รายอำเภอ</option>
              <option value="tambon">รายตำบล</option>
            </select>
          </Field>
          {form.scope !== "province" ? (
            <Field label="อำเภอ">
              <select className={inputClass} value={form.district} onChange={(event) => setForm((current) => ({ ...current, district: event.target.value, tambon: "" }))} disabled={Boolean(initial)}>
                <option value="">เลือกอำเภอ</option>
                {districts.map((name) => <option key={name} value={name}>อ.{name}</option>)}
              </select>
            </Field>
          ) : null}
          {form.scope === "tambon" ? (
            <Field label="ตำบล">
              <select className={inputClass} value={form.tambon} onChange={set("tambon")} disabled={Boolean(initial) || !form.district}>
                <option value="">เลือกตำบล</option>
                {tambons.map((name) => <option key={name} value={name}>ต.{name}</option>)}
              </select>
            </Field>
          ) : null}
        </div>

        {!form.cancel ? (
          <fieldset>
            <legend className="mb-2 text-sm font-bold text-slate-900">ระดับ</legend>
            <div className="grid gap-2 sm:grid-cols-2">
              {TRIGGER_STAGES.map((stage) => {
                const style = stageStyle(stage.key);
                const checked = form.stage === stage.key;
                return (
                  <label key={stage.key} className="flex cursor-pointer gap-2.5 rounded-lg border p-2.5 text-sm transition" style={{ borderColor: checked ? style.color : "#e2e8f0", background: checked ? style.soft : "#fff", boxShadow: checked ? `0 0 0 1px ${style.color}` : "none" }}>
                    <input type="radio" name="stage" value={stage.key} checked={checked} onChange={set("stage")} className="mt-1" />
                    <span className="min-w-0">
                      <span className="flex items-center gap-1.5 font-bold text-slate-900">
                        {stage.flag && stage.trigger === 1 ? <FlagGlyph color={flagMeta(stage.flag).color} size={16} /> : null}
                        {stageTitle(stage)}
                      </span>
                      <span className="block text-xs text-slate-500">{stage.phase} · {stage.criteria}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ) : <p className="text-sm text-slate-700">พื้นที่นี้จะกลับไปใช้ประกาศของพื้นที่ที่ใหญ่กว่า (อำเภอ/จังหวัด) ถ้ามี</p>}
        <Field label="หมายเหตุ/เหตุผล" hint="เช่น ระดับน้ำ STN02 เพิ่มต่อเนื่อง 3 ชม., ถนน 404 น้ำเริ่มท่วม">
          <textarea className={inputClass} rows={2} value={form.note} onChange={set("note")} />
        </Field>
      </div>
    </FormDialog>
  );
}

function StageReference() {
  return (
    <details className="group rounded-2xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-bold text-slate-900">
        <ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />เกณฑ์ Trigger และความหมายของธง (ทีม SAT)
      </summary>
      <div className="space-y-4 border-t border-slate-100 p-4 text-sm">
        <div className="grid gap-2 sm:grid-cols-3">
          {FLOOD_FLAGS.map((flag) => (
            <div key={flag.key} className="rounded-lg p-3" style={{ background: flag.soft }}>
              <p className="flex items-center gap-1.5 font-bold" style={{ color: flag.text }}><FlagGlyph color={flag.color} size={18} />{flag.label} {flag.meaning}</p>
              <p className="mt-1 text-slate-700">{flag.criteria}</p>
            </div>
          ))}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-left">
            <thead><tr className="border-b border-slate-200 text-xs text-slate-500"><th className="py-1.5 pr-3">ระยะ / Trigger</th><th className="py-1.5 pr-3">เกณฑ์กระตุ้น</th><th className="py-1.5">กลุ่มเป้าหมาย</th></tr></thead>
            <tbody>
              {TRIGGER_STAGES.map((stage) => (
                <tr key={stage.key} className="border-b border-slate-100 align-top">
                  <td className="py-2 pr-3 font-semibold text-slate-900">{stage.phase}<br /><StageBadge stage={stage.key} /></td>
                  <td className="py-2 pr-3 text-slate-700">{stage.criteria}</td>
                  <td className="py-2 text-slate-700">{stage.targetLabel}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-slate-700"><span className="font-bold">เกณฑ์ประเมิน:</span> {ASSESSMENT_FACTORS.map((item, index) => `(${index + 1}) ${item}`).join(" ")}</p>
        <p className="text-slate-700"><span className="font-bold">การประสานงาน:</span> {COORDINATION_CHAIN.join(" → ")}</p>
      </div>
    </details>
  );
}

export default function AreaTriggersWorkspace() {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [persons, setPersons] = useState(null);
  const [areas, setAreas] = useState([]);
  const [dialog, setDialog] = useState({ open: false, initial: null });

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      const data = await apiRequest(`${API}?eoc=flood`);
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    apiRequest(`${PERSONS_API}?eoc=flood`).then((json) => setPersons(json.persons || [])).catch(() => setPersons([]));
    apiRequest(`${AREA_API}?eoc=flood`).then((json) => setAreas(json.baseline || [])).catch(() => setAreas([]));
  }, []);

  const data = state.data;
  const { anchor: historyAnchor, ...historyPage } = usePagination(data?.history, { pageSize: 20, resetKey: data?.session?.id || "" });
  const current = useMemo(() => data?.current || [], [data]);
  const session = data?.session;

  // นับรายชื่อเป้าหมายของแต่ละประกาศ: คนในพื้นที่ที่ประกาศนี้เป็นประกาศที่เจาะจงที่สุด และตรงกลุ่มเป้าหมายของ Trigger
  const targetsById = useMemo(() => {
    if (!persons) return null;
    const result = new Map(current.map((item) => [item.id, { total: 0, byCare: {} }]));
    for (const person of persons) {
      const declaration = declarationFor(current, person.district, person.tambon);
      if (!declaration || !matchesStageTarget(person, declaration.stage)) continue;
      const bucket = result.get(declaration.id);
      bucket.total += 1;
      const care = effectiveCareGroup(person);
      bucket.byCare[care] = (bucket.byCare[care] || 0) + 1;
    }
    return result;
  }, [persons, current]);

  const toggleAction = async (item, index, done) => {
    // อัปเดตบนจอทันที แล้วโหลดใหม่ให้ได้ชื่อผู้ติ๊ก/เวลา
    setState((current) => ({
      ...current,
      data: current.data && {
        ...current.data,
        current: current.data.current.map((row) => (row.id === item.id ? { ...row, actions: { ...row.actions, [index]: { ...(row.actions?.[index] || {}), done } } } : row))
      }
    }));
    try {
      await apiRequest(API, { method: "PATCH", body: { session_id: session?.id, trigger_id: item.id, action_index: index, done } });
    } catch (error) {
      fail(error.message);
    }
    await load();
  };

  const counts = useMemo(() => {
    const byFlag = { red: 0, yellow: 0, green: 0, none: 0 };
    for (const item of current) byFlag[stageMeta(item.stage)?.flag || "none"] += 1;
    return byFlag;
  }, [current]);

  const context = session ? `${getEocTypeLabel("flood")} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null;

  return (
    <AdminPage
      context={context}
      title="ธงเตือนภัยและ Trigger เคลื่อนย้าย"
      freshness={session ? { value: latestTime((data?.history || []).map((row) => row.declared_at)), staleHours: 12, label: "ประกาศ/ทบทวนล่าสุด", emptyText: "ยังไม่มีการประกาศ" } : null}
      description="ประกาศระดับรายพื้นที่ตามเกณฑ์ทีม SAT ระบบบอกสิ่งที่ต้องทำ ผู้รับผิดชอบ และรายชื่อกลุ่มเปราะบางที่เป็นเป้าหมาย"
      actions={data?.can_declare ? <Button onClick={() => setDialog({ open: true, initial: null })}><Flag className="h-4 w-4" aria-hidden="true" />ประกาศธง/Trigger</Button> : null}
    >
      {notice}
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {data && !data.ready ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ยังไม่ได้ติดตั้งตารางประกาศ ให้ผู้ดูแลระบบรัน npm run db:migrate</p> : null}
      {data && !session ? <p className="rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">ยังไม่มีเหตุการณ์อุทกภัย ประกาศได้เมื่อเปิด EOC</p> : null}
      {session && data?.ready && session.status === "active" ? (
        <ReadOnlyNotice message={[data.can_declare ? null : data.declare_message, data.can_tick ? null : data.tick_message].filter(Boolean).join(" · ") || null} />
      ) : null}

      {session ? (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="font-bold text-slate-700">ประกาศอยู่ {formatNumber(current.length)} พื้นที่</span>
          {FLOOD_FLAGS.slice().reverse().map((flag) => counts[flag.key] ? (
            <span key={flag.key} className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 font-bold" style={{ background: flag.soft, color: flag.text }}><FlagGlyph color={flag.color} size={14} />{flag.label} {counts[flag.key]}</span>
          ) : null)}
          {counts.none ? <span className="rounded-full bg-slate-100 px-2.5 py-0.5 font-bold text-slate-700">ไม่มีธง (Trigger 0/5/6) {counts.none}</span> : null}
        </div>
      ) : null}

      {session && !state.loading && !current.length ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-10 text-center">
          <Flag className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <p className="mt-2 font-bold text-slate-900">ยังไม่มีพื้นที่ที่ประกาศธง/Trigger</p>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-600">เมื่อ SAT ประเมินจากระดับน้ำ ฝน และเส้นทางแล้ว ให้ประกาศระดับรายอำเภอหรือตำบล ระบบจะดึงรายชื่อกลุ่มเปราะบางที่ต้องดำเนินการให้</p>
          {data?.can_declare ? <div className="mt-4"><Button onClick={() => setDialog({ open: true, initial: null })}><Flag className="h-4 w-4" aria-hidden="true" />ประกาศธง/Trigger</Button></div> : null}
        </div>
      ) : null}

      <div className="space-y-3">
        {current.map((item) => (
          <DeclarationCard
            key={item.id}
            item={item}
            targets={targetsById ? targetsById.get(item.id) : null}
            canDeclare={Boolean(data?.can_declare)}
            canTick={Boolean(data?.can_tick)}
            onToggle={toggleAction}
            onAdjust={(target) => setDialog({ open: true, initial: target })}
            onCancel={(target) => setDialog({ open: true, initial: { ...target, cancel: true } })}
          />
        ))}
      </div>

      <StageReference />

      {data?.history?.length ? (
        <details className="group rounded-2xl border border-slate-200 bg-white">
          <summary className="flex cursor-pointer items-center gap-2 px-4 py-3 font-bold text-slate-900"><ChevronDown className="h-4 w-4 transition group-open:rotate-180" aria-hidden="true" />ประวัติการประกาศ ({formatNumber(data.history.length)})</summary>
          <ul ref={historyAnchor} className="scroll-mt-4 divide-y divide-slate-100 border-t border-slate-100 text-sm">
            {historyPage.visible.map((row) => (
              <li key={row.id} className="flex flex-wrap items-center gap-2 px-4 py-2">
                <span className="w-36 shrink-0 text-xs text-slate-500">{formatDateTime(row.declared_at)}</span>
                <span className="font-semibold text-slate-900">{areaLabel(row)}</span>
                {row.stage ? <StageBadge stage={row.stage} /> : <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-600">ยกเลิกประกาศ</span>}
                {row.note ? <span className="text-slate-600">{row.note}</span> : null}
                {row.declared_by_name ? <span className="ml-auto text-xs text-slate-500">{row.declared_by_name}</span> : null}
              </li>
            ))}
          </ul>
          <PaginationControls {...historyPage.controls} pageSizeOptions={[20, 50, 100]} itemLabel="ครั้ง" className="rounded-b-2xl border-t border-slate-100 bg-slate-50" />
        </details>
      ) : null}

      <DeclareDialog
        open={dialog.open}
        initial={dialog.initial}
        areas={areas}
        sessionId={session?.id}
        onClose={() => setDialog({ open: false, initial: null })}
        onSaved={async (message) => { setDialog({ open: false, initial: null }); success(message); await load(); }}
      />
    </AdminPage>
  );
}
