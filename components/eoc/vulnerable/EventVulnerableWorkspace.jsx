"use client";

// กลุ่มเปราะบางในเหตุการณ์ที่เปิด: dashboard สรุป + รายหมู่บ้าน
// จำนวนแต่ละประเภทดึงจากทะเบียนกลาง (/eoc/vulnerable-groups) — เจ้าหน้าที่เพิ่ม/ลบหมู่บ้าน และแก้ไขเฉพาะสถานะ
// (ดูแลแล้ว เคลื่อนย้ายแล้ว ย้ายไปที่ ความต้องการ หมายเหตุ)
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertTriangle, HeartHandshake, RefreshCw, Truck, Users } from "lucide-react";
import {
  AddButton, AdminPage, Button, DataTable, DeleteDialog, Field, FilterSelect, FormDialog, FormGrid, RowActions,
  Toolbar, UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import { apiRequest, formatNumber } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { VULNERABLE_TYPES, affectedOf, validateEventRecord } from "@/lib/vulnerableEvent";

const API = "/stn-eoc/api/eoc/vulnerable-event";
const EMPTY_STATUS = { cared_count: 0, moved_count: 0, moved_to: "", needs: "", notes: "" };

function areaName(row) {
  return { main: row.village || `ต.${row.tambon}`, sub: [row.village && `ต.${row.tambon}`, `อ.${row.district}`].filter(Boolean).join(" ") };
}

function Meter({ value, max, tone = "bg-[#0b4c86]", label }) {
  const percent = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="h-2 overflow-hidden rounded-full bg-slate-100" role="meter" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label={label}>
      <div className={`h-full rounded-full ${tone}`} style={{ width: `${percent}%` }} />
    </div>
  );
}

function Kpi({ icon: Icon, label, value, unit = "คน", hint, tone = "text-slate-900" }) {
  return (
    <div className="rounded-xl border border-[#c9dcee] bg-white p-4">
      <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">{Icon ? <Icon className="h-4 w-4" aria-hidden="true" /> : null}{label}</div>
      <p className={`mt-1 text-3xl font-black tabular-nums ${tone}`}>{formatNumber(value)} <span className="text-sm font-semibold text-slate-500">{unit}</span></p>
      {hint ? <p className="mt-0.5 text-xs text-slate-500">{hint}</p> : null}
    </div>
  );
}

function Dashboard({ summary }) {
  const maxType = Math.max(1, ...summary.byType.map((type) => type.affected));
  return (
    <section aria-label="สรุปกลุ่มเปราะบางในเหตุการณ์" className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <Kpi icon={Users} label="หมู่บ้านที่ประสบภัย" value={summary.villages} unit="แห่ง" hint={`${formatNumber(summary.districts.length)} อำเภอ`} />
        <Kpi icon={AlertTriangle} label="กลุ่มเปราะบางที่ได้รับผลกระทบ" value={summary.affected} hint="จำนวนตามทะเบียนกลาง" tone="text-[#0b4c86]" />
        <Kpi icon={HeartHandshake} label="ดูแลแล้ว" value={summary.cared} hint={`${summary.caredPercent}% ของผู้ได้รับผลกระทบ`} tone="text-emerald-700" />
        <Kpi icon={Truck} label="เคลื่อนย้ายแล้ว" value={summary.moved} hint={`${summary.movedPercent}% ของผู้ได้รับผลกระทบ`} tone="text-sky-800" />
        <Kpi label="ยังไม่ได้ดูแล" value={summary.pending} hint={summary.pending ? "ต้องติดตาม" : "ดูแลครบแล้ว"} tone={summary.pending ? "text-red-700" : "text-emerald-700"} />
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_.9fr]">
        <div className="rounded-xl border border-[#c9dcee] bg-white p-5">
          <h3 className="text-base font-black text-slate-900">แยกตามประเภท</h3>
          <p className="text-xs text-slate-500">ผู้เปราะบางในหมู่บ้านที่ประสบภัย (จากทะเบียนกลาง)</p>
          <ul className="mt-4 space-y-3">
            {summary.byType.map((type) => (
              <li key={type.key}>
                <div className="flex items-baseline justify-between gap-3 text-sm">
                  <span className="font-semibold text-slate-800">{type.label}</span>
                  <span className="tabular-nums text-slate-600"><b className="text-slate-900">{formatNumber(type.affected)}</b> คน</span>
                </div>
                <div className="relative mt-1 h-2.5 overflow-hidden rounded-full bg-slate-100">
                  <div className="absolute inset-y-0 left-0 rounded-full bg-[#0b4c86]" style={{ width: `${(type.affected / maxType) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-xl border border-[#c9dcee] bg-white p-5">
          <h3 className="text-base font-black text-slate-900">ต้องติดตามด่วน</h3>
          <p className="text-xs text-slate-500">หมู่บ้านที่ยังดูแลไม่ครบ เรียงตามจำนวนผู้ติดเตียง/พิการ/ตั้งครรภ์ที่รอ</p>
          {summary.urgent.length ? (
            <ol className="mt-3 divide-y divide-slate-100">
              {summary.urgent.map((row) => {
                const name = areaName(row);
                const critical = VULNERABLE_TYPES.filter((type) => type.priority > 1 && Number(row[type.key]) > 0)
                  .map((type) => `${type.short} ${formatNumber(row[type.key])}`).join(" · ");
                return (
                  <li key={row.id} className="flex items-start justify-between gap-3 py-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold text-slate-900">{name.main}</p>
                      <p className="truncate text-xs text-slate-500">{name.sub}{critical ? ` · ${critical}` : ""}</p>
                    </div>
                    <span className="shrink-0 rounded-full bg-red-50 px-2.5 py-0.5 text-xs font-bold text-red-800 ring-1 ring-red-200">รอ {formatNumber(row.pending)} คน</span>
                  </li>
                );
              })}
            </ol>
          ) : <p className="mt-4 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">ทุกพื้นที่ได้รับการดูแลครบแล้ว</p>}
        </div>
      </div>

      {summary.districts.length ? (
        <div className="overflow-x-auto rounded-xl border border-[#c9dcee] bg-white">
          <table className="w-full min-w-[36rem] text-left text-sm">
            <caption className="px-5 pt-4 text-left text-base font-black text-slate-900">แยกตามอำเภอ</caption>
            <thead className="text-xs text-slate-500">
              <tr><th className="px-5 py-2">อำเภอ</th><th className="px-3 py-2 text-right">ได้รับผลกระทบ</th><th className="px-3 py-2 text-right">ดูแลแล้ว</th><th className="px-3 py-2 text-right">เคลื่อนย้าย</th><th className="px-3 py-2 text-right">ยังไม่ได้ดูแล</th><th className="w-40 px-5 py-2">ความคืบหน้าการดูแล</th></tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {summary.districts.map((row) => (
                <tr key={row.district}>
                  <td className="px-5 py-2.5 font-semibold text-slate-900">อ.{row.district}<span className="block text-xs font-normal text-slate-500">{formatNumber(row.villages)} พื้นที่</span></td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{formatNumber(row.affected)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-emerald-700">{formatNumber(row.cared)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-sky-800">{formatNumber(row.moved)}</td>
                  <td className={`px-3 py-2.5 text-right font-bold tabular-nums ${row.pending ? "text-red-700" : "text-slate-400"}`}>{formatNumber(row.pending)}</td>
                  <td className="px-5 py-2.5"><div className="flex items-center gap-2"><div className="flex-1"><Meter value={row.cared} max={row.affected} tone="bg-emerald-500" label={`ดูแลแล้ว อ.${row.district}`} /></div><span className="w-9 text-right text-xs tabular-nums text-slate-600">{row.caredPercent}%</span></div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </section>
  );
}

const registryKey = (row) => `${row.district}|${row.tambon}|${row.village || ""}`;

// หน้าต่างเลือกหมู่บ้านจากทะเบียน (เลือกได้หลายหมู่บ้าน)
function AddVillagesDialog({ open, onOpenChange, registry, taken, onSubmit, busy, error }) {
  const [district, setDistrict] = useState("");
  const [tambon, setTambon] = useState("");
  const [picked, setPicked] = useState(() => new Set());
  useEffect(() => { if (open) { setDistrict(""); setTambon(""); setPicked(new Set()); } }, [open]);

  const districts = useMemo(() => [...new Set(registry.map((row) => row.district))].sort((a, b) => a.localeCompare(b, "th")), [registry]);
  const tambons = useMemo(() => [...new Set(registry.filter((row) => row.district === district).map((row) => row.tambon))].sort((a, b) => a.localeCompare(b, "th")), [registry, district]);
  const villages = useMemo(() => registry.filter((row) => row.district === district && (!tambon || row.tambon === tambon))
    .sort((a, b) => `${a.tambon}${a.village || ""}`.localeCompare(`${b.tambon}${b.village || ""}`, "th")), [registry, district, tambon]);
  const selectable = villages.filter((row) => !taken.has(registryKey(row)));
  const toggle = (key) => setPicked((current) => { const next = new Set(current); if (next.has(key)) next.delete(key); else next.add(key); return next; });
  const pickedRows = registry.filter((row) => picked.has(registryKey(row)));
  const pickedTotal = pickedRows.reduce((sum, row) => sum + affectedOf(row), 0);

  return (
    <FormDialog
      open={open}
      onOpenChange={onOpenChange}
      title="เพิ่มหมู่บ้านที่ประสบภัย"
      description="เลือกจากทะเบียนกลุ่มเปราะบาง ระบบจะดึงจำนวนแต่ละประเภทมาให้"
      onSubmit={() => onSubmit(pickedRows.map((row) => ({ district: row.district, tambon: row.tambon, village: row.village || "" })))}
      busy={busy}
      error={error}
      submitText={picked.size ? `เพิ่ม ${picked.size} หมู่บ้าน (${formatNumber(pickedTotal)} คน)` : "เพิ่มหมู่บ้าน"}
    >
      <FormGrid>
        <Field label="อำเภอ" required>
          <select className={inputClass} value={district} onChange={(event) => { setDistrict(event.target.value); setTambon(""); }}>
            <option value="">เลือกอำเภอ</option>
            {districts.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <Field label="ตำบล">
          <select className={inputClass} value={tambon} disabled={!district} onChange={(event) => setTambon(event.target.value)}>
            <option value="">ทุกตำบล</option>
            {tambons.map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </Field>
        <div className="sm:col-span-2">
          {!district ? <p className="rounded-lg bg-slate-50 p-3 text-sm text-slate-600">เลือกอำเภอเพื่อดูหมู่บ้านในทะเบียน</p> : (
            <>
              <div className="mb-2 flex items-center justify-between text-sm">
                <span className="text-slate-600">{formatNumber(villages.length)} พื้นที่ในทะเบียน</span>
                {selectable.length ? (
                  <button type="button" className="font-bold text-[#0b4c86] hover:underline" onClick={() => setPicked((current) => new Set([...current, ...selectable.map(registryKey)]))}>เลือกทั้งหมดที่แสดง</button>
                ) : null}
              </div>
              <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto rounded-lg border border-slate-200">
                {villages.map((row) => {
                  const key = registryKey(row);
                  const already = taken.has(key);
                  return (
                    <li key={key}>
                      <label className={`flex items-center gap-3 px-3 py-2 text-sm ${already ? "text-slate-400" : "cursor-pointer hover:bg-slate-50"}`}>
                        <input type="checkbox" className="h-4 w-4 accent-[#0b4c86]" disabled={already} checked={already || picked.has(key)} onChange={() => toggle(key)} />
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold text-slate-900">{row.village || `ต.${row.tambon} (ทั้งตำบล)`}</span>
                          <span className="block text-xs text-slate-500">ต.{row.tambon}{already ? " · อยู่ในเหตุการณ์แล้ว" : ""}</span>
                        </span>
                        <span className="tabular-nums text-slate-700">{formatNumber(affectedOf(row))} คน</span>
                      </label>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          <p className="mt-2 text-xs text-slate-500">ไม่พบหมู่บ้าน? เพิ่มในทะเบียนกลางก่อน แล้วกลับมาเลือกที่นี่ <Link href="/eoc/vulnerable-groups" className="font-bold text-[#0b4c86] hover:underline">ไปทะเบียนกลาง</Link></p>
        </div>
      </FormGrid>
    </FormDialog>
  );
}

export default function EventVulnerableWorkspace({ eocType = "flood" }) {
  const { notice, success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [search, setSearch] = useState("");
  const [district, setDistrict] = useState("all");
  const [status, setStatus] = useState("all");
  const [adding, setAdding] = useState(false);
  const [editRow, setEditRow] = useState(null);
  const [statusForm, setStatusForm] = useState(EMPTY_STATUS);
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true }));
    try {
      setState({ loading: false, data: await apiRequest(`${API}?eoc=${eocType}`), error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, [eocType]);
  useEffect(() => { load(); }, [load]);

  const data = state.data;
  const session = data?.session;
  const perms = data?.permissions || {};
  const records = useMemo(() => data?.data || [], [data]);
  const registry = useMemo(() => data?.baseline || [], [data]);
  const taken = useMemo(() => new Set(records.map(registryKey)), [records]);
  const changedCount = records.filter((row) => row.registry_changed).length;

  const districts = useMemo(() => [...new Set(records.map((row) => row.district))].sort((a, b) => a.localeCompare(b, "th")), [records]);
  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return records.filter((row) => {
      if (district !== "all" && row.district !== district) return false;
      const pending = row.affected - Number(row.cared_count || 0);
      if (status === "pending" && pending <= 0) return false;
      if (status === "done" && pending > 0) return false;
      return !keyword || `${row.village || ""} ${row.tambon} ${row.district} ${row.needs || ""} ${row.moved_to || ""}`.toLowerCase().includes(keyword);
    });
  }, [records, search, district, status]);

  const run = async (request, after) => {
    setBusy(true);
    setFormError("");
    try {
      const json = await request();
      success(json.message || "บันทึกแล้ว");
      after?.();
      load();
    } catch (error) {
      setFormError(error.message);
      fail(error.message);
    } finally {
      setBusy(false);
    }
  };

  const addVillages = (areas) => {
    if (!areas.length) { setFormError("กรุณาเลือกหมู่บ้านอย่างน้อย 1 แห่ง"); return; }
    return run(() => apiRequest(API, { method: "POST", body: { action: "add", session_id: session.id, areas } }), () => setAdding(false));
  };
  const syncRegistry = () => run(() => apiRequest(API, { method: "POST", body: { action: "sync", session_id: session.id } }));

  const openEdit = (row) => {
    setFormError("");
    setStatusForm({ cared_count: row.cared_count || 0, moved_count: row.moved_count || 0, moved_to: row.moved_to || "", needs: row.needs || "", notes: row.notes || "" });
    setEditRow(row);
  };
  const saveStatus = () => {
    const invalid = validateEventRecord({ ...editRow, ...statusForm });
    if (invalid) { setFormError(invalid); return; }
    return run(() => apiRequest(API, { method: "PATCH", body: { id: editRow.id, ...statusForm } }), () => setEditRow(null));
  };
  const confirmDelete = (reason) => run(() => apiRequest(`${API}?id=${deleting.id}`, { method: "DELETE", body: { reason } }), () => setDeleting(null));

  const context = session ? `${getEocTypeLabel(eocType)} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null;
  const columns = [
    { key: "area", label: "พื้นที่", render: (row) => { const name = areaName(row); return <div><div className="font-semibold text-slate-900">{name.main}</div><div className="text-xs text-slate-500">{name.sub}</div></div>; } },
    { key: "affected", label: "กลุ่มเปราะบาง (จากทะเบียน)", className: "text-right", render: (row) => (
      <div><strong className="text-base tabular-nums">{formatNumber(row.affected)}</strong>
        {row.registry_changed ? <span className="ml-1 rounded bg-amber-100 px-1.5 py-0.5 text-[11px] font-bold text-amber-900" title="ทะเบียนถูกแก้ไขหลังเพิ่มหมู่บ้าน">ทะเบียนเปลี่ยน</span> : null}
        <div className="mt-0.5 text-xs text-slate-500">{VULNERABLE_TYPES.filter((type) => Number(row[type.key]) > 0).map((type) => `${type.short} ${row[type.key]}`).join(" · ") || "-"}</div></div>
    ) },
    { key: "cared_count", label: "ดูแลแล้ว", className: "text-right", render: (row) => (
      <div className="min-w-[6rem]"><span className="font-bold tabular-nums text-emerald-700">{formatNumber(row.cared_count)}</span>
        <div className="mt-1"><Meter value={Number(row.cared_count)} max={row.affected} tone="bg-emerald-500" label="ดูแลแล้ว" /></div></div>
    ) },
    { key: "moved_count", label: "เคลื่อนย้าย", className: "text-right", render: (row) => (
      <div><span className="font-bold tabular-nums text-sky-800">{formatNumber(row.moved_count)}</span>{row.moved_to ? <div className="text-xs text-slate-500">ไป {row.moved_to}</div> : null}</div>
    ) },
    { key: "pending", label: "ยังไม่ได้ดูแล", className: "text-right", render: (row) => {
      const pending = Math.max(row.affected - Number(row.cared_count || 0), 0);
      return <span className={`font-bold tabular-nums ${pending ? "text-red-700" : "text-slate-400"}`}>{formatNumber(pending)}</span>;
    } },
    { key: "needs", label: "ความต้องการ / หมายเหตุ", className: "max-w-[14rem] text-slate-600", mobile: false, render: (row) => (
      <span>{row.needs || "-"}{row.notes ? <span className="block text-xs text-slate-500">{row.notes}</span> : null}</span>
    ) },
    { key: "updated_at", label: "อัปเดต", render: (row) => <UpdatedAt value={row.care_updated_at || row.updated_at} /> }
  ];

  if (!state.loading && data && !session) {
    return <AdminPage title="กลุ่มเปราะบางในเหตุการณ์"><p className="rounded-xl border border-dashed border-slate-300 bg-white px-6 py-10 text-center text-sm text-slate-600">{data.message}</p></AdminPage>;
  }

  return (
    <AdminPage
      context={context}
      title="กลุ่มเปราะบางในเหตุการณ์"
      description="จำนวนแต่ละประเภทดึงจากทะเบียนกลาง เจ้าหน้าที่บันทึกการดูแล การเคลื่อนย้าย และความต้องการของแต่ละหมู่บ้าน"
      actions={perms.can_edit ? <AddButton onClick={() => { setFormError(""); setAdding(true); }}>เพิ่มหมู่บ้านที่ประสบภัย</AddButton> : null}
    >
      {notice}
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {data?.migration_needed ? (
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ฐานข้อมูลยังไม่มีช่องบันทึก &quot;ดูแลแล้ว / เคลื่อนย้ายแล้ว&quot; ให้ผู้ดูแลระบบรัน <code>npm run db:migrate</code> ก่อน</p>
      ) : null}
      {changedCount && perms.can_edit ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <span>ทะเบียนกลางถูกแก้ไขหลังเพิ่มหมู่บ้าน {formatNumber(changedCount)} พื้นที่ ตัวเลขในเหตุการณ์ยังเป็นค่าเดิม</span>
          <Button variant="secondary" className="min-h-9" disabled={busy} onClick={syncRegistry}><RefreshCw className="h-4 w-4" />อัปเดตจำนวนจากทะเบียน</Button>
        </div>
      ) : null}

      {data?.summary && records.length ? <Dashboard summary={data.summary} /> : null}

      {!state.loading && data && !records.length ? (
        <div className="rounded-xl border border-dashed border-[#c9dcee] bg-white px-6 py-10 text-center">
          <Users className="mx-auto h-10 w-10 text-slate-300" aria-hidden="true" />
          <h2 className="mt-3 text-lg font-black text-slate-900">ยังไม่มีหมู่บ้านที่ประสบภัยในเหตุการณ์นี้</h2>
          <p className="mx-auto mt-1 max-w-lg text-sm text-slate-600">
            เลือกหมู่บ้านที่ประสบภัยจากทะเบียน ระบบจะดึงจำนวนผู้สูงอายุ ติดเตียง พิการ เด็กเล็ก ตั้งครรภ์ และผู้ป่วยเรื้อรังมาให้ จากนั้นบันทึกการดูแลและการเคลื่อนย้ายได้ทุกวัน
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            {perms.can_edit ? <AddButton onClick={() => { setFormError(""); setAdding(true); }}>เลือกหมู่บ้านจากทะเบียน</AddButton> : null}
            <Link href="/eoc/vulnerable-groups" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">ดูทะเบียนกลาง</Link>
          </div>
        </div>
      ) : (
        <>
          <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาหมู่บ้าน ตำบล ความต้องการ">
            <FilterSelect label="อำเภอ" value={district} onChange={setDistrict} options={[{ value: "all", label: "ทุกอำเภอ" }, ...districts.map((name) => ({ value: name, label: `อ.${name}` }))]} />
            <FilterSelect label="สถานะการดูแล" value={status} onChange={setStatus} options={[{ value: "all", label: "ทุกสถานะ" }, { value: "pending", label: "ยังดูแลไม่ครบ" }, { value: "done", label: "ดูแลครบแล้ว" }]} />
          </Toolbar>
          <DataTable
            caption="กลุ่มเปราะบางรายหมู่บ้านในเหตุการณ์"
            loading={state.loading}
            rows={rows}
            columns={columns}
            emptyText="ไม่พบพื้นที่ตามเงื่อนไข"
            rowClassName={(row) => (row.affected - Number(row.cared_count || 0) > 0 ? "" : "bg-emerald-50/30")}
            rowActions={perms.can_update_care || perms.can_delete ? (row) => (
              <RowActions
                onEdit={perms.can_update_care ? () => openEdit(row) : undefined}
                editLabel="แก้ไขสถานะ"
                onDelete={perms.can_delete ? () => { setFormError(""); setDeleting(row); } : undefined}
                deleteLabel="นำออกจากเหตุการณ์"
              />
            ) : undefined}
          />
        </>
      )}

      <AddVillagesDialog open={adding} onOpenChange={setAdding} registry={registry} taken={taken} onSubmit={addVillages} busy={busy} error={formError} />

      <FormDialog
        open={Boolean(editRow)}
        onOpenChange={(open) => !open && setEditRow(null)}
        title={editRow ? `แก้ไขสถานะ: ${areaName(editRow).main}` : ""}
        description={editRow ? `${areaName(editRow).sub} · กลุ่มเปราะบาง ${formatNumber(editRow.affected)} คน (จากทะเบียน)` : ""}
        onSubmit={saveStatus}
        busy={busy}
        error={formError}
      >
        {editRow ? (
          <FormGrid>
            <div className="sm:col-span-2 flex flex-wrap gap-1.5">
              {VULNERABLE_TYPES.filter((type) => Number(editRow[type.key]) > 0).map((type) => (
                <span key={type.key} className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs text-slate-700">{type.label} <b>{formatNumber(editRow[type.key])}</b></span>
              ))}
            </div>
            <Field label="ดูแลแล้ว (คน)" hint={`ไม่เกิน ${formatNumber(editRow.affected)} คน`}>
              <input type="number" min={0} max={editRow.affected} className={inputClass} value={statusForm.cared_count} onChange={(event) => setStatusForm((current) => ({ ...current, cared_count: event.target.value }))} />
            </Field>
            <Field label="เคลื่อนย้ายแล้ว (คน)">
              <input type="number" min={0} max={editRow.affected} className={inputClass} value={statusForm.moved_count} onChange={(event) => setStatusForm((current) => ({ ...current, moved_count: event.target.value }))} />
            </Field>
            <Field label="เคลื่อนย้ายไปที่" wide hint="เช่น ศูนย์พักพิงโรงเรียน..., รพ.ละงู, บ้านญาติ">
              <input className={inputClass} value={statusForm.moved_to} onChange={(event) => setStatusForm((current) => ({ ...current, moved_to: event.target.value }))} />
            </Field>
            <Field label="ความต้องการเฉพาะ" wide hint="เช่น ต้องการรถเคลื่อนย้ายผู้ป่วยติดเตียง 2 ราย, ออกซิเจน">
              <textarea rows={2} className={inputClass} value={statusForm.needs} onChange={(event) => setStatusForm((current) => ({ ...current, needs: event.target.value }))} />
            </Field>
            <Field label="หมายเหตุ" wide>
              <textarea rows={2} className={inputClass} value={statusForm.notes} onChange={(event) => setStatusForm((current) => ({ ...current, notes: event.target.value }))} />
            </Field>
          </FormGrid>
        ) : null}
      </FormDialog>

      <DeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(null)}
        itemType="หมู่บ้านในเหตุการณ์"
        itemLabel={deleting ? `${areaName(deleting).main} ${areaName(deleting).sub}` : ""}
        note="นำออกจากเหตุการณ์เท่านั้น ทะเบียนกลางไม่เปลี่ยน"
        onConfirm={confirmDelete}
        busy={busy}
        error={formError}
      />
    </AdminPage>
  );
}
