"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Archive, ChevronLeft, ChevronRight, Database, Pencil, Plus, RefreshCw, Save, Search, ShieldCheck, X } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useAuth } from "@/context/AuthContext";
import { showError, showSuccess } from "@/lib/sweetAlert";

const EMPTY_FORM = {
  province_code: "91",
  district_code: "",
  district_name: "",
  male_population: 0,
  female_population: 0,
  population_year: "",
  population_scope: "thai",
  source_name: "",
  source_updated_at: "",
  notes: "",
};

const ISSUE_LABELS = {
  population_year_missing: "ไม่มีปีอ้างอิง",
  source_name_missing: "ไม่มีแหล่งข้อมูล",
  population_total_mismatch: "ยอดรวมประชากรไม่ตรง",
  male_population_invalid: "ประชากรชายผิดช่วง",
  female_population_invalid: "ประชากรหญิงผิดช่วง",
  population_scope_missing: "ไม่มีขอบเขตประชากร",
  report_context_missing: "รายงานไม่มี Session/วันที่",
  duplicate_report: "รายงานซ้ำ",
  report_not_approved: "รายงานยังไม่อนุมัติ",
  mission_value_invalid: "ข้อมูลภารกิจผิดช่วง",
  file_missing: "ไม่พบไฟล์จริง",
  invalid_storage_path: "เส้นทางไฟล์ไม่ปลอดภัย",
  checksum_mismatch: "Checksum ไม่ตรง",
  file_size_mismatch: "ขนาดไฟล์ไม่ตรง",
  file_unreadable: "อ่านไฟล์ไม่ได้",
};

export default function DataManagementPage() {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const [section, setSection] = useState("population");
  const [rows, setRows] = useState([]);
  const [quality, setQuality] = useState({ summary: { total: 0, by_type: {} }, data: [] });
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [appliedSearch, setAppliedSearch] = useState("");
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const pageSize = 20;

  useEffect(() => {
    if (!authLoading && (!user || user.role !== "admin")) router.replace("/dashboard");
  }, [authLoading, router, user]);

  const load = useCallback(async () => {
    if (!user || user.role !== "admin") return;
    setLoading(true);
    setError("");
    try {
      if (section === "quality") {
        const response = await fetch("/stn-eoc/api/admin/data-quality?limit=500");
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถตรวจคุณภาพข้อมูลได้");
        setQuality(result);
      } else {
        const params = new URLSearchParams({ page: String(page), limit: String(pageSize) });
        if (appliedSearch) params.set("search", appliedSearch);
        const response = await fetch(`/stn-eoc/api/admin/master-data/population?${params}`);
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดข้อมูลประชากรได้");
        setRows(result.data || []);
        setTotal(Number(result.pagination?.total || 0));
      }
    } catch (loadError) {
      setError(loadError.message || "เกิดข้อผิดพลาด");
    } finally {
      setLoading(false);
    }
  }, [appliedSearch, page, section, user]);

  useEffect(() => { load(); }, [load]);

  const totalPopulation = useMemo(() => rows.reduce((sum, row) => sum + Number(row.population || 0), 0), [rows]);
  const resetForm = () => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(false); };
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const totalCalculated = Number(form.male_population || 0) + Number(form.female_population || 0);

  const edit = (row) => {
    setEditingId(row.id);
    setForm({
      province_code: row.province_code || "91",
      district_code: row.district_code || "",
      district_name: row.district_name || "",
      male_population: Number(row.male_population || 0),
      female_population: Number(row.female_population || 0),
      population_year: row.population_year || "",
      population_scope: row.population_scope || "thai",
      source_name: row.source_name || "",
      source_updated_at: row.source_updated_at ? String(row.source_updated_at).slice(0, 10) : "",
      notes: row.notes || "",
    });
    setShowForm(true);
  };

  const save = async (event) => {
    event.preventDefault();
    setSaving(true); setError("");
    try {
      const response = await fetch(editingId ? `/stn-eoc/api/admin/master-data/population/${editingId}` : "/stn-eoc/api/admin/master-data/population", {
        method: editingId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "บันทึกไม่สำเร็จ");
      showSuccess(editingId ? "แก้ไขข้อมูลประชากรแล้ว" : "เพิ่มข้อมูลประชากรแล้ว");
      resetForm();
      await load();
    } catch (saveError) {
      showError(saveError.message);
    } finally {
      setSaving(false);
    }
  };

  const archive = async (row) => {
    if (!window.confirm(`เก็บข้อมูล ${row.district_name} เข้าคลังหรือไม่?`)) return;
    setError("");
    try {
      const response = await fetch(`/stn-eoc/api/admin/master-data/population/${row.id}`, {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: "ผู้ดูแลระบบเก็บข้อมูลเข้าคลัง" }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "ดำเนินการไม่สำเร็จ");
      showSuccess(result.message);
      await load();
    } catch (archiveError) {
      showError(archiveError.message);
    }
  };

  if (authLoading || !user) return <div className="grid min-h-screen place-items-center text-sm text-slate-500">กำลังตรวจสอบสิทธิ์...</div>;
  if (user.role !== "admin") return null;

  return <EOCLayout>
    <section className="mx-auto max-w-7xl space-y-5">
      <header className="border-b-4 border-cyan-700 bg-white p-5 shadow-sm">
        <p className="text-xs font-black text-cyan-700">ADMIN · DATABASE SOURCE OF TRUTH</p>
        <div className="mt-1 flex flex-wrap items-center justify-between gap-3">
          <div><h1 className="text-2xl font-black text-slate-900">ศูนย์จัดการและตรวจคุณภาพข้อมูล</h1><p className="mt-1 text-sm text-slate-600">จัดการ Master Data พร้อม Audit และตรวจข้อมูลผิดปกติก่อนนำไปใช้</p></div>
          <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />รีเฟรช</button>
        </div>
      </header>

      <nav className="grid grid-cols-2 bg-white shadow-sm">
        <button type="button" onClick={() => { setSection("population"); setPage(1); }} className={`p-4 text-sm font-black ${section === "population" ? "bg-cyan-700 text-white" : "text-slate-700"}`}><Database className="mr-2 inline h-4 w-4" />ประชากรรายอำเภอ</button>
        <button type="button" onClick={() => setSection("quality")} className={`p-4 text-sm font-black ${section === "quality" ? "bg-cyan-700 text-white" : "text-slate-700"}`}><ShieldCheck className="mr-2 inline h-4 w-4" />Data Quality ({quality.summary?.total || 0})</button>
      </nav>

      {error ? <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}
      {section === "population" ? <>
        <div className="grid gap-3 md:grid-cols-3">
          <Metric label="รายการในหน้านี้" value={rows.length} />
          <Metric label="ประชากรรวมในหน้านี้" value={totalPopulation.toLocaleString("th-TH")} />
          <Metric label="รายการทั้งหมด" value={total.toLocaleString("th-TH")} />
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-4 shadow-sm">
          <form onSubmit={(event) => { event.preventDefault(); setPage(1); setAppliedSearch(search); }} className="flex min-w-0 flex-1 gap-2">
            <label className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="ค้นหาอำเภอ รหัส หรือแหล่งข้อมูล" className="h-10 w-full border border-slate-300 pl-9 pr-3 text-sm" /></label>
            <button className="bg-slate-800 px-4 text-sm font-bold text-white">ค้นหา</button>
          </form>
          <button type="button" onClick={() => { setForm(EMPTY_FORM); setEditingId(null); setShowForm(true); }} className="inline-flex h-10 items-center gap-2 bg-cyan-700 px-4 text-sm font-bold text-white"><Plus className="h-4 w-4" />เพิ่มข้อมูล</button>
        </div>

        {showForm ? <form onSubmit={save} className="space-y-4 border border-cyan-200 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between"><h2 className="text-lg font-black">{editingId ? "แก้ไขข้อมูลประชากร" : "เพิ่มข้อมูลประชากร"}</h2><button type="button" onClick={resetForm}><X className="h-5 w-5" /></button></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Field label="รหัสจังหวัด"><input required value={form.province_code} onChange={(e) => update("province_code", e.target.value)} className="input" /></Field>
            <Field label="รหัสอำเภอ"><input value={form.district_code} onChange={(e) => update("district_code", e.target.value)} className="input" /></Field>
            <Field label="อำเภอ"><input required value={form.district_name} onChange={(e) => update("district_name", e.target.value)} className="input" /></Field>
            <Field label="ขอบเขตประชากร"><select value={form.population_scope} onChange={(e) => update("population_scope", e.target.value)} className="input"><option value="thai">สัญชาติไทย</option><option value="all">ประชากรทั้งหมด</option></select></Field>
            <Field label="ชาย"><input type="number" min="0" required value={form.male_population} onChange={(e) => update("male_population", e.target.value)} className="input" /></Field>
            <Field label="หญิง"><input type="number" min="0" required value={form.female_population} onChange={(e) => update("female_population", e.target.value)} className="input" /></Field>
            <Field label="รวม (คำนวณอัตโนมัติ)"><output className="input block bg-slate-100 font-black">{totalCalculated.toLocaleString("th-TH")}</output></Field>
            <Field label="ปีข้อมูล"><input type="number" min="1900" max="2600" value={form.population_year} onChange={(e) => update("population_year", e.target.value)} className="input" /></Field>
            <Field label="แหล่งข้อมูล"><input required value={form.source_name} onChange={(e) => update("source_name", e.target.value)} className="input" /></Field>
            <Field label="วันที่ข้อมูลต้นทาง"><input type="date" value={form.source_updated_at} onChange={(e) => update("source_updated_at", e.target.value)} className="input" /></Field>
            <Field label="หมายเหตุ" wide><textarea rows="2" value={form.notes} onChange={(e) => update("notes", e.target.value)} className="input" /></Field>
          </div>
          <div className="flex justify-end gap-2"><button type="button" onClick={resetForm} className="border border-slate-300 px-4 py-2 text-sm font-bold">ยกเลิก</button><button disabled={saving} className="inline-flex items-center gap-2 bg-cyan-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"><Save className="h-4 w-4" />{saving ? "กำลังบันทึก..." : "บันทึก"}</button></div>
        </form> : null}

        <div className="overflow-x-auto bg-white shadow-sm">
          <table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">อำเภอ</th><th className="px-4 py-3 text-right">ชาย</th><th className="px-4 py-3 text-right">หญิง</th><th className="px-4 py-3 text-right">รวม</th><th className="px-4 py-3">ขอบเขต/ปี</th><th className="px-4 py-3">แหล่งข้อมูล</th><th className="px-4 py-3">แก้ไขล่าสุด</th><th className="px-4 py-3">จัดการ</th></tr></thead>
            <tbody>{loading ? <tr><td colSpan="8" className="p-10 text-center text-slate-500">กำลังโหลด...</td></tr> : !rows.length ? <tr><td colSpan="8" className="p-10 text-center text-slate-500">ไม่พบข้อมูล</td></tr> : rows.map((row) => <tr key={row.id} className="border-t border-slate-100">
              <td className="px-4 py-3 font-black">{row.district_name}<p className="text-xs font-normal text-slate-500">{row.district_code || "-"}</p></td>
              <td className="px-4 py-3 text-right">{Number(row.male_population).toLocaleString("th-TH")}</td><td className="px-4 py-3 text-right">{Number(row.female_population).toLocaleString("th-TH")}</td><td className="px-4 py-3 text-right font-black">{Number(row.population).toLocaleString("th-TH")}</td>
              <td className="px-4 py-3">{row.population_scope === "thai" ? "สัญชาติไทย" : "ทั้งหมด"}<p className={`text-xs ${row.population_year ? "text-slate-500" : "font-bold text-amber-700"}`}>{row.population_year || "ไม่ระบุปี"}</p></td>
              <td className="px-4 py-3">{row.source_name}<p className="text-xs text-slate-500">{row.source_updated_at ? new Date(row.source_updated_at).toLocaleDateString("th-TH") : "-"}</p></td>
              <td className="px-4 py-3">{row.updated_by_name?.trim() || "-"}<p className="text-xs text-slate-500">{new Date(row.updated_at).toLocaleString("th-TH")}</p></td>
              <td className="px-4 py-3"><div className="flex gap-2"><button type="button" onClick={() => edit(row)} title="แก้ไข" className="text-cyan-700"><Pencil className="h-4 w-4" /></button><button type="button" onClick={() => archive(row)} title="เก็บเข้าคลัง" className="text-amber-700"><Archive className="h-4 w-4" /></button></div></td>
            </tr>)}</tbody>
          </table>
          <footer className="flex items-center justify-between border-t border-slate-200 p-3 text-sm"><span>หน้า {page} / {Math.max(Math.ceil(total / pageSize), 1)}</span><div className="flex gap-2"><button type="button" disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="border border-slate-300 p-2 disabled:opacity-40"><ChevronLeft className="h-4 w-4" /></button><button type="button" disabled={page * pageSize >= total} onClick={() => setPage((value) => value + 1)} className="border border-slate-300 p-2 disabled:opacity-40"><ChevronRight className="h-4 w-4" /></button></div></footer>
        </div>
      </> : <QualityView quality={quality} loading={loading} />}
    </section>
    <style jsx global>{`.input{margin-top:.25rem;width:100%;border:1px solid #cbd5e1;padding:.625rem .75rem;font-weight:400;min-height:42px}`}</style>
  </EOCLayout>;
}

function Metric({ label, value }) { return <div className="bg-white p-4 shadow-sm"><p className="text-xs font-bold text-slate-500">{label}</p><p className="mt-2 text-2xl font-black text-slate-900">{value}</p></div>; }
function Field({ label, wide, children }) { return <label className={`text-sm font-bold text-slate-700 ${wide ? "md:col-span-2" : ""}`}>{label}{children}</label>; }
function QualityView({ quality, loading }) {
  const types = Object.entries(quality.summary?.by_type || {});
  return <div className="space-y-4">
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"><Metric label="ปัญหาทั้งหมด" value={quality.summary?.total || 0} />{types.slice(0, 3).map(([type, count]) => <Metric key={type} label={ISSUE_LABELS[type] || type} value={count} />)}</div>
    <div className="overflow-x-auto bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">ประเภทปัญหา</th><th className="px-4 py-3">ตาราง/Record</th><th className="px-4 py-3">ข้อมูล</th><th className="px-4 py-3">รายละเอียด</th><th className="px-4 py-3">แก้ไข</th></tr></thead><tbody>{loading ? <tr><td colSpan="5" className="p-10 text-center">กำลังตรวจสอบ...</td></tr> : !quality.data?.length ? <tr><td colSpan="5" className="p-10 text-center text-emerald-700"><ShieldCheck className="mx-auto mb-2 h-7 w-7" />ไม่พบปัญหาตามกฎที่ตรวจสอบ</td></tr> : quality.data.map((item, index) => <tr key={`${item.table_name}-${item.record_id}-${item.issue_type}-${index}`} className="border-t border-slate-100"><td className="px-4 py-3"><span className="inline-flex items-center gap-1 border border-amber-200 bg-amber-50 px-2 py-1 text-xs font-bold text-amber-800"><AlertTriangle className="h-3 w-3" />{ISSUE_LABELS[item.issue_type] || item.issue_type}</span></td><td className="px-4 py-3 font-mono text-xs">{item.table_name} #{item.record_id}</td><td className="px-4 py-3 font-bold">{item.label}</td><td className="px-4 py-3">{item.detail}</td><td className="px-4 py-3"><a href={item.edit_url} className="font-bold text-cyan-700 underline">เปิดรายการ</a></td></tr>)}</tbody></table></div>
  </div>;
}
