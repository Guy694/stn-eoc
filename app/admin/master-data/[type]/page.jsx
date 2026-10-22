"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Archive, ArrowUpRight, Pencil, Plus, RefreshCw, Search } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useAuth } from "@/context/AuthContext";
import { AdminPage, Button, Field, StatusPill, inputClass, useNotice } from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import ReasonDialog from "@/components/ui/reason-dialog";
import PaginationControls from "@/components/common/PaginationControls";

const TYPES = [
  ["agencies", "หน่วยงาน"],
  ["diseases", "ประเภทโรค"],
  ["hazards", "ประเภทภัย"],
  ["risks", "ข้อมูลความเสี่ยง"],
  ["routes", "เส้นทางหลัก"],
];
// หน้าจัดการข้อมูลอ้างอิงอื่นที่อยู่คนละหน้า
const RELATED = [
  ["/admin/data-management", "ประชากรและคุณภาพข้อมูล"],
  ["/admin/health-facilities", "สถานพยาบาล"],
  ["/admin/village-polygons", "หมู่บ้านและพื้นที่"],
];
const BOOLEAN_FIELDS = new Set(["is_active", "is_hotline"]);
const LONG_FIELDS = new Set(["description", "role_description", "route_hint"]);
const FIELD_LABELS = {
  slug: "รหัสย่อ", name: "ชื่อ", role_description: "บทบาท", area: "พื้นที่", phone: "โทรศัพท์",
  secondary_contact: "ผู้ติดต่อสำรอง", category: "หมวดหมู่", status: "สถานะ",
  source_name: "แหล่งข้อมูล", source_updated_at: "วันที่ข้อมูลต้นทาง", is_hotline: "เป็นสายด่วน",
  is_active: "ใช้งานอยู่", description: "รายละเอียด", type_code: "รหัสประเภท",
  name_th: "ชื่อภาษาไทย", name_en: "ชื่อภาษาอังกฤษ", district_name: "อำเภอ",
  hazard_type: "ประเภทภัย", susceptibility_score: "คะแนนความเสี่ยง", model_version: "รุ่นแบบจำลอง",
  corridor_key: "รหัสเส้นทาง", corridor_name: "ชื่อเส้นทาง", district_names: "อำเภอที่ผ่าน",
  route_hint: "คำแนะนำเส้นทาง",
};
const FIELD_HINTS = {
  slug: "ภาษาอังกฤษตัวเล็ก ไม่เว้นวรรค ใช้อ้างอิงในระบบ เช่น satun-pho",
  type_code: "ภาษาอังกฤษ ไม่เว้นวรรค เช่น flood",
  corridor_key: "ภาษาอังกฤษ ไม่เว้นวรรค เช่น satun-langu",
  source_name: "หน่วยงานหรือเอกสารที่เป็นที่มาของข้อมูล",
  susceptibility_score: "ตัวเลข ยิ่งมากยิ่งเสี่ยง",
  district_names: "พิมพ์ชื่ออำเภอ คั่นด้วยจุลภาค เช่น เมืองสตูล, ควนโดน",
  category: "เช่น สาธารณสุข, กู้ภัย, ปกครอง",
};
// คอลัมน์ที่แสดงในตาราง (ที่เหลือดูได้ในหน้าต่างแก้ไข)
const COLUMNS = {
  agencies: ["name", "role_description", "area", "phone"],
  diseases: ["name", "description"],
  hazards: ["type_code", "name_th", "name_en"],
  risks: ["district_name", "hazard_type", "susceptibility_score", "model_version"],
  routes: ["corridor_name", "district_names", "route_hint"],
};

const display = (value) => {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  if (value === null || value === undefined || value === "") return "–";
  return String(value);
};
const parseList = (value) => {
  if (Array.isArray(value)) return value;
  try { const parsed = JSON.parse(value); if (Array.isArray(parsed)) return parsed; } catch { /* ข้อความธรรมดา */ }
  return String(value || "").split(/[,،\n]/).map((item) => item.trim()).filter(Boolean);
};

export default function MasterDataCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { success, fail } = useNotice();
  const type = params.type;
  const [state, setState] = useState({ loading: true, rows: [], fields: [], required: [], label: "", total: 0, error: "" });
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(null);
  const [paging, setPaging] = useState({ page: 1, size: 20 });
  useEffect(() => { setPaging((value) => (value.page === 1 ? value : { ...value, page: 1 })); }, [appliedSearch, type]);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) router.replace("/dashboard");
  }, [authLoading, router, user]);

  const isAdmin = user?.role === "admin";
  const load = useCallback(async () => {
    if (!isAdmin) return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const query = new URLSearchParams({ page: String(paging.page), limit: String(paging.size) });
      if (appliedSearch) query.set("search", appliedSearch);
      const response = await fetch(`/stn-eoc/api/admin/master-data/catalog/${type}?${query}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดข้อมูลหลักได้");
      setState({ loading: false, rows: result.data || [], fields: result.fields || [], required: result.required || [], label: result.label, total: Number(result.pagination?.total || 0), error: "" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, [appliedSearch, isAdmin, paging, type]);
  useEffect(() => { load(); }, [load]);

  const columns = (COLUMNS[type] || state.fields.slice(0, 4)).filter((field) => state.fields.includes(field));
  const close = () => { setShowForm(false); setEditingId(null); };
  const openCreate = () => { setForm({ is_active: true, is_hotline: false }); setEditingId(null); setShowForm(true); };
  const edit = (row) => {
    setForm(Object.fromEntries(state.fields.map((field) => {
      let value = row[field] ?? "";
      if (field === "district_names") value = parseList(value).join(", ");
      if (BOOLEAN_FIELDS.has(field)) value = Boolean(value);
      if (field === "source_updated_at" && value) value = String(value).slice(0, 10);
      return [field, value];
    })));
    setEditingId(row.id);
    setShowForm(true);
  };
  const save = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = { ...form };
      if ("district_names" in body) body.district_names = parseList(body.district_names);
      const url = editingId ? `/stn-eoc/api/admin/master-data/catalog/${type}/${editingId}` : `/stn-eoc/api/admin/master-data/catalog/${type}`;
      const response = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "บันทึกไม่สำเร็จ");
      success(editingId ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อมูลแล้ว");
      close();
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setSaving(false);
    }
  };
  const archive = async (reason) => {
    setSaving(true);
    try {
      const response = await fetch(`/stn-eoc/api/admin/master-data/catalog/${type}/${archiving.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "เก็บเข้าคลังไม่สำเร็จ");
      success("เก็บเข้าคลังแล้ว รายการนี้จะไม่ถูกใช้ในระบบ");
      setArchiving(null);
      await load();
    } catch (error) {
      fail(error.message);
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;
  if (user.role !== "admin") return null;
  const rowName = (row) => display(row.name || row.name_th || row.corridor_name || (row.district_name && `${row.district_name} ${row.hazard_type || ""}`) || row.id);

  return (
    <EOCLayout>
      <AdminPage
        title={state.label || "ข้อมูลหลัก"}
        description="ข้อมูลอ้างอิงที่ทั้งระบบใช้ร่วมกัน ทุกรายการต้องระบุแหล่งที่มา และระบบบันทึกประวัติการแก้ไขไว้"
        actions={<>
          <Button variant="secondary" onClick={load} disabled={state.loading}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" />รีเฟรช</Button>
          <Button onClick={openCreate}><Plus className="h-4 w-4" aria-hidden="true" />เพิ่มข้อมูล</Button>
        </>}
      >
        <nav aria-label="ประเภทข้อมูลหลัก" className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-2">
          {TYPES.map(([key, label]) => (
            <Link key={key} href={`/admin/master-data/${key}`} aria-current={key === type ? "page" : undefined}
              className={`min-h-9 rounded-lg px-3 py-1.5 text-sm font-bold ${key === type ? "bg-[#0b4c86] text-white" : "text-slate-700 hover:bg-[#edf5fc]"}`}>{label}</Link>
          ))}
          <span className="mx-1 hidden h-6 w-px bg-slate-200 sm:block" aria-hidden="true" />
          {RELATED.map(([href, label]) => (
            <Link key={href} href={href} className="inline-flex min-h-9 items-center gap-1 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-800">
              {label}<ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
            </Link>
          ))}
        </nav>

        {state.error ? <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{state.error}</div> : null}

        <form onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search.trim()); }} className="flex gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">ค้นหา</span>
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" aria-hidden="true" />
            <input type="search" value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputClass} pl-9`} placeholder={`ค้นหา${state.label || ""}`} />
          </label>
          <Button type="submit" variant="secondary">ค้นหา</Button>
        </form>

        <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="overflow-x-auto">
            <table className="stack-mobile min-w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs font-bold text-slate-600">
                <tr>
                  {columns.map((field) => <th key={field} scope="col" className="px-4 py-3">{FIELD_LABELS[field] || field}</th>)}
                  <th scope="col" className="px-4 py-3">สถานะ</th>
                  <th scope="col" className="px-4 py-3 text-right"><span className="sr-only">จัดการ</span></th>
                </tr>
              </thead>
              <tbody>
                {state.loading && !state.rows.length ? (
                  <tr><td colSpan={columns.length + 2} className="p-10 text-center text-slate-500">กำลังโหลด…</td></tr>
                ) : !state.rows.length ? (
                  <tr><td colSpan={columns.length + 2} className="p-10 text-center text-slate-500">{appliedSearch ? `ไม่พบ "${appliedSearch}"` : "ยังไม่มีข้อมูล กด \"เพิ่มข้อมูล\" เพื่อเริ่ม"}</td></tr>
                ) : state.rows.map((row) => (
                  <tr key={row.id} className={`border-t border-slate-100 align-top ${row.is_active ? "" : "bg-slate-50 text-slate-500"}`}>
                    {columns.map((field, index) => (
                      <td key={field} className={`max-w-xs px-4 py-3 ${index === 0 ? "font-bold text-slate-900" : ""}`}>
                        <span className="line-clamp-2">{display(row[field])}</span>
                        {index === 0 && row.is_hotline ? <span className="mt-1 block"><StatusPill tone="red">สายด่วน</StatusPill></span> : null}
                      </td>
                    ))}
                    <td className="px-4 py-3">{row.is_active ? <StatusPill tone="green">ใช้งาน</StatusPill> : <StatusPill>เก็บเข้าคลัง</StatusPill>}</td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button type="button" onClick={() => edit(row)} aria-label={`แก้ไข ${rowName(row)}`} title="แก้ไข" className="rounded-lg p-2 text-[#0b4c86] hover:bg-[#edf5fc]"><Pencil className="h-4 w-4" aria-hidden="true" /></button>
                        {row.is_active ? <button type="button" onClick={() => setArchiving(row)} aria-label={`เก็บ ${rowName(row)} เข้าคลัง`} title="เก็บเข้าคลัง" className="rounded-lg p-2 text-amber-700 hover:bg-amber-50"><Archive className="h-4 w-4" aria-hidden="true" /></button> : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {state.total > paging.size ? (
            <PaginationControls page={paging.page} pageSize={paging.size} totalItems={state.total} pageSizeOptions={[20, 50, 100]} className="border-t border-slate-100 bg-slate-50"
              onPageChange={(page) => setPaging((value) => ({ ...value, page }))} onPageSizeChange={(size) => setPaging({ page: 1, size })} />
          ) : <p className="border-t border-slate-100 px-4 py-3 text-sm text-slate-600">ทั้งหมด {state.total.toLocaleString("th-TH")} รายการ</p>}
        </section>
      </AdminPage>

      <AppDialog open={showForm} onOpenChange={(open) => { if (!open) close(); }} busy={saving} size="lg"
        title={editingId ? `แก้ไข${state.label}` : `เพิ่ม${state.label}`}
        description="ช่องที่มี * ต้องกรอก">
        <form onSubmit={save} className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            {state.fields.filter((field) => !BOOLEAN_FIELDS.has(field)).map((field) => {
              const required = state.required.includes(field);
              const set = (event) => setForm((current) => ({ ...current, [field]: event.target.value }));
              return (
                <Field key={field} label={FIELD_LABELS[field] || field} required={required} hint={FIELD_HINTS[field]} wide={LONG_FIELDS.has(field) || field === "district_names"}>
                  {LONG_FIELDS.has(field) ? (
                    <textarea rows={3} required={required} value={form[field] ?? ""} onChange={set} className={inputClass} />
                  ) : (
                    <input required={required} value={form[field] ?? ""} onChange={set} className={inputClass}
                      type={field === "source_updated_at" ? "date" : field === "susceptibility_score" ? "number" : field === "phone" ? "tel" : "text"}
                      step={field === "susceptibility_score" ? "any" : undefined} />
                  )}
                </Field>
              );
            })}
          </div>
          <div className="flex flex-wrap gap-x-6 gap-y-2">
            {state.fields.filter((field) => BOOLEAN_FIELDS.has(field)).map((field) => (
              <label key={field} className="inline-flex min-h-10 items-center gap-2 text-sm font-bold text-slate-800">
                <input type="checkbox" className="h-4 w-4 accent-[#0b4c86]" checked={Boolean(form[field])} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.checked }))} />
                {FIELD_LABELS[field] || field}
              </label>
            ))}
          </div>
          <AppDialogActions>
            <AppDialogCancel disabled={saving} />
            <Button type="submit" disabled={saving}>{saving ? "กำลังบันทึก…" : editingId ? "บันทึกการแก้ไข" : "เพิ่มข้อมูล"}</Button>
          </AppDialogActions>
        </form>
      </AppDialog>

      <ReasonDialog
        open={Boolean(archiving)}
        onOpenChange={(open) => { if (!open) setArchiving(null); }}
        title="เก็บเข้าคลัง"
        description={archiving ? `"${rowName(archiving)}" จะไม่ถูกใช้ในระบบอีก แต่ยังเก็บไว้ในประวัติ และนำกลับมาใช้ได้ด้วยการแก้ไขแล้วติ๊ก "ใช้งานอยู่"` : ""}
        label="เหตุผล"
        confirmText="เก็บเข้าคลัง"
        busy={saving}
        onConfirm={archive}
      />
    </EOCLayout>
  );
}
