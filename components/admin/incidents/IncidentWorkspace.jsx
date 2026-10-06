"use client";

// คำขอจากประชาชน: คัดกรอง → ดำเนินการ → ปิดเรื่อง (หนึ่งรายการ = หนึ่งเรื่องที่ต้องติดตาม)
import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Eye, Phone } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import {
  AdminPage, Button, DataTable, DeleteDialog, Field, FilterSelect, FormDialog, RowActions, StatusPill, Tabs, Toolbar, UpdatedAt, inputClass, useNotice
} from "@/components/admin/crud";
import { apiRequest, formatDateTime } from "@/lib/adminApi";
import { useUrlState } from "@/components/admin/useUrlState";

const API = "/stn-eoc/api/admin/incident-reports";
const EDITORS = ["admin", "commander", "MCATT", "SAT"];

export const INCIDENT_STATUSES = [
  { value: "pending", label: "รอตรวจสอบ", tone: "amber", hint: "ยังไม่มีใครรับเรื่อง" },
  { value: "reviewing", label: "กำลังดำเนินการ", tone: "blue", hint: "รับเรื่องแล้ว กำลังติดต่อ/ส่งทีม" },
  { value: "verified", label: "ยืนยันแล้ว", tone: "green", hint: "ตรวจสอบแล้วว่าเกิดเหตุจริง" },
  { value: "resolved", label: "ช่วยเหลือแล้ว", tone: "gray", hint: "ปิดเรื่อง" },
  { value: "rejected", label: "ไม่ดำเนินการ", tone: "red", hint: "ซ้ำ ข้อมูลไม่จริง หรือไม่อยู่ในพื้นที่" }
];
const statusMeta = (value) => INCIDENT_STATUSES.find((item) => item.value === value) || { label: value, tone: "gray" };

const URGENCY = {
  critical: { label: "วิกฤต", tone: "red" },
  high: { label: "สูง", tone: "amber" },
  medium: { label: "ปานกลาง", tone: "blue" },
  low: { label: "ต่ำ", tone: "gray" }
};
const URGENCY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };

function photoUrls(report) {
  const raw = report?.photo_path;
  if (!raw) return [];
  let list = [raw];
  if (typeof raw === "string" && raw.trim().startsWith("[")) {
    try { list = JSON.parse(raw); } catch { list = [raw]; }
  }
  return list.filter(Boolean).map((path) => (/^https?:\/\//.test(path) || path.startsWith("/stn-eoc/") ? path : `/stn-eoc${path.startsWith("/") ? "" : "/"}${path}`));
}

function areaText(report) {
  return [report.village && `บ.${report.village}`, report.sub_district && `ต.${report.sub_district}`, report.district && `อ.${report.district}`].filter(Boolean).join(" ") || "-";
}

export default function IncidentWorkspace() {
  const { user } = useAuth();
  const canEdit = EDITORS.includes(user?.role);
  const isAdmin = user?.role === "admin";
  const [status, setStatus] = useUrlState("status", "pending", ["pending", "reviewing", "verified", "resolved", "rejected", "all"]);
  const [rows, setRows] = useState([]);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [type, setType] = useState("all");
  const [urgency, setUrgency] = useState("all");
  const { notice, success } = useNotice();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "500" });
      if (status !== "all") params.set("status", status);
      const json = await apiRequest(`${API}?${params}`);
      setRows(json.data || []);
      setStats(json.stats || {});
      setLoadError("");
    } catch (error) {
      setLoadError(error.message);
    } finally {
      setLoading(false);
    }
  }, [status]);
  useEffect(() => { load(); }, [load]);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => (type === "all" || row.report_type === type) && (urgency === "all" || row.urgency === urgency))
      .filter((row) => !query || `${row.first_name} ${row.last_name} ${row.phone} ${areaText(row)} ${row.description}`.toLowerCase().includes(query))
      // งานค้าง: เร่งด่วนก่อน แล้วเก่าก่อน / สถานะอื่น: ล่าสุดก่อน
      .sort((a, b) => status === "pending"
        ? (URGENCY_ORDER[a.urgency] ?? 9) - (URGENCY_ORDER[b.urgency] ?? 9) || new Date(a.created_at) - new Date(b.created_at)
        : new Date(b.created_at) - new Date(a.created_at));
  }, [rows, search, status, type, urgency]);

  const totalAll = Object.values(stats).reduce((sum, value) => sum + Number(value || 0), 0);

  // รายละเอียด / เปลี่ยนสถานะ
  const [selected, setSelected] = useState(null);
  const [nextStatus, setNextStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [deleteError, setDeleteError] = useState("");

  const open = (row) => {
    setSelected(row);
    setNextStatus(row.status === "pending" ? "reviewing" : row.status);
    setNotes(row.admin_notes || "");
    setFormError("");
  };
  const save = async () => {
    if (nextStatus === "rejected" && notes.trim().length < 5) {
      setFormError("กรุณาระบุเหตุผลที่ไม่ดำเนินการในบันทึกเจ้าหน้าที่");
      return;
    }
    setBusy(true);
    try {
      await apiRequest(API, { method: "PUT", body: { reportId: selected.id, status: nextStatus, adminNotes: notes.trim() || null } });
      success(`อัปเดตเรื่องของ ${selected.first_name} เป็น "${statusMeta(nextStatus).label}" แล้ว`);
      setSelected(null);
      load();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const confirmDelete = async (reason) => {
    setBusy(true);
    try {
      const json = await apiRequest(`${API}?id=${deleting.id}`, { method: "DELETE", body: { reason } });
      success(json.message);
      setDeleting(null);
      load();
    } catch (error) {
      setDeleteError(error.message);
    } finally {
      setBusy(false);
    }
  };

  const photos = photoUrls(selected);

  return (
    <AdminPage
      context="งานรอดำเนินการ"
      title="คำขอจากประชาชน"
      description="คำขอความช่วยเหลือและรายงานสภาพเส้นทางที่ประชาชนส่งผ่านเว็บไซต์ รับเรื่อง → ดำเนินการ → ปิดเรื่อง ทุกการเปลี่ยนสถานะถูกบันทึกประวัติ"
    >
      <Tabs value={status} onChange={setStatus} items={[
        ...INCIDENT_STATUSES.map((item) => ({ value: item.value, label: item.label, count: Number(stats[item.value] || 0) })),
        { value: "all", label: "ทั้งหมด", count: totalAll }
      ]} />

      {loadError ? <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800" role="alert">{loadError}</p> : null}

      <Toolbar search={search} onSearchChange={setSearch} searchPlaceholder="ค้นหาชื่อ เบอร์โทร พื้นที่ รายละเอียด">
        <FilterSelect label="ประเภท" value={type} onChange={setType} options={[
          { value: "all", label: "ทุกประเภท" }, { value: "help_request", label: "ขอความช่วยเหลือ" }, { value: "traffic_report", label: "รายงานเส้นทาง" }
        ]} />
        <FilterSelect label="ความเร่งด่วน" value={urgency} onChange={setUrgency} options={[
          { value: "all", label: "ทุกระดับ" }, ...Object.entries(URGENCY).map(([value, item]) => ({ value, label: item.label }))
        ]} />
      </Toolbar>

      <DataTable
        caption="คำขอจากประชาชน"
        loading={loading}
        rows={filtered}
        emptyText={status === "pending" ? "ไม่มีเรื่องค้างตรวจสอบ" : "ไม่มีรายการในสถานะนี้"}
        columns={[
          { key: "who", label: "ผู้แจ้ง", render: (row) => (
            <div>
              <div className="font-semibold text-slate-900">{row.first_name} {row.last_name}</div>
              <a href={`tel:${row.phone}`} className="text-xs text-[#0b4c86] hover:underline">{row.phone}</a>
            </div>
          ) },
          { key: "what", label: "เรื่อง", className: "max-w-sm", render: (row) => (
            <div>
              <div className="text-xs font-semibold text-slate-500">{row.report_type === "traffic_report" ? "รายงานเส้นทาง" : "ขอความช่วยเหลือ"} • {areaText(row)}</div>
              <p className="line-clamp-2 whitespace-pre-line text-slate-700">{row.description}</p>
            </div>
          ) },
          { key: "urgency", label: "เร่งด่วน", render: (row) => <StatusPill tone={URGENCY[row.urgency]?.tone}>{URGENCY[row.urgency]?.label || row.urgency || "-"}</StatusPill> },
          { key: "status", label: "สถานะ", render: (row) => <StatusPill tone={statusMeta(row.status).tone}>{statusMeta(row.status).label}</StatusPill> },
          { key: "created_at", label: "แจ้งเมื่อ", render: (row) => <UpdatedAt value={row.created_at} staleHours={row.status === "pending" ? 2 : 24 * 365} /> }
        ]}
        rowActions={(row) => (
          <RowActions onDelete={isAdmin ? () => { setDeleteError(""); setDeleting(row); } : undefined}>
            <Button variant={row.status === "pending" && canEdit ? "primary" : "secondary"} className="min-h-9 px-3" onClick={() => open(row)}>
              <Eye className="h-4 w-4" aria-hidden="true" /> {row.status === "pending" && canEdit ? "รับเรื่อง" : "เปิดดู"}
            </Button>
          </RowActions>
        )}
      />

      <FormDialog
        open={Boolean(selected)}
        onOpenChange={(value) => !value && setSelected(null)}
        title={selected ? `${selected.report_type === "traffic_report" ? "รายงานเส้นทาง" : "คำขอความช่วยเหลือ"} #${selected.id}` : ""}
        description={selected ? `แจ้งเมื่อ ${formatDateTime(selected.created_at)}` : ""}
        onSubmit={save}
        busy={busy}
        error={formError}
        submitText="บันทึกสถานะ"
      >
        {selected ? (
          <div className="space-y-5">
            <section className="grid gap-3 sm:grid-cols-2">
              <div>
                <div className="text-xs text-slate-500">ผู้แจ้ง</div>
                <div className="font-bold text-slate-900">{selected.first_name} {selected.last_name}</div>
                <a href={`tel:${selected.phone}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#0b4c86] hover:underline"><Phone className="h-4 w-4" aria-hidden="true" /> โทร {selected.phone}</a>
              </div>
              <div>
                <div className="text-xs text-slate-500">พื้นที่</div>
                <div className="font-semibold text-slate-900">{areaText(selected)}</div>
                {selected.latitude && selected.longitude ? (
                  <a href={`https://www.google.com/maps?q=${selected.latitude},${selected.longitude}`} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-[#0b4c86] hover:underline">
                    <ExternalLink className="h-4 w-4" aria-hidden="true" /> เปิดแผนที่นำทาง
                  </a>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2 sm:col-span-2">
                <StatusPill tone={URGENCY[selected.urgency]?.tone}>ความเร่งด่วน: {URGENCY[selected.urgency]?.label || "-"}</StatusPill>
                {selected.affected_people ? <StatusPill>ผู้ได้รับผลกระทบ {selected.affected_people} คน</StatusPill> : null}
                {selected.water_level ? <StatusPill tone="blue">ระดับน้ำ {selected.water_level} ซม.</StatusPill> : null}
                {selected.occurred_at ? <StatusPill>เกิดเหตุ {formatDateTime(selected.occurred_at)}</StatusPill> : null}
              </div>
            </section>

            <section>
              <div className="text-xs text-slate-500">รายละเอียด</div>
              <p className="mt-1 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-800">{selected.description || "-"}</p>
            </section>

            {photos.length ? (
              <section className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-lg border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="รูปจากผู้แจ้ง" className="h-32 w-full object-cover" loading="lazy" />
                  </a>
                ))}
              </section>
            ) : null}

            {canEdit ? (
              <section className="space-y-3 border-t border-slate-200 pt-4">
                <fieldset>
                  <legend className="mb-2 text-sm font-bold text-slate-800">สถานะเรื่อง</legend>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {INCIDENT_STATUSES.map((item) => (
                      <label key={item.value} className={`flex cursor-pointer items-start gap-2 rounded-lg border p-2.5 text-sm ${nextStatus === item.value ? "border-[#0b4c86] bg-sky-50" : "border-slate-200 hover:bg-slate-50"}`}>
                        <input type="radio" name="incident-status" value={item.value} checked={nextStatus === item.value} onChange={() => setNextStatus(item.value)} className="mt-0.5" />
                        <span><span className="block font-bold text-slate-900">{item.label}</span><span className="block text-xs text-slate-500">{item.hint}</span></span>
                      </label>
                    ))}
                  </div>
                </fieldset>
                <Field label="บันทึกเจ้าหน้าที่" hint="เช่น ส่งทีม MCATT แล้ว 14:20 น. / ประสาน อบต. ส่งเรือ">
                  <textarea rows={3} className={inputClass} value={notes} onChange={(event) => setNotes(event.target.value)} />
                </Field>
                {selected.reviewed_at ? <p className="text-xs text-slate-500">อัปเดตสถานะล่าสุด {formatDateTime(selected.reviewed_at)}</p> : null}
              </section>
            ) : (
              <p className="text-sm text-slate-600">สถานะ: {statusMeta(selected.status).label}{selected.admin_notes ? ` • ${selected.admin_notes}` : ""}</p>
            )}
          </div>
        ) : null}
      </FormDialog>

      <DeleteDialog
        open={Boolean(deleting)}
        onOpenChange={(value) => !value && setDeleting(null)}
        itemType="คำขอจากประชาชน"
        itemLabel={deleting ? `#${deleting.id} ${deleting.first_name} ${deleting.last_name}` : ""}
        onConfirm={confirmDelete}
        busy={busy}
        error={deleteError}
        note="ถ้าเป็นเรื่องซ้ำหรือข้อมูลไม่จริง แนะนำเปลี่ยนสถานะเป็น “ไม่ดำเนินการ” แทนการลบ ส่วนการลบจะย้ายไปถังขยะ กู้คืนได้"
      />
      {notice}
    </AdminPage>
  );
}
