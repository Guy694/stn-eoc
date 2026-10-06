"use client";

// ทะเบียนกลุ่มเปราะบาง (ข้อมูลกลาง): จำนวนผู้เปราะบางรายหมู่บ้านช่วงปกติ
// ใช้เป็นตัวเลขตั้งต้นเมื่อเกิดเหตุการณ์ — ข้อมูล "ในเหตุการณ์" (ได้รับผลกระทบ/ดูแล/เคลื่อนย้าย) อยู่ที่เมนูของ EOC แต่ละประเภท
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import {
  AddButton, AdminPage, DataTable, DeleteDialog, Field, FilterSelect, FormDialog, FormGrid, FormSection, RowActions,
  Toolbar, UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import AreaFields from "@/components/admin/AreaFields";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { readQuery } from "@/components/admin/useUrlState";
import { VULNERABLE_TYPES, affectedOf } from "@/lib/vulnerableEvent";

const BASELINE_API = "/stn-eoc/api/eoc/vulnerable-groups/baseline";
const BASELINE_EDITORS = ["admin", "commander", "SAT", "SeRHT"];
const EVENT_PAGES = { flood: { label: "อุทกภัย", path: "/eoc/flood/vulnerable-groups" }, disease: { label: "โรคระบาด", path: "/eoc/disease/vulnerable-groups" } };

const EMPTY = { district: "", tambon: "", village: "", ...Object.fromEntries(VULNERABLE_TYPES.map((type) => [type.key, 0])) };

function area(row) {
  return { main: row.village || `ต.${row.tambon}`, sub: [row.village && `ต.${row.tambon}`, `อ.${row.district}`].filter(Boolean).join(" ") };
}

export default function VulnerableWorkspace() {
  const router = useRouter();
  const { user } = useAuth();
  const { eocStatus } = useEOC();
  const { notice, success } = useNotice();
  const canEdit = BASELINE_EDITORS.includes(user?.role);
  const isAdmin = user?.role === "admin";

  // ลิงก์เก่า ?tab=session&eoc=flood → หน้ากลุ่มเปราะบางในเหตุการณ์
  useEffect(() => {
    if (readQuery("tab") !== "session") return;
    const target = EVENT_PAGES[readQuery("eoc")] || EVENT_PAGES.flood;
    router.replace(target.path);
  }, [router]);

  const openEvents = useMemo(() => Object.entries(EVENT_PAGES)
    .filter(([type]) => eocStatus?.[type]?.is_active)
    .map(([type, page]) => ({ type, ...page, number: eocStatus[type].session_number })), [eocStatus]);

  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiRequest(BASELINE_API);
      setRows(json.data || []);
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { reload(); }, [reload]);

  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const districts = useMemo(() => [...new Set(rows.map((row) => row.district).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [rows]);
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows.filter((row) => {
      if (district !== "all" && row.district !== district) return false;
      return !query || `${row.village || ""} ${row.tambon} ${row.district}`.toLowerCase().includes(query);
    });
  }, [district, rows, search]);
  const totals = useMemo(() => {
    const sum = (key) => filtered.reduce((total, row) => total + (Number(row[key]) || 0), 0);
    return { all: filtered.reduce((total, row) => total + affectedOf(row), 0), ...Object.fromEntries(VULNERABLE_TYPES.map((type) => [type.key, sum(type.key)])) };
  }, [filtered]);

  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState("");
  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const openForm = (row = null) => {
    setEditing(row || {});
    setForm(row ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, row[key] ?? EMPTY[key]])) } : EMPTY);
    setFormError("");
  };

  const save = async () => {
    if (!form.district || !form.tambon) { setFormError("กรุณาเลือกอำเภอและตำบล"); return; }
    const negative = VULNERABLE_TYPES.find((type) => Number(form[type.key]) < 0);
    if (negative) { setFormError(`จำนวน${negative.label}ต้องไม่ติดลบ`); return; }
    setBusy(true);
    try {
      const counts = Object.fromEntries(VULNERABLE_TYPES.map((type) => [type.key, Number(form[type.key]) || 0]));
      // แก้ไข: ส่งค่าเดิมที่ไม่ได้แสดงในฟอร์มกลับไปด้วย (ไม่ให้ข้อมูลเก่าหาย)
      const body = { ...(editing?.id ? editing : {}), ...form, ...counts, village: form.village || null };
      if (editing?.id) await apiRequest(BASELINE_API, { method: "PUT", body: { ...body, id: editing.id } });
      else await apiRequest(BASELINE_API, { method: "POST", body });
      success(editing?.id ? "บันทึกการแก้ไขแล้ว" : "เพิ่มข้อมูลแล้ว");
      setEditing(null);
      reload();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async (reason) => {
    setBusy(true);
    try {
      const json = await apiRequest(`${BASELINE_API}?id=${deleting.id}`, { method: "DELETE", body: { reason } });
      success(json.message);
      setDeleting(null);
      reload();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    { key: "area", label: "พื้นที่", render: (row) => { const label = area(row); return (<div><div className="font-semibold text-slate-900">{label.main}</div><div className="text-xs text-slate-500">{label.sub}</div></div>); } },
    { key: "total", label: "รวม", className: "text-right", render: (row) => <strong className="text-base">{formatNumber(affectedOf(row))}</strong> },
    ...VULNERABLE_TYPES.map((type) => ({ key: type.key, label: type.short, className: "text-right tabular-nums", render: (row) => formatNumber(row[type.key]) })),
    { key: "updated_at", label: "อัปเดต", render: (row) => <UpdatedAt value={row.updated_at} staleHours={24 * 90} /> }
  ];

  return (
    <AdminPage
      context="ข้อมูลกลาง"
      title="ทะเบียนกลุ่มเปราะบาง"
      description="จำนวนผู้เปราะบางแต่ละประเภทรายหมู่บ้าน เมื่อเปิด EOC เมนูกลุ่มเปราะบางของเหตุการณ์จะดึงจำนวนจากทะเบียนนี้ไปใช้"
      actions={canEdit ? <AddButton onClick={() => openForm()}>เพิ่มพื้นที่</AddButton> : null}
    >
      {openEvents.length ? (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <span>มี EOC เปิดอยู่ ดูผู้ได้รับผลกระทบ การดูแล และการเคลื่อนย้ายได้ที่</span>
          {openEvents.map((item) => (
            <Link key={item.type} href={item.path} className="font-bold text-[#0b4c86] underline-offset-2 hover:underline">
              กลุ่มเปราะบาง {item.label}{item.number ? ` ครั้งที่ ${item.number}` : ""}
            </Link>
          ))}
        </div>
      ) : null}
      {loadError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{loadError}</p> : null}
      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 sm:grid-cols-4 lg:grid-cols-7">
        <div className="bg-white px-4 py-3">
          <dt className="text-xs font-semibold text-slate-500">รวมทุกประเภท</dt>
          <dd className="mt-0.5 text-2xl font-black text-[#0b4c86]">{formatNumber(totals.all)}</dd>
        </div>
        {VULNERABLE_TYPES.map((type) => (
          <div key={type.key} className="bg-white px-4 py-3">
            <dt className="text-xs font-semibold text-slate-500">{type.label}</dt>
            <dd className="mt-0.5 text-2xl font-black text-slate-900">{formatNumber(totals[type.key])}</dd>
          </div>
        ))}
      </dl>
      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาหมู่บ้าน ตำบล อำเภอ">
        <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={[{ value: "all", label: "ทุกอำเภอ" }, ...districts.map((name) => ({ value: name, label: `อ.${name}` }))]} />
      </Toolbar>
      <DataTable
        caption="ทะเบียนกลุ่มเปราะบาง"
        loading={loading}
        rows={filtered}
        emptyText="ยังไม่มีข้อมูลในพื้นที่ที่เลือก"
        columns={columns}
        rowActions={canEdit ? (row) => <RowActions onEdit={() => openForm(row)} onDelete={isAdmin ? () => { setDeleteError(""); setDeleting(row); } : undefined} /> : undefined}
      />

      <FormDialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)} title={editing?.id ? "แก้ไขทะเบียนกลุ่มเปราะบาง" : "เพิ่มพื้นที่"} description="ข้อมูลกลาง" onSubmit={save} busy={busy} error={formError}>
        <FormGrid>
          <FormSection title="พื้นที่"><AreaFields value={form} onChange={updateForm} /></FormSection>
          <FormSection title={`จำนวนคน (รวม ${formatNumber(affectedOf(form))} คน)`}>
            {VULNERABLE_TYPES.map((type) => (
              <Field key={type.key} label={type.label}>
                <input type="number" min={0} className={inputClass} value={form[type.key]} onChange={(event) => updateForm({ [type.key]: event.target.value })} />
              </Field>
            ))}
          </FormSection>
        </FormGrid>
      </FormDialog>

      <DeleteDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)} itemType="ทะเบียนกลุ่มเปราะบาง" itemLabel={deleting ? `${area(deleting).main} ${area(deleting).sub}` : ""} onConfirm={confirmDelete} busy={busy} error={deleteError} />
      {notice}
    </AdminPage>
  );
}
