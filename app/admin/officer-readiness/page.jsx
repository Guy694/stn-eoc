"use client";

// แดชบอร์ดความพร้อมปฏิบัติหน้าที่ของเจ้าหน้าที่
// ดู: แอดมิน/ผู้บัญชาการ · เปลี่ยนสถานะแทน (ทีละคนหรือหลายคน): แอดมิน
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { History, Phone, RefreshCw } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import {
  AdminPage, Button, DataTable, FilterSelect, IconButton, StatStrip, StatusPill, Toolbar, inputClass, useNotice
} from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import ReadinessSlider from "@/components/readiness/ReadinessSlider";
import { useAuth } from "@/context/AuthContext";
import { apiRequest } from "@/lib/adminApi";
import {
  MAX_NOTE_LENGTH, READINESS_STATUSES, roleLabel, UNREPORTED, effectiveStatus, filterReadiness, isStale, readinessMeta,
  sortByUrgency, summarizeBy, summarizeReadiness
} from "@/lib/officerReadiness";

const API = "/stn-eoc/api/admin/officer-readiness";

function when(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toLocaleString("th-TH", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}
const fullName = (row) => [row.title, row.given_name].filter(Boolean).join("") + (row.family_name ? ` ${row.family_name}` : "") || row.username;

function StatusBadge({ row }) {
  const meta = readinessMeta(effectiveStatus(row));
  return <span className="inline-flex whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-bold" style={{ background: meta.bg, color: meta.color }}>{meta.label}</span>;
}

/** แถบสัดส่วนสถานะของกลุ่ม */
function GroupBar({ group }) {
  return (
    <div className="flex h-2 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
      {[...READINESS_STATUSES, UNREPORTED].map((item) => (group[item.value] ? (
        <span key={item.value} style={{ width: `${(group[item.value] / group.total) * 100}%`, background: item.value === "unreported" ? "#cbd5e1" : item.color }} />
      ) : null))}
    </div>
  );
}

export default function OfficerReadinessPage() {
  const { user } = useAuth();
  const { success, fail } = useNotice();
  const [state, setState] = useState({ loading: true, error: "", rows: [], canEdit: false });
  const [filters, setFilters] = useState({ search: "", status: "", role: "", department: "", staleOnly: false });
  const [groupBy, setGroupBy] = useState("role");
  const [selected, setSelected] = useState(() => new Set());
  const [bulk, setBulk] = useState(null); // { status, note }
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState(null); // { row, items }
  const [helpEdit, setHelpEdit] = useState(null); // { row, note } — แอดมินเลือก "ขอความช่วยเหลือ" ให้ ต้องใส่รายละเอียด

  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const json = await apiRequest(API);
      setState({ loading: false, error: "", rows: json.rows || [], canEdit: Boolean(json.canEdit) });
    } catch (error) {
      setState((current) => ({ ...current, loading: false, error: error.message }));
    }
  }, []);
  useEffect(() => { load(); }, [load]);
  // รีเฟรชอัตโนมัติทุก 1 นาที (เจ้าหน้าที่รายงานเข้ามาเรื่อย ๆ)
  useEffect(() => {
    const timer = setInterval(load, 60000);
    return () => clearInterval(timer);
  }, [load]);

  const rows = state.rows;
  const summary = useMemo(() => summarizeReadiness(rows), [rows]);
  const visible = useMemo(() => sortByUrgency(filterReadiness(rows, filters)), [rows, filters]);
  const roles = useMemo(() => [...new Set(rows.map((row) => row.role).filter(Boolean))].sort(), [rows]);
  const departments = useMemo(() => [...new Set(rows.map((row) => row.department).filter(Boolean))].sort((a, b) => a.localeCompare(b, "th")), [rows]);
  const groups = useMemo(() => summarizeBy(rows, groupBy, (value) => (groupBy === "role" ? roleLabel(value) : value || "ไม่ระบุหน่วยงาน")), [rows, groupBy]);
  const canEdit = state.canEdit && user?.role === "admin";
  const setFilter = (key, value) => setFilters((current) => ({ ...current, [key]: value }));

  const update = async (ids, status, note = "") => {
    setBusy(true);
    try {
      const json = await apiRequest(API, { method: "PUT", body: { officer_ids: ids, status, note } });
      success(json.message);
      setSelected(new Set());
      await load();
      return true;
    } catch (error) {
      fail(error.message);
      return false;
    } finally {
      setBusy(false);
    }
  };

  const changeOne = (row, status) => {
    if (status === "need_help") { setHelpEdit({ row, note: "" }); return; }
    update([row.id], status, "");
  };

  const openHistory = async (row) => {
    setHistory({ row, items: null });
    try {
      const json = await apiRequest(`${API}?history=${row.id}`);
      setHistory({ row, items: json.history || [] });
    } catch (error) {
      fail(error.message);
      setHistory(null);
    }
  };

  const statusCard = (item, value, extra = {}) => ({
    label: item.label,
    value,
    unit: "คน",
    tone: item.tone === "gray" ? undefined : item.tone,
    active: filters.status === item.value,
    onClick: () => setFilter("status", filters.status === item.value ? "" : item.value),
    ...extra
  });

  const columns = [
    {
      key: "name",
      label: "เจ้าหน้าที่",
      render: (row) => (
        <span className="block min-w-0">
          <span className="font-bold text-slate-900">{fullName(row)}</span>
          <span className="block text-xs font-normal text-slate-500">{[row.position, row.department].filter(Boolean).join(" · ") || row.username}</span>
        </span>
      )
    },
    { key: "role", label: "บทบาท/ทีม", render: (row) => <span className="text-sm text-slate-700">{roleLabel(row.role)}</span> },
    {
      key: "status",
      label: "สถานะ",
      render: (row) => (
        <span className="block min-w-[12rem]">
          {canEdit ? <ReadinessSlider size="sm" value={row.status || ""} onChange={(status) => changeOne(row, status)} disabled={busy} label={`สถานะของ ${fullName(row)}`} /> : <StatusBadge row={row} />}
          {row.note ? <span className="mt-1 block text-xs text-slate-600">“{row.note}”</span> : null}
        </span>
      )
    },
    {
      key: "updated",
      label: "อัปเดต",
      render: (row) => (row.updated_at ? (
        <span className={`block text-xs ${isStale(row.updated_at) ? "font-semibold text-amber-700" : "text-slate-500"}`}>
          {when(row.updated_at)}{isStale(row.updated_at) ? " (เกิน 24 ชม.)" : ""}
          <span className="block font-normal text-slate-500">{row.source === "admin" ? `แอดมินปรับ (${row.updated_by_username || "-"})` : "รายงานเอง"}</span>
        </span>
      ) : <span className="text-xs text-slate-400">ยังไม่รายงาน</span>)
    }
  ];

  return (
    <EOCLayout>
      <AdminPage
        title="สถานะความพร้อมเจ้าหน้าที่"
        description="ใครพร้อมมาปฏิบัติงาน ใครมาไม่ได้หรือต้องการความช่วยเหลือ — เจ้าหน้าที่รายงานเองจากเมนู “สถานะของฉัน”"
        actions={(
          <>
            <Link href="/eoc/readiness" className="inline-flex min-h-10 items-center rounded-lg px-3 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc]">สถานะของฉัน</Link>
            <Button variant="secondary" onClick={load} disabled={state.loading}><RefreshCw className={`h-4 w-4 ${state.loading ? "animate-spin" : ""}`} aria-hidden="true" /> รีเฟรช</Button>
          </>
        )}
      >
        {state.error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{state.error}</p> : null}

        <StatStrip
          items={[
            { label: "เจ้าหน้าที่ทั้งหมด", value: summary.total, unit: "คน", note: `รายงานแล้ว ${summary.reported} คน · พร้อม ${summary.readyPercent}%`, active: !filters.status, onClick: () => setFilter("status", "") },
            ...READINESS_STATUSES.map((item) => statusCard(item, summary.counts[item.value])),
            statusCard(UNREPORTED, summary.counts.unreported)
          ]}
        />
        {summary.stale ? (
          <button type="button" onClick={() => setFilter("staleOnly", !filters.staleOnly)} className="w-full rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-left text-sm text-amber-900 hover:bg-amber-100">
            {filters.staleOnly ? "กำลังแสดงเฉพาะ" : "มี"} {summary.stale} คนที่สถานะเก่ากว่า 24 ชั่วโมง {filters.staleOnly ? "· แตะเพื่อแสดงทั้งหมด" : "· แตะเพื่อดูรายชื่อ"}
          </button>
        ) : null}

        <section className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-black text-slate-900">สรุปราย{groupBy === "role" ? "บทบาท/ทีม" : "หน่วยงาน"}</h2>
            <div className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm font-bold" role="tablist" aria-label="สรุปตาม">
              {[["role", "บทบาท/ทีม"], ["department", "หน่วยงาน"]].map(([value, label]) => (
                <button key={value} type="button" role="tab" aria-selected={groupBy === value} onClick={() => setGroupBy(value)} className={`rounded-md px-3 py-1 ${groupBy === value ? "bg-white text-[#0b4c86] shadow-sm" : "text-slate-600"}`}>{label}</button>
              ))}
            </div>
          </div>
          {groups.length ? (
            <ul className="grid grid-cols-1 gap-x-6 gap-y-3 md:grid-cols-2 xl:grid-cols-3">
              {groups.slice(0, 12).map((group) => (
                <li key={group.name}>
                  <div className="mb-1 flex justify-between gap-2 text-sm">
                    <span className="min-w-0 truncate font-semibold text-slate-800" title={group.name}>{group.name}</span>
                    <span className="shrink-0 tabular-nums text-slate-600">พร้อม <strong className="text-emerald-700">{group.ready}</strong>/{group.total}{group.need_help ? <span className="ml-1 font-bold text-red-700">· ขอช่วยเหลือ {group.need_help}</span> : null}</span>
                  </div>
                  <GroupBar group={group} />
                </li>
              ))}
            </ul>
          ) : <p className="text-sm text-slate-500">ยังไม่มีข้อมูล</p>}
        </section>

        <Toolbar search={filters.search} onSearchChange={(value) => setFilter("search", value)} searchPlaceholder="ค้นหาชื่อ ชื่อผู้ใช้ ตำแหน่ง หน่วยงาน">
          <FilterSelect label="สถานะ" value={filters.status} onChange={(value) => setFilter("status", value)} options={[{ value: "", label: "ทุกสถานะ" }, ...READINESS_STATUSES.map((item) => ({ value: item.value, label: item.label })), { value: UNREPORTED.value, label: UNREPORTED.label }]} />
          <FilterSelect label="บทบาท/ทีม" value={filters.role} onChange={(value) => setFilter("role", value)} options={[{ value: "", label: "ทุกบทบาท/ทีม" }, ...roles.map((role) => ({ value: role, label: roleLabel(role) }))]} />
          <FilterSelect label="หน่วยงาน" value={filters.department} onChange={(value) => setFilter("department", value)} options={[{ value: "", label: "ทุกหน่วยงาน" }, ...departments.map((name) => ({ value: name, label: name }))]} />
        </Toolbar>

        {canEdit && selected.size ? (
          <div className="sticky top-2 z-20 flex flex-col gap-2 rounded-xl border border-[#c9dcee] bg-[#edf5fc] p-3 shadow-sm sm:flex-row sm:items-center">
            <span className="text-sm font-bold text-[#083865]">เลือก {selected.size} คน — ปรับสถานะเป็น</span>
            <div className="flex flex-wrap gap-2">
              {READINESS_STATUSES.map((item) => (
                <Button key={item.value} variant="secondary" className="min-h-9 px-3" disabled={busy} onClick={() => setBulk({ status: item.value, note: "" })}>{item.short}</Button>
              ))}
              <Button variant="ghost" className="min-h-9 px-3" onClick={() => setSelected(new Set())}>ยกเลิกที่เลือก</Button>
            </div>
          </div>
        ) : null}

        <DataTable
          columns={columns}
          rows={visible}
          loading={state.loading}
          pageSize={25}
          pageSizeOptions={[25, 50, 100]}
          caption="สถานะความพร้อมเจ้าหน้าที่"
          emptyText={rows.length ? "ไม่พบเจ้าหน้าที่ตามตัวกรอง" : "ยังไม่มีเจ้าหน้าที่"}
          rowClassName={(row) => (effectiveStatus(row) === "need_help" ? "bg-red-50/60" : "")}
          selection={canEdit ? {
            selected,
            onToggle: (row) => setSelected((current) => { const next = new Set(current); if (next.has(row.id)) next.delete(row.id); else next.add(row.id); return next; }),
            onTogglePage: (pageRows, checked) => setSelected((current) => { const next = new Set(current); pageRows.forEach((row) => (checked ? next.add(row.id) : next.delete(row.id))); return next; })
          } : undefined}
          rowActions={(row) => (
            <div className="flex items-center justify-end gap-0.5">
              {row.phone ? <a href={`tel:${String(row.phone).replace(/[^\d+]/g, "")}`} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-[#0b4c86] hover:bg-[#edf5fc]" aria-label={`โทรหา ${fullName(row)}`} title={`โทร ${row.phone}`}><Phone className="h-4 w-4" aria-hidden="true" /></a> : null}
              <IconButton icon={History} label={`ประวัติสถานะของ ${fullName(row)}`} onClick={() => openHistory(row)} />
            </div>
          )}
        />
        {!canEdit ? <p className="text-xs text-slate-500">ผู้บัญชาการดูได้อย่างเดียว · ผู้ดูแลระบบปรับสถานะแทนเจ้าหน้าที่ได้ (เช่น หลังโทรสอบถาม)</p> : null}
      </AdminPage>

      <AppDialog open={Boolean(bulk)} onOpenChange={(open) => { if (!open && !busy) setBulk(null); }} title={`ปรับสถานะ ${selected.size} คนเป็น “${readinessMeta(bulk?.status).label}”?`} description="บันทึกว่าแอดมินเป็นผู้ปรับ เจ้าหน้าที่เห็นในหน้าสถานะของตนเอง" busy={busy}>
        <label className="block">
          <span className="mb-1 block text-sm font-bold text-slate-800">หมายเหตุ {bulk?.status === "need_help" ? <span className="text-red-600">*</span> : "(ไม่บังคับ)"}</span>
          <input className={inputClass} maxLength={MAX_NOTE_LENGTH} value={bulk?.note || ""} onChange={(event) => setBulk((current) => ({ ...current, note: event.target.value }))} placeholder="เช่น โทรสอบถามแล้ว 22 ต.ค. 9:00" />
        </label>
        <AppDialogActions>
          <AppDialogCancel disabled={busy} />
          <Button disabled={busy || (bulk?.status === "need_help" && (bulk?.note || "").trim().length < 3)} onClick={async () => { if (await update([...selected], bulk.status, bulk.note)) setBulk(null); }}>{busy ? "กำลังบันทึก…" : "ปรับสถานะ"}</Button>
        </AppDialogActions>
      </AppDialog>

      <AppDialog open={Boolean(helpEdit)} onOpenChange={(open) => { if (!open && !busy) setHelpEdit(null); }} title={`${helpEdit ? fullName(helpEdit.row) : ""} ต้องการความช่วยเหลือ`} description="ระบุสั้น ๆ ว่าต้องการความช่วยเหลือเรื่องอะไร ระบบแจ้ง Telegram กลุ่มเจ้าหน้าที่และผู้ดูแลระบบ" busy={busy}>
        <textarea rows={3} maxLength={MAX_NOTE_LENGTH} className={inputClass} value={helpEdit?.note || ""} onChange={(event) => setHelpEdit((current) => ({ ...current, note: event.target.value }))} placeholder="เช่น น้ำท่วมบ้าน ติดอยู่ในบ้าน" />
        <AppDialogActions>
          <AppDialogCancel disabled={busy} />
          <Button variant="danger" disabled={busy || (helpEdit?.note || "").trim().length < 3} onClick={async () => { if (await update([helpEdit.row.id], "need_help", helpEdit.note)) setHelpEdit(null); }}>บันทึก</Button>
        </AppDialogActions>
      </AppDialog>

      <AppDialog open={Boolean(history)} onOpenChange={(open) => { if (!open) setHistory(null); }} title={`ประวัติสถานะ ${history ? fullName(history.row) : ""}`} size="md">
        {!history?.items ? <p className="text-sm text-slate-500">กำลังโหลด…</p> : history.items.length ? (
          <ol className="space-y-2">
            {history.items.map((item, index) => (
              <li key={`${item.created_at}-${index}`} className="flex items-start gap-3 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <StatusBadge row={{ status: item.status }} />
                <span className="min-w-0 flex-1">
                  <span className="block text-xs text-slate-500">{when(item.created_at)} · {item.source === "admin" ? `แอดมิน (${item.updated_by_username || "-"})` : "รายงานเอง"}</span>
                  {item.note ? <span className="block text-slate-700">{item.note}</span> : null}
                </span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-slate-500">ยังไม่เคยรายงานสถานะ</p>}
        <div className="mt-3"><StatusPill tone="gray">เก็บประวัติทุกครั้งที่เปลี่ยนสถานะ</StatusPill></div>
      </AppDialog>
    </EOCLayout>
  );
}
