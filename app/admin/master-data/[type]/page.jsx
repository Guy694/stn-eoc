"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Archive, Pencil, Plus, RefreshCw, Save, Search, X } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useAuth } from "@/context/AuthContext";
import { showError, showSuccess } from "@/lib/sweetAlert";

const TYPES = [
  ["agencies", "หน่วยงาน"],
  ["diseases", "ประเภทโรค"],
  ["hazards", "ประเภทภัย"],
  ["risks", "Risk profile"],
  ["routes", "Route corridor"],
];
const BOOLEAN_FIELDS = new Set(["is_active", "is_hotline"]);
const JSON_FIELDS = new Set(["district_names"]);
const FIELD_LABELS = {
  slug: "รหัสย่อ", name: "ชื่อ", role_description: "บทบาท", area: "พื้นที่", phone: "โทรศัพท์",
  secondary_contact: "ผู้ติดต่อสำรอง", category: "หมวดหมู่", status: "สถานะ",
  source_name: "แหล่งข้อมูล", source_updated_at: "วันที่ข้อมูลต้นทาง", is_hotline: "สายด่วน",
  is_active: "ใช้งาน", description: "รายละเอียด", type_code: "รหัสประเภท",
  name_th: "ชื่อภาษาไทย", name_en: "ชื่อภาษาอังกฤษ", district_name: "อำเภอ",
  hazard_type: "ประเภทภัย", susceptibility_score: "คะแนนความเสี่ยง", model_version: "รุ่นแบบจำลอง",
  corridor_key: "รหัสเส้นทาง", corridor_name: "ชื่อเส้นทาง", district_names: "อำเภอ (JSON Array)",
  route_hint: "คำแนะนำเส้นทาง",
};

export default function MasterDataCatalogPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const type = params.type;
  const [state, setState] = useState({ loading: true, rows: [], fields: [], required: [], label: "", total: 0, error: "" });
  const [form, setForm] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) router.replace("/dashboard");
  }, [authLoading, router, user]);

  const load = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const query = appliedSearch ? `?search=${encodeURIComponent(appliedSearch)}` : "";
      const response = await fetch(`/stn-eoc/api/admin/master-data/catalog/${type}${query}`);
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลด Master Data ได้");
      setState({ loading: false, rows: result.data || [], fields: result.fields || [], required: result.required || [], label: result.label, total: Number(result.pagination?.total || 0), error: "" });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, [appliedSearch, type, user]);
  useEffect(() => { load(); }, [load]);

  const visibleFields = useMemo(() => state.fields.filter((field) => field !== "is_active"), [state.fields]);
  const reset = () => { setForm({ is_active: true }); setEditingId(null); setShowForm(false); };
  const openCreate = () => { setForm({ is_active: true, is_hotline: false }); setEditingId(null); setShowForm(true); };
  const edit = (row) => {
    const next = Object.fromEntries(state.fields.map((field) => {
      let value = row[field] ?? "";
      if (JSON_FIELDS.has(field) && typeof value !== "string") value = JSON.stringify(value);
      if (BOOLEAN_FIELDS.has(field)) value = Boolean(value);
      if (field === "source_updated_at" && value) value = String(value).slice(0, 10);
      return [field, value];
    }));
    setForm(next); setEditingId(row.id); setShowForm(true);
  };
  const save = async (event) => {
    event.preventDefault(); setSaving(true);
    try {
      const url = editingId ? `/stn-eoc/api/admin/master-data/catalog/${type}/${editingId}` : `/stn-eoc/api/admin/master-data/catalog/${type}`;
      const response = await fetch(url, { method: editingId ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "บันทึกไม่สำเร็จ");
      showSuccess(editingId ? "แก้ไข Master Data แล้ว" : "เพิ่ม Master Data แล้ว");
      reset(); await load();
    } catch (error) {
      showError(error.message);
    } finally { setSaving(false); }
  };
  const archive = async (row) => {
    if (!window.confirm("เก็บรายการนี้เข้าคลังหรือไม่?")) return;
    try {
      const response = await fetch(`/stn-eoc/api/admin/master-data/catalog/${type}/${row.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ reason: "เก็บเข้าคลังจากหน้า Master Data" }) });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "เก็บข้อมูลเข้าคลังไม่สำเร็จ");
      showSuccess("เก็บ Master Data เข้าคลังแล้ว");
      load();
    } catch (error) {
      showError(error.message);
    }
  };

  if (authLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;
  if (user.role !== "admin") return null;
  return <EOCLayout><section className="mx-auto max-w-7xl space-y-5">
    <header className="border-b-4 border-cyan-700 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black text-cyan-700">MASTER DATA</p><h1 className="mt-1 text-2xl font-black">{state.label || "จัดการ Master Data"}</h1><p className="mt-1 text-sm text-slate-600">ข้อมูลจากฐานข้อมูล พร้อม Source, วันที่อ้างอิง, Duplicate Check และ Audit Log</p></div><button type="button" onClick={load} className="inline-flex items-center gap-2 border border-slate-300 px-3 py-2 text-sm font-bold"><RefreshCw className="h-4 w-4" />รีเฟรช</button></div></header>
    <nav className="flex overflow-x-auto bg-white shadow-sm"><Link href="/admin/data-management" className="shrink-0 px-4 py-3 text-sm font-bold text-slate-600">ประชากร/Data Quality</Link>{TYPES.map(([key, label]) => <Link key={key} href={`/admin/master-data/${key}`} className={`shrink-0 px-4 py-3 text-sm font-bold ${key === type ? "bg-cyan-700 text-white" : "text-slate-600"}`}>{label}</Link>)}<Link href="/admin/health-facilities" className="shrink-0 px-4 py-3 text-sm font-bold text-slate-600">สถานพยาบาล</Link><Link href="/admin/village-polygons" className="shrink-0 px-4 py-3 text-sm font-bold text-slate-600">พื้นที่</Link></nav>
    {state.error ? <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{state.error}</div> : null}
    <div className="flex flex-wrap gap-3 bg-white p-4 shadow-sm"><form onSubmit={(event) => { event.preventDefault(); setAppliedSearch(search); }} className="flex min-w-0 flex-1 gap-2"><label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} className="h-10 w-full border border-slate-300 pl-9 pr-3 text-sm" placeholder="ค้นหา" /></label><button className="bg-slate-800 px-4 text-sm font-bold text-white">ค้นหา</button></form><button type="button" onClick={openCreate} className="inline-flex items-center gap-2 bg-cyan-700 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />เพิ่มข้อมูล</button></div>
    {showForm ? <form onSubmit={save} className="space-y-4 border border-cyan-200 bg-white p-5 shadow-sm"><div className="flex justify-between"><h2 className="text-lg font-black">{editingId ? "แก้ไขข้อมูล" : "เพิ่มข้อมูล"}</h2><button type="button" onClick={reset}><X className="h-5 w-5" /></button></div><div className="grid gap-4 md:grid-cols-2">{state.fields.map((field) => BOOLEAN_FIELDS.has(field) ? <label key={field} className="flex items-center gap-2 self-end py-3 text-sm font-bold"><input type="checkbox" checked={Boolean(form[field])} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.checked }))} />{FIELD_LABELS[field] || field}</label> : <label key={field} className="text-sm font-bold">{FIELD_LABELS[field] || field}<textarea rows={["description", "role_description", "route_hint"].includes(field) ? 3 : 1} required={state.required.includes(field)} value={form[field] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [field]: event.target.value }))} className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal" /></label>)}</div><div className="flex justify-end"><button disabled={saving} className="inline-flex items-center gap-2 bg-cyan-700 px-4 py-2 text-sm font-bold text-white"><Save className="h-4 w-4" />{saving ? "กำลังบันทึก..." : "บันทึก"}</button></div></form> : null}
    <div className="overflow-x-auto bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-white"><tr>{visibleFields.slice(0, 6).map((field) => <th key={field} className="px-4 py-3">{FIELD_LABELS[field] || field}</th>)}<th className="px-4 py-3">จัดการ</th></tr></thead><tbody>{state.loading ? <tr><td colSpan="7" className="p-10 text-center">กำลังโหลด...</td></tr> : !state.rows.length ? <tr><td colSpan="7" className="p-10 text-center text-slate-500">ไม่พบข้อมูล</td></tr> : state.rows.map((row) => <tr key={row.id} className="border-t border-slate-100">{visibleFields.slice(0, 6).map((field) => <td key={field} className="max-w-xs px-4 py-3">{typeof row[field] === "object" ? JSON.stringify(row[field]) : String(row[field] ?? "-")}</td>)}<td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => edit(row)} className="text-cyan-700"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => archive(row)} className="text-amber-700"><Archive className="h-4 w-4" /></button></div></td></tr>)}</tbody></table><footer className="border-t border-slate-200 p-3 text-sm text-slate-600">ทั้งหมด {state.total.toLocaleString()} รายการ</footer></div>
  </section></EOCLayout>;
}
