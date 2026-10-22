"use client";

// จัดกลุ่มและลำดับเมนูของเหตุการณ์ในเมนูข้าง (แอดมิน) — มีผลกับทุกคนที่เห็นเมนูเหตุการณ์นั้น
// ใครบันทึกเมนูไหนได้ ตั้งที่ "สิทธิ์กลุ่มภารกิจ" (หน้านี้แสดงให้ดูประกอบ)
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, RotateCcw } from "lucide-react";
import { Button, IconButton, StatusPill, inputClass, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest } from "@/lib/adminApi";
import { groupMenuItems } from "@/src/config/navigation/admin-navigation";

const API = "/stn-eoc/api/admin/menu-layout";

const snapshot = (items) => JSON.stringify(items.map((item) => [item.key, item.group.trim()]));

export default function MenuLayoutSettings() {
  const [state, setState] = useState({ loading: true, error: "", types: [] });
  const [eocType, setEocType] = useState("flood");
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const { success, fail } = useNotice();

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(API);
      setState({ loading: false, error: "", types: json.types || [] });
    } catch (error) {
      setState({ loading: false, error: error.message, types: [] });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const current = useMemo(() => state.types.find((item) => item.eocType === eocType) || null, [state.types, eocType]);
  useEffect(() => { setDraft(current ? current.items.map((item) => ({ ...item })) : []); }, [current]);

  const dirty = current ? snapshot(draft) !== snapshot(current.items) : false;
  const groupNames = useMemo(() => [...new Set(draft.map((item) => item.group.trim()).filter(Boolean))], [draft]);

  const move = (index, step) => {
    const target = index + step;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[index], next[target]] = [next[target], next[index]];
    setDraft(next);
  };
  const setGroup = (index, group) => setDraft((list) => list.map((item, position) => (position === index ? { ...item, group } : item)));

  const save = async () => {
    setSaving(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: { eoc_type: eocType, items: draft.map((item) => ({ key: item.key, group: item.group })) } });
      success(json.message);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setSaving(false);
    }
  };

  const reset = async () => {
    setSaving(true);
    try {
      const json = await apiRequest(`${API}?eoc_type=${eocType}`, { method: "DELETE" });
      success(json.message);
      setConfirmReset(false);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดเมนู…</p>;
  if (state.error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error} <button type="button" onClick={load} className="ml-2 font-bold underline">ลองใหม่</button></p>;

  // ตัวอย่างเมนูข้างตามที่จัดไว้ (กลุ่มเดียวกันอยู่ติดกัน)
  const preview = groupMenuItems(draft.map((item) => ({ ...item, group: item.group.trim() || undefined })));

  return (
    <section className="space-y-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>จัดกลุ่มและเรียงลำดับเมนูของเหตุการณ์ในเมนูข้าง พิมพ์ชื่อกลุ่มเดียวกันเพื่อรวมเมนูไว้ด้วยกัน เว้นว่าง = ไม่อยู่ในกลุ่ม</p>
        <p className="mt-1 text-slate-500">ทีมที่บันทึกแต่ละเมนูได้ แสดงใต้ชื่อเมนูในเมนูข้างโดยอัตโนมัติ (แก้ที่ “สิทธิ์กลุ่มภารกิจ”) · มีผลกับทุกคนภายใน 30 วินาที</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1" role="tablist" aria-label="ประเภทเหตุการณ์">
          {state.types.map((item) => (
            <button
              key={item.eocType}
              type="button"
              role="tab"
              aria-selected={item.eocType === eocType}
              onClick={() => setEocType(item.eocType)}
              className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-bold ${item.eocType === eocType ? "bg-[#0b4c86] text-white" : "text-slate-600 hover:bg-[#edf5fc]"}`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-2">
          {current?.customized ? (
            <Button variant="secondary" disabled={saving} onClick={() => setConfirmReset(true)}><RotateCcw className="h-4 w-4" aria-hidden="true" /> ค่าเริ่มต้น</Button>
          ) : null}
          <Button variant="ghost" disabled={saving || !dirty} onClick={() => setDraft(current.items.map((item) => ({ ...item })))}>ยกเลิกที่แก้</Button>
          <Button disabled={saving || !dirty} onClick={save}>{saving ? "กำลังบันทึก…" : "บันทึกการจัดกลุ่ม"}</Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_16rem]">
        <ol className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {draft.map((item, index) => (
            <li key={item.key} className="flex flex-col gap-2 px-3 py-2.5 sm:flex-row sm:items-center">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="flex shrink-0">
                  <IconButton icon={ArrowUp} label={`เลื่อน ${item.name} ขึ้น`} disabled={index === 0} onClick={() => move(index, -1)} />
                  <IconButton icon={ArrowDown} label={`เลื่อน ${item.name} ลง`} disabled={index === draft.length - 1} onClick={() => move(index, 1)} />
                </span>
                <span className="min-w-0">
                  <span className="block font-bold text-slate-900">{item.name}</span>
                  <span className="block text-xs text-slate-500">{item.ownerLabel ? `บันทึก: ${item.ownerLabel}` : "เมนูดูข้อมูล ทุกคนในเหตุการณ์เปิดได้"}</span>
                </span>
              </div>
              <label className="block sm:w-56">
                <span className="sr-only">กลุ่มของ {item.name}</span>
                <input
                  className={`${inputClass} py-1.5`}
                  list={`menu-groups-${eocType}`}
                  value={item.group}
                  maxLength={60}
                  placeholder="ไม่อยู่ในกลุ่ม"
                  onChange={(event) => setGroup(index, event.target.value)}
                />
              </label>
            </li>
          ))}
        </ol>
        <datalist id={`menu-groups-${eocType}`}>
          {groupNames.map((name) => <option key={name} value={name} />)}
        </datalist>

        <aside className="h-fit rounded-xl border border-emerald-200 bg-emerald-50/50 p-2 lg:sticky lg:top-4" aria-label="ตัวอย่างเมนูข้าง">
          <p className="flex items-center justify-between px-2 pb-1 text-xs font-bold text-slate-600">
            ตัวอย่างเมนูข้าง {dirty ? <StatusPill tone="amber">ยังไม่บันทึก</StatusPill> : null}
          </p>
          {preview.map((group) => (
            <div key={group.title || "main"}>
              {group.title ? <h4 className="px-2 pb-0.5 pt-2 text-[11px] font-bold text-slate-500">{group.title}</h4> : null}
              <ul>
                {group.items.map((item) => (
                  <li key={item.key} className="rounded-md px-2 py-1 text-sm text-slate-700">
                    {item.name}
                    {item.ownerLabel ? <span className="block text-[11px] text-emerald-700">บันทึก: {item.ownerLabel}</span> : null}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </aside>
      </div>

      <AppDialog open={confirmReset} onOpenChange={setConfirmReset} title={`คืนค่าเริ่มต้นเมนู${current?.label || ""}?`} description="กลุ่มและลำดับที่จัดไว้จะกลับเป็นแบบเริ่มต้นของระบบ" busy={saving}>
        <AppDialogActions>
          <AppDialogCancel disabled={saving} />
          <Button onClick={reset} disabled={saving}>{saving ? "กำลังคืนค่า…" : "คืนค่าเริ่มต้น"}</Button>
        </AppDialogActions>
      </AppDialog>
    </section>
  );
}
