"use client";

// เปิด/ปิดเมนูหลังบ้าน (แอดมิน) — เมนูที่ปิดจะหายจากเมนูข้างของทุกบทบาท
// เป็นการซ่อนเมนู ไม่ใช่ล็อกหน้า (ผู้ที่มีลิงก์และมีสิทธิ์ตามบทบาทยังเปิดหน้านั้นได้)
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button, StatusPill, useNotice } from "@/components/admin/crud";
import { apiRequest } from "@/lib/adminApi";

const API = "/stn-eoc/api/admin/menu-visibility";

export default function MenuVisibilitySettings() {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, error: "", catalog: [], saved: [] });
  const [hidden, setHidden] = useState(() => new Set());
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const json = await apiRequest(API);
      setState({ loading: false, error: "", catalog: json.catalog || [], saved: json.hidden || [] });
      setHidden(new Set(json.hidden || []));
    } catch (error) {
      setState({ loading: false, error: error.message, catalog: [], saved: [] });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const dirty = useMemo(() => {
    const saved = new Set(state.saved);
    return saved.size !== hidden.size || [...hidden].some((key) => !saved.has(key));
  }, [state.saved, hidden]);

  const toggle = (key, open) => setHidden((current) => {
    const next = new Set(current);
    if (open) next.delete(key); else next.add(key);
    return next;
  });
  const setGroup = (group, open) => setHidden((current) => {
    const next = new Set(current);
    for (const item of group.items) {
      if (item.protected) continue;
      if (open) next.delete(item.key); else next.add(item.key);
    }
    return next;
  });

  const save = async () => {
    setSaving(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: { hidden: [...hidden] } });
      success(json.message);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (state.loading) return <p className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดเมนู…</p>;
  if (state.error) return <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error} <button type="button" onClick={load} className="ml-2 font-bold underline">ลองใหม่</button></p>;

  return (
    <section className="space-y-4">
      {notice}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <p>เลือกเมนูหลังบ้านที่ต้องการเปิดหรือปิด เมนูที่ปิดจะหายจากเมนูข้างของทุกคน (แอดมิน ผู้บัญชาการ และเจ้าหน้าที่) ทันทีหลังบันทึก</p>
        <p className="mt-1 text-slate-500">เป็นการซ่อนเมนูเท่านั้น หน้านั้นยังเปิดได้ถ้ามีลิงก์และมีสิทธิ์ตามบทบาท · เมนู “ตั้งค่าระบบ” ปิดไม่ได้ เพื่อให้กลับมาเปิดเมนูอื่นได้เสมอ</p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <StatusPill tone={hidden.size ? "amber" : "green"}>{hidden.size ? `ปิดอยู่ ${hidden.size} เมนู` : "เปิดครบทุกเมนู"}</StatusPill>
        <div className="flex flex-wrap gap-2">
          <Button variant="ghost" disabled={saving || !dirty} onClick={() => setHidden(new Set(state.saved))}>ยกเลิกที่แก้</Button>
          <Button disabled={saving || !dirty} onClick={save}>{saving ? "กำลังบันทึก…" : "บันทึก"}</Button>
        </div>
      </div>

      {state.catalog.map((group) => {
        const switchable = group.items.filter((item) => !item.protected);
        const closed = switchable.filter((item) => hidden.has(item.key)).length;
        return (
          <div key={group.id} className="rounded-2xl border border-slate-200 bg-white">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 px-4 py-3">
              <h3 className="text-sm font-black text-slate-900">{group.title}{closed ? <span className="ml-2 text-xs font-bold text-amber-700">ปิด {closed}/{switchable.length}</span> : null}</h3>
              {switchable.length ? (
                <div className="flex gap-1.5">
                  <Button variant="secondary" onClick={() => setGroup(group, true)} disabled={saving || !closed}>เปิดทั้งหมวด</Button>
                  <Button variant="secondary" onClick={() => setGroup(group, false)} disabled={saving || closed === switchable.length}>ปิดทั้งหมวด</Button>
                </div>
              ) : null}
            </div>
            <ul className="divide-y divide-slate-100">
              {group.items.map((item) => {
                const open = item.protected || !hidden.has(item.key);
                return (
                  <li key={item.key} className="flex items-center gap-3 px-4 py-2.5">
                    <div className="min-w-0 flex-1">
                      <p className={`text-sm font-bold ${open ? "text-slate-900" : "text-slate-400 line-through"}`}>{item.name}</p>
                      {item.description ? <p className="truncate text-xs text-slate-500">{item.description}</p> : null}
                    </div>
                    {item.protected ? <span className="text-xs text-slate-500">ปิดไม่ได้</span> : null}
                    <button
                      type="button"
                      role="switch"
                      aria-checked={open}
                      aria-label={`${open ? "ปิด" : "เปิด"}เมนู ${item.name}`}
                      disabled={saving || item.protected}
                      onClick={() => toggle(item.key, !open)}
                      className={`relative h-6 w-11 shrink-0 rounded-full transition-colors disabled:opacity-50 ${open ? "bg-[#0b4c86]" : "bg-slate-300"}`}
                    >
                      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${open ? "left-[22px]" : "left-0.5"}`} />
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </section>
  );
}
