"use client";

// รายงาน IT support ในเหตุการณ์: สถานะระบบ/อุปกรณ์ + เรื่องแจ้งปัญหาและการแก้ไข
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { AlertOctagon, CheckCircle2, Clock3, Eye, Server, TimerReset, Wrench } from "lucide-react";
import {
  AddButton, AdminPage, Button, DataTable, DeleteDialog, Field, FilterSelect, FormDialog, FormGrid, FormSection, RowActions,
  StatusPill, Tabs, Toolbar, UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import { useUrlState } from "@/components/admin/useUrlState";
import { apiRequest, formatDateTime, formatNumber } from "@/lib/adminApi";
import { getEocTypeLabel } from "@/lib/eocDisplay";
import { IT_CATEGORIES, IT_SEVERITIES, IT_STATUSES, RESOURCE_STATUSES, formatDuration } from "@/lib/itSupport";
import { sendOrQueue } from "@/lib/offlineQueue";
import { MetricCard, toneFromClass } from "@/components/common/MetricCards";

const API = "/stn-eoc/api/eoc/it-support";
const RESOURCE_TYPES = { server: "เซิร์ฟเวอร์", internet: "อินเทอร์เน็ต", network: "เครือข่าย", hardware: "ฮาร์ดแวร์" };

function localNow() {
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  return now.toISOString().slice(0, 16);
}

const EMPTY = {
  unit_name: "", it_resource_id: "", category: "internet", title: "", detail: "", severity: "medium", status: "open",
  assignee: "", workaround: "", resolution: "", reporter_name: "", reporter_phone: "", reported_at: ""
};

function Kpi({ icon, label, value, hint, tone = "text-slate-900" }) {
  return <MetricCard icon={icon} label={label} value={value} note={hint} tone={toneFromClass(tone)} compact />;
}

export default function ItSupportWorkspace({ eocType = "flood" }) {
  const { notice, success, fail } = useNotice();
  const [tab, setTab] = useUrlState("tab", "tickets", ["tickets", "resources"]);
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("active");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(EMPTY);
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
  const summary = data?.summary;
  const tickets = useMemo(() => data?.tickets || [], [data]);
  const resources = useMemo(() => data?.resources || [], [data]);

  const rows = useMemo(() => {
    const keyword = search.trim().toLowerCase();
    return tickets.filter((ticket) => {
      if (statusFilter === "active" && !["open", "in_progress"].includes(ticket.status)) return false;
      if (statusFilter === "done" && ["open", "in_progress"].includes(ticket.status)) return false;
      if (categoryFilter !== "all" && ticket.category !== categoryFilter) return false;
      return !keyword || `${ticket.ticket_no} ${ticket.title} ${ticket.unit_name} ${ticket.assignee || ""}`.toLowerCase().includes(keyword);
    });
  }, [tickets, search, statusFilter, categoryFilter]);

  const updateForm = (patch) => setForm((current) => ({ ...current, ...patch }));
  const openForm = (ticket = null, preset = {}) => {
    setFormError("");
    setEditing(ticket || {});
    setForm(ticket
      ? { ...EMPTY, ...Object.fromEntries(Object.keys(EMPTY).map((key) => [key, ticket[key] ?? EMPTY[key]])), reported_at: String(ticket.reported_at || "").slice(0, 16) }
      : { ...EMPTY, reported_at: localNow(), ...preset });
  };

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

  const save = () => run(
    () => (editing?.id
      ? apiRequest(API, { method: "PUT", body: { ...form, id: editing.id, session_id: session.id } })
      : sendOrQueue(API, { method: "POST", label: `แจ้งปัญหา IT: ${form.title}`, body: { ...form, session_id: session.id } })),
    () => setEditing(null)
  );
  const quickStatus = (ticket, status) => {
    if ((status === "resolved" || status === "closed") && !ticket.resolution) { openForm({ ...ticket, status }); return; }
    run(() => apiRequest(API, { method: "PUT", body: { ...ticket, status, session_id: session.id } }));
  };
  const setResourceStatus = (resource, status) => run(() => apiRequest(API, { method: "PATCH", body: { session_id: session.id, resource_id: resource.id, status } }));
  const confirmDelete = (reason) => run(() => apiRequest(`${API}?id=${deleting.id}`, { method: "DELETE", body: { reason } }), () => setDeleting(null));

  const context = session ? `${getEocTypeLabel(eocType)} ครั้งที่ ${session.session_number}${session.status === "active" ? "" : " (ปิดแล้ว)"}` : null;

  if (!state.loading && data && !session) {
    return <AdminPage title="รายงาน IT support"><p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">{data.message}</p></AdminPage>;
  }

  const ticketColumns = [
    { key: "title", label: "เรื่อง", render: (row) => (
      <div className="min-w-[12rem]">
        <div className="font-semibold text-slate-900">{row.title}</div>
        <div className="text-xs text-slate-500">{row.ticket_no} · {IT_CATEGORIES[row.category]} · {row.unit_name}</div>
        {row.workaround && ["open", "in_progress"].includes(row.status) ? <div className="mt-0.5 text-xs text-amber-800">แก้ชั่วคราว: {row.workaround}</div> : null}
        {row.resolution && !["open", "in_progress"].includes(row.status) ? <div className="mt-0.5 text-xs text-emerald-800">แก้ไข: {row.resolution}</div> : null}
      </div>
    ) },
    { key: "severity", label: "ความรุนแรง", render: (row) => <StatusPill tone={IT_SEVERITIES[row.severity]?.tone}>{IT_SEVERITIES[row.severity]?.label}</StatusPill> },
    { key: "status", label: "สถานะ", render: (row) => <StatusPill tone={IT_STATUSES[row.status]?.tone}>{IT_STATUSES[row.status]?.label}</StatusPill> },
    { key: "assignee", label: "ผู้รับผิดชอบ", render: (row) => row.assignee || <span className="text-slate-400">ยังไม่มอบหมาย</span> },
    { key: "reported_at", label: "แจ้งเมื่อ", render: (row) => <span className="whitespace-nowrap">{formatDateTime(row.reported_at)}{row.resolved_at ? <span className="block text-xs text-slate-500">แก้เสร็จ {formatDateTime(row.resolved_at)}</span> : null}</span> }
  ];

  const resourceColumns = [
    { key: "unit_name", label: "หน่วยงาน", render: (row) => <div><div className="font-semibold text-slate-900">{row.unit_name}</div><div className="text-xs text-slate-500">{RESOURCE_TYPES[row.resource_type] || row.resource_type}{row.isp_provider ? ` · ${row.isp_provider}` : ""}{row.connection_type ? ` ${row.connection_type}` : ""}</div></div> },
    { key: "status", label: "สถานะ", render: (row) => <StatusPill tone={RESOURCE_STATUSES[row.status || "unknown"]?.tone}>{RESOURCE_STATUSES[row.status || "unknown"]?.label}</StatusPill> },
    { key: "last_check", label: "ตรวจล่าสุด", render: (row) => (row.last_check ? <UpdatedAt value={row.last_check} staleHours={6} /> : "-") },
    { key: "contact", label: "ผู้ดูแล", mobile: false, render: (row) => <span>{row.contact_person || "-"}{row.contact_phone ? <a href={`tel:${row.contact_phone}`} className="block text-xs font-semibold text-[#0b4c86] hover:underline">{row.contact_phone}</a> : null}</span> }
  ];

  return (
    <AdminPage
      context={context}
      title="รายงาน IT support"
      description="บันทึกปัญหาระบบ อินเทอร์เน็ต อุปกรณ์ และการสื่อสารระหว่างเหตุการณ์ พร้อมสถานะการแก้ไข เพื่อให้ศูนย์สั่งการใช้งานได้ต่อเนื่อง"
      actions={perms.can_edit ? <AddButton onClick={() => openForm()}>แจ้งปัญหา IT</AddButton> : null}
    >
      {notice}
      {state.error ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{state.error}</p> : null}
      {perms.read_only_message ? (
        <p className="flex items-center gap-2 rounded-xl border border-[#c9dcee] bg-[#edf5fc] px-4 py-3 text-sm text-[#083865]" role="status">
          <Eye className="h-4 w-4 shrink-0" aria-hidden="true" /> {perms.read_only_message}
        </p>
      ) : null}
      {data?.migration_needed ? <p className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">ยังไม่มีตารางรายงาน IT support ให้ผู้ดูแลระบบรัน <code>npm run db:migrate</code></p> : null}

      {summary ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Kpi icon={Wrench} label="ปัญหาที่ยังไม่แก้" value={formatNumber(summary.open)} hint={`ทั้งหมด ${formatNumber(summary.total)} เรื่อง`} tone={summary.open ? "text-[#0b4c86]" : "text-slate-900"} />
          <Kpi icon={AlertOctagon} label="วิกฤต / สูง ที่ยังเปิด" value={formatNumber(summary.critical)} tone={summary.critical ? "text-red-700" : "text-slate-900"} />
          <Kpi icon={CheckCircle2} label="แก้ไขแล้ววันนี้" value={formatNumber(summary.resolvedToday)} tone="text-emerald-700" />
          <Kpi icon={TimerReset} label="เวลาแก้ไขเฉลี่ย" value={formatDuration(summary.avgHoursToResolve)} />
          <Kpi icon={Clock3} label="เรื่องค้างนานสุด" value={formatDuration(summary.oldestOpenHours)} tone={summary.oldestOpenHours >= 12 ? "text-amber-700" : "text-slate-900"} />
          <Kpi icon={Server} label="ระบบ/อุปกรณ์ออฟไลน์" value={`${formatNumber(summary.resources.offline)} / ${formatNumber(summary.resources.total)}`} hint={summary.resources.maintenance ? `ซ่อมบำรุง ${summary.resources.maintenance}` : "จากทะเบียนทรัพยากร IT"} tone={summary.resources.offline ? "text-red-700" : "text-slate-900"} />
        </div>
      ) : null}

      {summary?.byCategory?.length || summary?.unitsWithProblems?.length ? (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900">ปัญหาแยกตามประเภท</h3>
            <ul className="mt-2 space-y-2">
              {summary.byCategory.map((row) => (
                <li key={row.key}>
                  <div className="flex justify-between text-sm"><span className="font-semibold text-slate-800">{row.label}</span><span className="tabular-nums text-slate-600">ยังเปิด <b className="text-slate-900">{row.open}</b> / {row.total}</span></div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-slate-100"><div className="h-full rounded-full bg-[#0b4c86]" style={{ width: `${(row.total / Math.max(1, summary.total)) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <h3 className="text-sm font-black text-slate-900">หน่วยงานที่ยังมีปัญหา</h3>
            {summary.unitsWithProblems.length ? (
              <ul className="mt-2 flex flex-wrap gap-1.5">
                {summary.unitsWithProblems.map((unit) => (
                  <li key={unit}><button type="button" onClick={() => { setTab("tickets"); setStatusFilter("active"); setSearch(unit); }} className="rounded-full bg-red-50 px-3 py-1 text-sm font-semibold text-red-800 ring-1 ring-red-200 hover:bg-red-100">{unit}</button></li>
                ))}
              </ul>
            ) : <p className="mt-2 rounded-lg bg-emerald-50 p-3 text-sm font-semibold text-emerald-800">ไม่มีปัญหาค้าง</p>}
          </div>
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white px-2">
        <Tabs value={tab} onChange={setTab} items={[
          { value: "tickets", label: "เรื่องแจ้งปัญหา", count: summary?.open },
          { value: "resources", label: "สถานะระบบและอุปกรณ์", count: summary?.resources?.offline || undefined }
        ]} />
      </div>

      {tab === "resources" ? (
        <>
          <DataTable
            caption="สถานะทรัพยากร IT"
            loading={state.loading}
            rows={resources}
            columns={resourceColumns}
            emptyText="ยังไม่มีทรัพยากร IT ในทะเบียน"
            emptyAction={<Link href="/admin/it-resources" className="text-sm font-bold text-[#0b4c86] hover:underline">ไปทะเบียนทรัพยากร IT</Link>}
            rowClassName={(row) => (row.status === "offline" ? "bg-red-50/40" : "")}
            rowActions={perms.can_edit ? (row) => (
              <div className="flex flex-wrap justify-end gap-1">
                {row.status !== "online" ? <Button variant="secondary" className="min-h-9 px-2.5" onClick={() => setResourceStatus(row, "online")}>ใช้งานได้</Button> : null}
                {row.status !== "offline" ? <Button variant="secondary" className="min-h-9 px-2.5" onClick={() => setResourceStatus(row, "offline")}>ขัดข้อง</Button> : null}
                <Button className="min-h-9 px-2.5" onClick={() => { setTab("tickets"); openForm(null, { unit_name: row.unit_name, it_resource_id: row.id, category: ["server", "internet", "network", "hardware"].includes(row.resource_type) ? row.resource_type : "other" }); }}>แจ้งปัญหา</Button>
              </div>
            ) : undefined}
          />
          <p className="text-xs text-slate-500">เพิ่มหรือแก้ข้อมูลทรัพยากร IT ได้ที่ <Link href="/admin/it-resources" className="font-bold text-[#0b4c86] hover:underline">ทะเบียนทรัพยากร IT</Link></p>
        </>
      ) : (
        <>
          <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาเลขที่ หัวข้อ หน่วยงาน ผู้รับผิดชอบ">
            <FilterSelect label="สถานะ" value={statusFilter} onChange={setStatusFilter} options={[{ value: "active", label: "ยังไม่แก้" }, { value: "done", label: "แก้ไขแล้ว/ปิด" }, { value: "all", label: "ทั้งหมด" }]} />
            <FilterSelect label="ประเภท" value={categoryFilter} onChange={setCategoryFilter} options={[{ value: "all", label: "ทุกประเภท" }, ...Object.entries(IT_CATEGORIES).map(([value, label]) => ({ value, label }))]} />
          </Toolbar>
          <DataTable
            caption="เรื่องแจ้งปัญหา IT"
            loading={state.loading}
            rows={rows}
            columns={ticketColumns}
            emptyText={tickets.length ? "ไม่พบเรื่องตามเงื่อนไข" : "ยังไม่มีการแจ้งปัญหา IT ในเหตุการณ์นี้"}
            emptyAction={!tickets.length && perms.can_edit ? <AddButton onClick={() => openForm()}>แจ้งปัญหาแรก</AddButton> : null}
            rowClassName={(row) => (row.severity === "critical" && ["open", "in_progress"].includes(row.status) ? "bg-red-50/40" : "")}
            rowActions={perms.can_edit || perms.can_delete ? (row) => (
              <RowActions onEdit={perms.can_edit ? () => openForm(row) : undefined} onDelete={perms.can_delete ? () => { setFormError(""); setDeleting(row); } : undefined}>
                {perms.can_edit && row.status === "open" ? <Button variant="secondary" className="min-h-9 px-2.5" onClick={() => quickStatus(row, "in_progress")}>รับเรื่อง</Button> : null}
                {perms.can_edit && ["open", "in_progress"].includes(row.status) ? <Button className="min-h-9 px-2.5" onClick={() => quickStatus(row, "resolved")}>แก้ไขแล้ว</Button> : null}
              </RowActions>
            ) : undefined}
          />
        </>
      )}

      <FormDialog
        open={Boolean(editing)}
        onOpenChange={(open) => !open && setEditing(null)}
        title={editing?.id ? `แก้ไข ${editing.ticket_no}` : "แจ้งปัญหา IT"}
        description={context}
        onSubmit={save}
        busy={busy}
        error={formError}
      >
        <FormGrid>
          <FormSection title="ปัญหา">
            <Field label="หน่วยงาน/จุดที่เกิดปัญหา" required>
              <input required list="it-unit-options" className={inputClass} value={form.unit_name} placeholder="เช่น ศูนย์ EOC สสจ.สตูล, รพ.ละงู" onChange={(event) => {
                const match = resources.find((row) => row.unit_name === event.target.value);
                updateForm({ unit_name: event.target.value, it_resource_id: match ? match.id : form.it_resource_id });
              }} />
              <datalist id="it-unit-options">{[...new Set(resources.map((row) => row.unit_name))].map((name) => <option key={name} value={name} />)}</datalist>
            </Field>
            <Field label="ประเภท">
              <select className={inputClass} value={form.category} onChange={(event) => updateForm({ category: event.target.value })}>
                {Object.entries(IT_CATEGORIES).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
            </Field>
            <Field label="หัวข้อ" required wide>
              <input required className={inputClass} value={form.title} placeholder="เช่น อินเทอร์เน็ตห้องสั่งการใช้งานไม่ได้" onChange={(event) => updateForm({ title: event.target.value })} />
            </Field>
            <Field label="รายละเอียด" wide>
              <textarea rows={2} className={inputClass} value={form.detail || ""} onChange={(event) => updateForm({ detail: event.target.value })} />
            </Field>
            <Field label="ความรุนแรง" hint={IT_SEVERITIES[form.severity]?.hint}>
              <select className={inputClass} value={form.severity} onChange={(event) => updateForm({ severity: event.target.value })}>
                {Object.entries(IT_SEVERITIES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="วันเวลาที่แจ้ง">
              <input type="datetime-local" className={inputClass} value={form.reported_at} onChange={(event) => updateForm({ reported_at: event.target.value })} />
            </Field>
            <Field label="ผู้แจ้ง">
              <input className={inputClass} value={form.reporter_name || ""} placeholder="เว้นว่าง = ชื่อผู้บันทึก" onChange={(event) => updateForm({ reporter_name: event.target.value })} />
            </Field>
            <Field label="เบอร์ติดต่อผู้แจ้ง">
              <input type="tel" className={inputClass} value={form.reporter_phone || ""} onChange={(event) => updateForm({ reporter_phone: event.target.value })} />
            </Field>
          </FormSection>
          <FormSection title="การแก้ไข">
            <Field label="สถานะ">
              <select className={inputClass} value={form.status} onChange={(event) => updateForm({ status: event.target.value })}>
                {Object.entries(IT_STATUSES).map(([value, item]) => <option key={value} value={value}>{item.label}</option>)}
              </select>
            </Field>
            <Field label="ผู้รับผิดชอบ">
              <input className={inputClass} value={form.assignee || ""} placeholder="ชื่อเจ้าหน้าที่/ทีม IT" onChange={(event) => updateForm({ assignee: event.target.value })} />
            </Field>
            <Field label="การแก้ไขชั่วคราว" wide hint="เช่น ใช้ Pocket WiFi สำรอง, ย้ายเครื่องไปห้องข้าง">
              <textarea rows={2} className={inputClass} value={form.workaround || ""} onChange={(event) => updateForm({ workaround: event.target.value })} />
            </Field>
            <Field label="ผลการแก้ไข" wide required={form.status === "resolved" || form.status === "closed"}>
              <textarea rows={2} className={inputClass} value={form.resolution || ""} onChange={(event) => updateForm({ resolution: event.target.value })} />
            </Field>
          </FormSection>
        </FormGrid>
      </FormDialog>

      <DeleteDialog open={Boolean(deleting)} onOpenChange={(open) => !open && setDeleting(null)} itemType="เรื่องแจ้งปัญหา IT" itemLabel={deleting ? `${deleting.ticket_no} ${deleting.title}` : ""} onConfirm={confirmDelete} busy={busy} error={formError} />
    </AdminPage>
  );
}
