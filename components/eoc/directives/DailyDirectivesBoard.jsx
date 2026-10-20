"use client";

// รายงานประจำวัน "สถานการณ์/ข้อสั่งการ" ของเหตุการณ์ (กรอกเป็นข้อๆ วันละ 1 หน้า ทุกทีมเขียนร่วมกัน)
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownToLine, CalendarDays, Eye, PencilLine, Printer, RefreshCw, Save } from "lucide-react";
import { Button, useNotice } from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { showConfirm } from "@/lib/sweetAlert";
import DirectiveListEditor, { newItem } from "@/components/eoc/directives/DirectiveListEditor";

const API = "/stn-eoc/api/eoc/daily-directives";

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Bangkok", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());
}

function thaiDate(key, options = { weekday: "long", day: "numeric", month: "long", year: "numeric" }) {
  if (!key) return "-";
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("th-TH", options);
}

const toEditorItems = (rows) => rows.map((row) => ({
  key: `db-${row.id}`, id: row.id, content: row.content, level: Number(row.item_level) || 0, status: row.item_status,
  author_name: row.author_name, team_code: row.team_code, completed_by_name: row.completed_by_name, carried_from_id: row.carried_from_id
}));

const snapshot = (items) => JSON.stringify(items.filter((item) => item.content.trim()).map((item) => [item.id, item.content.trim(), item.level, item.status]));

export default function DailyDirectivesBoard({ sessionId }) {
  const { notice, success, fail } = useNotice();
  const [date, setDate] = useState(todayKey);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [items, setItems] = useState([newItem()]);
  const [saved, setSaved] = useState(snapshot([]));
  const [version, setVersion] = useState(null);
  const [mode, setMode] = useState("edit");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!sessionId) return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const data = await apiRequest(`${API}?session_id=${sessionId}&date=${date}`);
      const loaded = toEditorItems(data.items || []);
      setItems(loaded.length ? loaded : [newItem()]);
      setSaved(snapshot(loaded));
      setVersion(data.version);
      setMode(data.permissions?.can_edit ? "edit" : "view");
      setState({ loading: false, data, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [sessionId, date]);
  useEffect(() => { load(); }, [load]);

  const dirty = snapshot(items) !== saved;
  const canEdit = Boolean(state.data?.permissions?.can_edit);

  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (event) => { event.preventDefault(); event.returnValue = ""; };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  const save = useCallback(async () => {
    setBusy(true);
    try {
      const result = await apiRequest(API, {
        method: "PUT",
        body: { session_id: sessionId, date, version, items: items.map(({ id, content, level, status }) => ({ id, content, level, status })) }
      });
      const loaded = toEditorItems(result.items || []);
      setItems(loaded.length ? loaded : [newItem()]);
      setSaved(snapshot(loaded));
      setVersion(result.version);
      success("บันทึกแล้ว");
      apiRequest(`${API}?session_id=${sessionId}&date=${date}`).then((data) => setState((current) => ({ ...current, data: { ...data } }))).catch(() => {});
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  }, [sessionId, date, version, items, success, fail]);

  // Ctrl/Cmd+S = บันทึก
  useEffect(() => {
    const onKey = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "s" && mode === "edit" && canEdit) {
        event.preventDefault();
        if (dirty && !busy) save();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, canEdit, dirty, busy, save]);

  const changeDate = async (next) => {
    if (dirty && !(await showConfirm("ยังไม่ได้บันทึก", "มีข้อความที่ยังไม่ได้บันทึก ต้องการเปลี่ยนวันโดยไม่บันทึกหรือไม่?", "เปลี่ยนวัน", "อยู่ต่อ"))) return;
    setDate(next || todayKey());
  };

  const carryOver = async () => {
    if (dirty) { fail("กรุณาบันทึกก่อนยกข้อค้างมา"); return; }
    setBusy(true);
    try {
      const result = await apiRequest(API, { method: "POST", body: { action: "carry_over", session_id: sessionId, date } });
      success(result.message);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  const counts = useMemo(() => {
    const filled = items.filter((item) => item.content.trim());
    return { total: filled.length, done: filled.filter((item) => item.status === "done").length };
  }, [items]);
  const lastUpdate = useMemo(() => {
    const rows = state.data?.items || [];
    return rows.reduce((latest, row) => (!latest || new Date(row.updated_at) > new Date(latest) ? row.updated_at : latest), null);
  }, [state.data]);
  const days = state.data?.days || [];
  const carry = state.data?.carry_over;

  return (
    <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
      {notice}
      <section className="rounded-2xl border border-slate-200 bg-white print:border-0 print:shadow-none">
        <header className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div>
            <p className="text-xs font-semibold text-[#0b4c86]">สถานการณ์/ข้อสั่งการ ประจำวัน</p>
            <h2 className="text-xl font-black text-slate-900">{thaiDate(date)}</h2>
            <p className="mt-0.5 text-xs text-slate-500">
              {counts.total} ข้อ · ดำเนินการแล้ว {counts.done} ข้อ{lastUpdate ? ` · แก้ไขล่าสุด ${formatDateTime(lastUpdate)}` : ""}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2 print:hidden">
            <label className="relative">
              <span className="sr-only">วันที่</span>
              <CalendarDays className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input type="date" value={date} max={todayKey()} onChange={(event) => changeDate(event.target.value)} className="h-10 rounded-lg border border-slate-300 pl-8 pr-2 text-sm" />
            </label>
            {canEdit ? (
              <div className="inline-flex rounded-lg border border-slate-300 p-0.5" role="group" aria-label="โหมด">
                <button type="button" onClick={() => setMode("edit")} aria-pressed={mode === "edit"} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-bold ${mode === "edit" ? "bg-[#0b4c86] text-white" : "text-slate-600"}`}><PencilLine className="h-4 w-4" />แก้ไข</button>
                <button type="button" onClick={() => setMode("view")} aria-pressed={mode === "view"} className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1.5 text-sm font-bold ${mode === "view" ? "bg-[#0b4c86] text-white" : "text-slate-600"}`}><Eye className="h-4 w-4" />ดู</button>
              </div>
            ) : null}
            <Button variant="ghost" onClick={() => window.print()} aria-label="พิมพ์"><Printer className="h-4 w-4" /></Button>
            <Button variant="ghost" onClick={load} disabled={busy || state.loading} aria-label="โหลดใหม่"><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} /></Button>
          </div>
        </header>

        {state.error ? <p className="m-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{state.error}</p> : null}
        {!canEdit && state.data ? <p className="mx-5 mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-600">เหตุการณ์ปิดแล้ว ดูได้อย่างเดียว</p> : null}

        {carry && canEdit && mode === "edit" ? (
          <div className="mx-5 mt-4 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900 print:hidden">
            <span>วันที่ {thaiDate(carry.report_date, { day: "numeric", month: "short" })} มีข้อที่ยังไม่ดำเนินการ {carry.open_items} ข้อ</span>
            <Button variant="secondary" className="min-h-9" disabled={busy} onClick={carryOver}><ArrowDownToLine className="h-4 w-4" />ยกมาวันนี้</Button>
          </div>
        ) : null}

        <div className="px-4 py-4 sm:px-5">
          {state.loading && !state.data ? <div className="h-32 animate-pulse rounded-lg bg-slate-100" /> : (
            <DirectiveListEditor items={items} onChange={setItems} readOnly={mode === "view" || !canEdit} />
          )}
        </div>

        {canEdit && mode === "edit" ? (
          <footer className="sticky bottom-0 flex flex-wrap items-center justify-between gap-2 rounded-b-xl border-t border-slate-100 bg-white/95 px-5 py-3 backdrop-blur print:hidden">
            <span className={`text-sm ${dirty ? "font-semibold text-amber-700" : "text-slate-500"}`}>{dirty ? "มีการแก้ไขที่ยังไม่ได้บันทึก" : "บันทึกล่าสุดแล้ว"}</span>
            <div className="flex gap-2">
              {dirty ? <Button variant="secondary" disabled={busy} onClick={load}>ยกเลิกการแก้ไข</Button> : null}
              <Button disabled={!dirty || busy} onClick={save}><Save className="h-4 w-4" />{busy ? "กำลังบันทึก..." : "บันทึก (Ctrl+S)"}</Button>
            </div>
          </footer>
        ) : null}
      </section>

      <aside className="rounded-2xl border border-slate-200 bg-white p-4 print:hidden">
        <h3 className="text-sm font-black text-slate-900">วันที่มีบันทึก</h3>
        {days.length ? (
          <ul className="mt-2 space-y-1">
            {days.map((day) => (
              <li key={day.report_date}>
                <button type="button" onClick={() => changeDate(day.report_date)} aria-current={day.report_date === date ? "date" : undefined}
                  className={`flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left text-sm ${day.report_date === date ? "bg-[#0b4c86] text-white" : "hover:bg-[#edf5fc]"}`}>
                  <span className="font-semibold">{thaiDate(day.report_date, { day: "numeric", month: "short", year: "2-digit" })}</span>
                  <span className={`text-xs ${day.report_date === date ? "text-blue-100" : "text-slate-500"}`}>{day.items} ข้อ{Number(day.open_items) ? ` · ค้าง ${day.open_items}` : ""}</span>
                </button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-2 text-sm text-slate-500">ยังไม่มีบันทึก เริ่มพิมพ์ข้อแรกได้เลย</p>}
      </aside>
    </div>
  );
}
