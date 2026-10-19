"use client";

// ตั้งค่าสิทธิ์กลุ่มภารกิจ: เมนูไหนของเหตุการณ์ กลุ่มภารกิจไหนบันทึกได้
// ทุกคนที่ได้รับมอบหมายในเหตุการณ์เปิดดูได้ทุกเมนูเสมอ — หน้านี้กำหนดเฉพาะ "ใครบันทึก/แก้ไขได้"
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Plus, RotateCcw, X } from "lucide-react";
import { Button, StatusPill, inputClass, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest } from "@/lib/adminApi";

const API = "/stn-eoc/api/admin/module-permissions";
const ALL = "*";

function sameOwners(a, b) {
  if (a === null || b === null) return a === b;
  return a.length === b.length && [...a].sort().join() === [...b].sort().join();
}

function ModuleRow({ eocType, mod, teams, onSaved, onError }) {
  const [draft, setDraft] = useState(mod.owners);
  const [adding, setAdding] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { setDraft(mod.owners); }, [mod.owners]);

  const teamName = (code) => teams.find((team) => team.code === code)?.shortName || code;
  const dirty = !sameOwners(draft, mod.owners);
  const allTeams = draft === null;
  const options = teams.filter((team) => !(draft || []).includes(team.code));

  const save = async () => {
    setBusy(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: { eoc_type: eocType, module_key: mod.key, teams: allTeams ? [ALL] : draft } });
      onSaved(json.message);
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const reset = async () => {
    setBusy(true);
    try {
      const json = await apiRequest(`${API}?eoc_type=${eocType}&module_key=${mod.key}`, { method: "DELETE" });
      onSaved(json.message);
    } catch (error) {
      onError(error.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="grid gap-3 px-4 py-3 lg:grid-cols-[13rem_minmax(0,1fr)_auto] lg:items-start">
      <div>
        <div className="font-bold text-slate-900">{mod.label}</div>
        <div className="mt-0.5">{mod.customized ? <StatusPill tone="blue">ปรับแล้ว</StatusPill> : <span className="text-xs text-slate-500">ค่าเริ่มต้น</span>}</div>
      </div>

      <div className="space-y-2">
        <label className="flex w-fit cursor-pointer items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" className="h-4 w-4 accent-[#0b4c86]" checked={allTeams} onChange={(event) => setDraft(event.target.checked ? null : (mod.defaults || []))} />
          ทุกทีมที่ได้รับมอบหมายในเหตุการณ์
        </label>
        {!allTeams ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {(draft || []).map((code) => (
              <span key={code} className="inline-flex items-center gap-1 rounded-full bg-[#edf5fc] py-1 pl-2.5 pr-1 text-sm font-semibold text-[#083865] ring-1 ring-[#c9dcee]">
                {teamName(code)}
                <button type="button" onClick={() => setDraft((draft || []).filter((item) => item !== code))} className="rounded-full p-0.5 hover:bg-white" aria-label={`เอา ${teamName(code)} ออก`}>
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </span>
            ))}
            <span className="inline-flex items-center gap-1">
              <label className="sr-only" htmlFor={`add-${eocType}-${mod.key}`}>เพิ่มกลุ่มภารกิจ</label>
              <select id={`add-${eocType}-${mod.key}`} className={`${inputClass} w-44 py-1.5`} value={adding} onChange={(event) => setAdding(event.target.value)}>
                <option value="">+ เพิ่มกลุ่มภารกิจ</option>
                {options.map((team) => <option key={team.code} value={team.code}>{team.shortName} — {team.name}</option>)}
              </select>
              {adding ? (
                <Button variant="secondary" className="min-h-9 px-2.5" onClick={() => { setDraft([...(draft || []), adding]); setAdding(""); }}>
                  <Plus className="h-4 w-4" aria-hidden="true" /> เพิ่ม
                </Button>
              ) : null}
            </span>
          </div>
        ) : null}
        {!allTeams && !(draft || []).length ? <p className="text-xs font-semibold text-red-700">ต้องมีอย่างน้อย 1 กลุ่มภารกิจ</p> : null}
      </div>

      <div className="flex gap-2 lg:justify-end">
        {mod.customized ? (
          <Button variant="ghost" className="min-h-9 px-2.5" disabled={busy} onClick={reset} title="คืนค่าเริ่มต้นของเมนูนี้">
            <RotateCcw className="h-4 w-4" aria-hidden="true" /> ค่าเริ่มต้น
          </Button>
        ) : null}
        <Button className="min-h-9" disabled={busy || !dirty || (!allTeams && !(draft || []).length)} onClick={save}>
          {busy ? "กำลังบันทึก…" : "บันทึก"}
        </Button>
      </div>
    </li>
  );
}

export default function ModulePermissions() {
  const [state, setState] = useState({ loading: true, error: "", data: null });
  const [eocType, setEocType] = useState("flood");
  const [confirmReset, setConfirmReset] = useState(false);
  const [resetting, setResetting] = useState(false);
  const { notice, success, fail } = useNotice();

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(API);
      setState({ loading: false, error: "", data: json });
    } catch (error) {
      setState({ loading: false, error: error.message, data: null });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = useMemo(() => state.data?.types.find((item) => item.eocType === eocType) || null, [state.data, eocType]);
  const onSaved = (message) => { success(message); load(); };

  const resetAll = async () => {
    setResetting(true);
    try {
      const json = await apiRequest(`${API}?eoc_type=${eocType}`, { method: "DELETE" });
      setConfirmReset(false);
      onSaved(json.message);
    } catch (error) {
      fail(error.message);
    } finally {
      setResetting(false);
    }
  };

  if (state.loading) return <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดสิทธิ์กลุ่มภารกิจ…</p>;
  if (state.error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error} <button type="button" onClick={load} className="ml-2 font-bold underline">ลองใหม่</button></p>;

  return (
    <section className="space-y-4">
      {notice}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>
          กำหนดว่ากลุ่มภารกิจไหน <strong>บันทึกและแก้ไข</strong> ข้อมูลในแต่ละเมนูของเหตุการณ์ได้ ทีมอื่นที่ได้รับมอบหมายในเหตุการณ์ยังเปิดดูได้ทุกเมนู (เมนูข้างแสดงไอคอนรูปตา)
        </p>
        <p className="mt-1 text-slate-500">แอดมินและผู้บัญชาการบันทึกได้ทุกเมนูเสมอ · เมื่อปิดเหตุการณ์แล้วทุกคนดูได้อย่างเดียว · มีผลทันทีกับทุกเหตุการณ์ประเภทนั้น</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-1 rounded-2xl border border-slate-200 bg-white p-1" role="tablist" aria-label="ประเภทเหตุการณ์">
          {state.data.types.map((item) => (
            <button
              key={item.eocType}
              type="button"
              role="tab"
              aria-selected={item.eocType === eocType}
              onClick={() => setEocType(item.eocType)}
              className={`rounded-lg px-3 py-1.5 text-sm font-bold ${item.eocType === eocType ? "bg-[#0b4c86] text-white" : "text-slate-600 hover:bg-[#edf5fc]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        {current?.modules.some((mod) => mod.customized) ? (
          <Button variant="secondary" onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" aria-hidden="true" /> คืนค่าเริ่มต้นทั้งหมด</Button>
        ) : null}
      </div>

      {current?.warnings.length ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950" role="status">
          <p className="flex items-center gap-2 font-bold"><AlertTriangle className="h-4 w-4" aria-hidden="true" /> เมนูที่ตอนนี้ไม่มีใครในทีมบันทึกได้</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-6">
            {current.warnings.map((warning) => <li key={`${warning.module}-${warning.message}`}>{warning.message}</li>)}
          </ul>
          <p className="mt-1.5 text-xs">เพิ่มสมาชิกเข้าทีมได้ที่เมนู “ทีมปฏิบัติการ” ของเหตุการณ์ หรือเพิ่มทีมที่มีคนอยู่แล้วเป็นผู้บันทึก</p>
        </div>
      ) : null}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {(current?.modules || []).map((mod) => (
          <ModuleRow key={mod.key} eocType={eocType} mod={mod} teams={state.data.teams} onSaved={onSaved} onError={fail} />
        ))}
      </ul>

      <AppDialog open={confirmReset} onOpenChange={setConfirmReset} title={`คืนค่าเริ่มต้นทุกเมนูของ${current?.label || ""}?`} description="สิทธิ์ที่ปรับไว้จะถูกแทนด้วยค่าเริ่มต้นของระบบ มีผลทันทีกับเหตุการณ์ที่เปิดอยู่" busy={resetting}>
        <AppDialogActions>
          <AppDialogCancel disabled={resetting} />
          <button type="button" onClick={resetAll} disabled={resetting} className="rounded-lg bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white hover:bg-[#083865] disabled:opacity-60">
            {resetting ? "กำลังคืนค่า…" : "คืนค่าเริ่มต้น"}
          </button>
        </AppDialogActions>
      </AppDialog>
    </section>
  );
}
