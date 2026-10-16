"use client";

// ทะเบียนกลุ่มเปราะบาง (ข้อมูลกลาง): จำนวนผู้เปราะบางรายหมู่บ้านช่วงปกติ
// ใช้เป็นตัวเลขตั้งต้นเมื่อเกิดเหตุการณ์ — ข้อมูล "ในเหตุการณ์" (ได้รับผลกระทบ/ดูแล/เคลื่อนย้าย) อยู่ที่เมนูของ EOC แต่ละประเภท
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Accessibility, Baby, BedDouble, Brain, Droplet, Droplets, HeartPulse, MapPin, PersonStanding, Pill } from "lucide-react";
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

const TYPE_ICONS = {
  bedridden: BedDouble, disabled: Accessibility, pregnant: HeartPulse, elderly: PersonStanding, children: Baby,
  chronic_illness: Pill, psychiatric: Brain, dialysis_hd: Droplets, dialysis_pd: Droplet
};
// สีตามความเร่งด่วนเมื่อเกิดภัย (priority จาก lib/vulnerableEvent)
const PRIORITY_TONES = {
  3: { tile: "bg-red-50 text-red-700 ring-red-100", bar: "bg-red-500", label: "ต้องช่วยก่อน" },
  2: { tile: "bg-amber-50 text-amber-700 ring-amber-100", bar: "bg-amber-500", label: "" },
  1: { tile: "bg-sky-50 text-sky-700 ring-sky-100", bar: "bg-sky-500", label: "" }
};

const PRIORITY_GROUPS = [
  { priority: 3, label: "ต้องช่วยก่อน", dot: "bg-red-400" },
  { priority: 2, label: "ดูแลใกล้ชิด", dot: "bg-amber-300" },
  { priority: 1, label: "เฝ้าระวังทั่วไป", dot: "bg-sky-300" }
];

/** สรุปยอดผู้เปราะบาง: การ์ดยอดรวม + การ์ดรายประเภท (เรียงตามความเร่งด่วน) พร้อมสัดส่วนจากยอดรวม */
function VulnerableSummary({ totals, areaCount, districtLabel }) {
  const types = [...VULNERABLE_TYPES].sort((a, b) => b.priority - a.priority);
  return (
    <section className="grid gap-3 lg:grid-cols-[17rem_minmax(0,1fr)]" aria-label="สรุปจำนวนผู้เปราะบาง">
      <div className="relative overflow-hidden rounded-2xl bg-[#0b4c86] p-5 font-[family-name:var(--font-kanit)] text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)]">
        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/10" aria-hidden="true" />
        <p className="relative text-sm font-medium text-blue-100">ผู้เปราะบางทั้งหมด</p>
        <p className="relative mt-1 text-[2.6rem] font-bold leading-none tabular-nums">{formatNumber(totals.all)}</p>
        <p className="relative mt-1 text-sm text-blue-100">คน</p>
        <dl className="relative mt-5 space-y-1.5 border-t border-white/15 pt-3 text-sm">
          {PRIORITY_GROUPS.map((group) => (
            <div key={group.priority} className="flex items-center justify-between gap-2">
              <dt className="flex items-center gap-2 text-blue-50"><span className={`h-2 w-2 rounded-full ${group.dot}`} aria-hidden="true" />{group.label}</dt>
              <dd className="font-semibold tabular-nums">{formatNumber(VULNERABLE_TYPES.filter((type) => type.priority === group.priority).reduce((sum, type) => sum + (Number(totals[type.key]) || 0), 0))}</dd>
            </div>
          ))}
        </dl>
        <p className="relative mt-4 flex items-center gap-1.5 text-xs text-blue-100">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          {formatNumber(areaCount)} พื้นที่ · {districtLabel}
        </p>
      </div>
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
        {types.map((type) => {
          const Icon = TYPE_ICONS[type.key] || PersonStanding;
          const tone = PRIORITY_TONES[type.priority] || PRIORITY_TONES[1];
          const value = Number(totals[type.key]) || 0;
          const share = totals.all ? Math.round((value / totals.all) * 1000) / 10 : 0;
          return (
            <li key={type.key} className="flex flex-col rounded-2xl border border-slate-200 bg-white p-3.5 font-[family-name:var(--font-kanit)] transition-shadow hover:shadow-[0_10px_24px_-18px_rgba(15,23,42,.5)]">
              <div className="flex items-start justify-between gap-2">
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1 ${tone.tile}`}><Icon className="h-[18px] w-[18px]" aria-hidden="true" /></span>
                {tone.label ? <span className="rounded-full bg-red-50 px-2 py-0.5 text-[11px] font-bold text-red-700">{tone.label}</span> : null}
              </div>
              <p className="mt-2.5 min-h-[2.5em] text-[13px] font-medium leading-tight text-slate-600">{type.label}</p>
              <p className="mt-1 text-2xl font-bold leading-none tabular-nums text-slate-900">{formatNumber(value)}</p>
              <div className="mt-3 flex items-center gap-2" title={`${share}% ของผู้เปราะบางทั้งหมด`}>
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-slate-100">
                  <span className={`block h-full rounded-full ${tone.bar}`} style={{ width: `${Math.min(100, share)}%` }} />
                </span>
                <span className="w-11 text-right text-xs tabular-nums text-slate-500">{share}%</span>
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

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
      <VulnerableSummary totals={totals} areaCount={filtered.length} districtLabel={district === "all" ? "ทุกอำเภอ" : `อ.${district}`} />
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
