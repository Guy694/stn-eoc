"use client";

// เปิด/ปิด EOC: การ์ดต่อประเภทเหตุการณ์ บอกสถานะ ผู้สั่งเปิด เวลา และคำสั่งแนบ
// การตั้งค่า "ประเภทเหตุการณ์" แยกไปอีกแท็บ (ไม่ปนกับงานเปิด/ปิดที่ต้องทำเร็ว)
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FileText, Power, PowerOff } from "lucide-react";
import { useEOC } from "@/context/EOCContext";
import {
  AddButton, AdminPage, Button, DataTable, Field, FormDialog, FormGrid, RowActions, StatusPill, Tabs, inputClass, useNotice
} from "@/components/admin/crud";
import AppDialog, { AppDialogActions, AppDialogCancel } from "@/components/ui/app-dialog";
import { apiRequest, formatDateTime, formatRelative } from "@/lib/adminApi";
import { useUrlState } from "@/components/admin/useUrlState";

const TYPES_API = "/stn-eoc/api/admin/eoc-types";
const OPERATIONS_PATH = { flood: "/eoc/flood/overview", disease: "/eoc/disease/overview", "festival-accidents": "/eoc/festival-accidents" };
const EMPTY_TYPE = { id: "", name_th: "", name_en: "", description: "", icon: "alert", color_primary: "gray", color_gradient: "from-slate-500 to-slate-600" };

export function toDateTimeLocal(value = new Date()) {
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  date.setMinutes(date.getMinutes() - date.getTimezoneOffset());
  return date.toISOString().slice(0, 16);
}

function fileUrl(path) {
  if (!path) return "";
  return path.startsWith("/stn-eoc") ? path : `/stn-eoc${path}`;
}

export default function EocControlWorkspace() {
  const { eocStatus, toggleEOC, refreshStatus } = useEOC();
  const [tab, setTab] = useUrlState("tab", "status", ["status", "types"]);
  const [types, setTypes] = useState([]);
  const [diseases, setDiseases] = useState([]);
  const [loading, setLoading] = useState(true);
  const { notice, success, fail } = useNotice();

  const loadTypes = useCallback(async () => {
    setLoading(true);
    try {
      const json = await apiRequest(TYPES_API);
      setTypes(json.data || []);
    } catch (error) {
      fail(error.message);
    } finally {
      setLoading(false);
    }
  }, [fail]);

  useEffect(() => {
    loadTypes();
    apiRequest("/stn-eoc/api/common/diseases").then((json) => setDiseases(json.data || [])).catch(() => setDiseases([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cards = useMemo(() => types.map((type) => ({ ...type, status: eocStatus?.[type.id] || {} })), [eocStatus, types]);
  const openCount = cards.filter((card) => card.status.is_active).length;

  // ---------- เปิด EOC ----------
  const [opening, setOpening] = useState(null);
  const [openForm, setOpenForm] = useState({});
  const [closing, setClosing] = useState(null);
  const [closeForm, setCloseForm] = useState({});
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");

  const startOpen = (card) => {
    setOpening(card);
    setOpenForm({ openedAt: toDateTimeLocal(), description: "", festivalType: card.id === "festival-accidents" ? "newyear" : "", diseaseId: "", customDiseaseName: "", orderFile: null });
    setFormError("");
  };
  const submitOpen = async () => {
    if (!openForm.openedAt) return setFormError("กรุณาระบุวันและเวลาที่เปิด EOC");
    if (opening.id === "disease") {
      if (!openForm.diseaseId) return setFormError("กรุณาเลือกโรคที่เปิด EOC เพื่อติดตาม");
      if (openForm.diseaseId === "__custom__" && !openForm.customDiseaseName.trim()) return setFormError("กรุณาระบุชื่อโรค");
    }
    if (openForm.description.trim().length < 5) return setFormError("กรุณาระบุเหตุผล/สถานการณ์ที่ต้องเปิด EOC");
    setBusy(true);
    try {
      const result = await toggleEOC(opening.id, true, openForm.description.trim(), openForm.festivalType || null, {
        openedAt: openForm.openedAt,
        diseaseId: opening.id === "disease" && openForm.diseaseId !== "__custom__" ? openForm.diseaseId : null,
        diseaseName: opening.id === "disease" && openForm.diseaseId === "__custom__" ? openForm.customDiseaseName.trim() : null,
        orderFile: openForm.orderFile
      });
      if (!result.success) throw new Error(result.message);
      success(result.message || `เปิด EOC ${opening.name_th} แล้ว`);
      setOpening(null);
      refreshStatus();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- ปิด EOC ----------
  const startClose = (card) => {
    const openedAt = toDateTimeLocal(card.status.activated_at || new Date());
    const now = toDateTimeLocal();
    setClosing(card);
    setCloseForm({ closedAt: now >= openedAt ? now : openedAt, description: "" });
    setFormError("");
  };
  const submitClose = async () => {
    if (!closeForm.closedAt) return setFormError("กรุณาระบุวันและเวลาที่ปิด EOC");
    if (closeForm.description.trim().length < 5) return setFormError("กรุณาสรุปสถานการณ์/เหตุผลก่อนปิด EOC เพื่อบันทึกไว้ในประวัติเหตุการณ์");
    setBusy(true);
    try {
      const result = await toggleEOC(closing.id, false, closeForm.description.trim(), null, { closedAt: closeForm.closedAt });
      if (!result.success) throw new Error(result.message);
      success(result.message || `ปิด EOC ${closing.name_th} แล้ว`);
      setClosing(null);
      refreshStatus();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };

  // ---------- ประเภทเหตุการณ์ ----------
  const [editingType, setEditingType] = useState(null);
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);
  const [deletingType, setDeletingType] = useState(null);
  const startEditType = (row = null) => {
    setEditingType(row || {});
    setTypeForm(row ? { ...EMPTY_TYPE, ...Object.fromEntries(Object.keys(EMPTY_TYPE).map((key) => [key, row[key] ?? EMPTY_TYPE[key]])) } : EMPTY_TYPE);
    setFormError("");
  };
  const saveType = async () => {
    if (!editingType?.id && !/^[a-z0-9-]{2,40}$/.test(typeForm.id)) return setFormError("รหัสใช้ได้เฉพาะ a-z, 0-9 และ - (2–40 ตัวอักษร) เช่น landslide");
    if (!typeForm.name_th.trim() || !typeForm.name_en.trim()) return setFormError("กรุณาระบุชื่อภาษาไทยและภาษาอังกฤษ");
    setBusy(true);
    try {
      // ไม่ส่ง is_active เด็ดขาด: คอลัมน์นี้คือสถานะเปิด/ปิด EOC
      const body = { id: editingType?.id || typeForm.id, name_th: typeForm.name_th.trim(), name_en: typeForm.name_en.trim(), description: typeForm.description, icon: typeForm.icon, color_primary: typeForm.color_primary, color_gradient: typeForm.color_gradient };
      await apiRequest(TYPES_API, { method: editingType?.id ? "PUT" : "POST", body });
      success(editingType?.id ? "บันทึกประเภทเหตุการณ์แล้ว" : "เพิ่มประเภทเหตุการณ์แล้ว");
      setEditingType(null);
      loadTypes();
      refreshStatus();
    } catch (error) {
      setFormError(error.message);
    } finally {
      setBusy(false);
    }
  };
  const deleteType = async () => {
    setBusy(true);
    try {
      await apiRequest(`${TYPES_API}?id=${encodeURIComponent(deletingType.id)}`, { method: "DELETE" });
      success(`ลบประเภท ${deletingType.name_th} แล้ว`);
      setDeletingType(null);
      loadTypes();
    } catch (error) {
      fail(error.message);
      setDeletingType(null);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminPage
      context="บริหารระบบ"
      title="เปิด/ปิด EOC"
      description="เปิดศูนย์ปฏิบัติการเมื่อมีคำสั่ง ระบบจะเริ่มรอบเหตุการณ์ใหม่ เปิดเมนูกรอกข้อมูลให้ทีม และเปิดปุ่มขอความช่วยเหลือบนหน้าเว็บประชาชน"
      actions={tab === "types" ? <AddButton onClick={() => startEditType()}>เพิ่มประเภทเหตุการณ์</AddButton> : (
        <Link href="/admin/eoc-sessions" className="inline-flex min-h-10 items-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50">ประวัติเหตุการณ์</Link>
      )}
    >
      <Tabs value={tab} onChange={setTab} items={[
        { value: "status", label: "สถานะเหตุการณ์", count: openCount },
        { value: "types", label: "ประเภทเหตุการณ์", count: types.length }
      ]} />

      {tab === "status" ? (
        loading && !cards.length ? <div className="h-40 animate-pulse rounded-xl bg-white" /> : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {cards.map((card) => {
              const active = Boolean(card.status.is_active);
              return (
                <article key={card.id} className={`flex flex-col rounded-2xl border bg-white p-5 ${active ? "border-emerald-300 ring-1 ring-emerald-200" : "border-slate-200"}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-lg font-black text-slate-900">{card.name_th}</h2>
                      <p className="text-xs text-slate-500">{card.name_en}</p>
                    </div>
                    {active ? <StatusPill tone="green">เปิดอยู่{card.status.session_number ? ` • ครั้งที่ ${card.status.session_number}` : ""}</StatusPill> : <StatusPill>ปิด</StatusPill>}
                  </div>

                  <dl className="mt-4 flex-1 space-y-2 text-sm">
                    {active ? (
                      <>
                        {card.status.disease_name ? <div><dt className="text-xs text-slate-500">โรคที่ติดตาม</dt><dd className="font-semibold">{card.status.disease_name}</dd></div> : null}
                        <div><dt className="text-xs text-slate-500">เปิดเมื่อ</dt><dd className="font-semibold">{formatDateTime(card.status.activated_at)} <span className="font-normal text-slate-500">({formatRelative(card.status.activated_at)})</span></dd></div>
                        {card.status.activated_by_name ? <div><dt className="text-xs text-slate-500">ผู้สั่งเปิด</dt><dd>{card.status.activated_by_name}</dd></div> : null}
                        {card.status.description ? <div><dt className="text-xs text-slate-500">เหตุผล</dt><dd className="line-clamp-3 text-slate-700">{card.status.description}</dd></div> : null}
                        {card.status.open_order_file_path ? (
                          <a href={fileUrl(card.status.open_order_file_path)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-[#0b4c86] hover:underline">
                            <FileText className="h-4 w-4" aria-hidden="true" /> {card.status.open_order_file_name || "คำสั่งเปิด EOC"}
                          </a>
                        ) : null}
                      </>
                    ) : (
                      <div><dt className="text-xs text-slate-500">ปิดล่าสุด</dt><dd>{card.status.deactivated_at ? formatDateTime(card.status.deactivated_at) : "ยังไม่เคยเปิด"}</dd></div>
                    )}
                  </dl>

                  <div className="mt-4 flex flex-wrap gap-2 border-t border-slate-100 pt-4">
                    {active ? (
                      <>
                        {OPERATIONS_PATH[card.id] ? <Link href={OPERATIONS_PATH[card.id]} className="inline-flex min-h-10 flex-1 items-center justify-center rounded-lg bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white hover:bg-[#083865]">ไปหน้าปฏิบัติการ</Link> : null}
                        <Button variant="secondary" className="border-red-300 text-red-700 hover:bg-red-50" onClick={() => startClose(card)}><PowerOff className="h-4 w-4" aria-hidden="true" /> ปิด EOC</Button>
                      </>
                    ) : (
                      <Button className="flex-1" onClick={() => startOpen(card)}><Power className="h-4 w-4" aria-hidden="true" /> เปิด EOC</Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )
      ) : (
        <DataTable
          caption="ประเภทเหตุการณ์"
          loading={loading}
          rows={types}
          emptyText="ยังไม่มีประเภทเหตุการณ์"
          columns={[
            { key: "name_th", label: "ชื่อ", render: (row) => (<div><div className="font-semibold text-slate-900">{row.name_th}</div><div className="text-xs text-slate-500">{row.name_en}</div></div>) },
            { key: "id", label: "รหัส", render: (row) => <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">{row.id}</code> },
            { key: "description", label: "คำอธิบาย", className: "max-w-md text-slate-600", render: (row) => row.description || "-" },
            { key: "state", label: "สถานะ", render: (row) => (eocStatus?.[row.id]?.is_active ? <StatusPill tone="green">เปิดอยู่</StatusPill> : <StatusPill>ปิด</StatusPill>) }
          ]}
          rowActions={(row) => <RowActions onEdit={() => startEditType(row)} onDelete={eocStatus?.[row.id]?.is_active ? undefined : () => setDeletingType(row)} />}
        />
      )}

      {/* ฟอร์มเปิด EOC */}
      <FormDialog open={Boolean(opening)} onOpenChange={(value) => !value && setOpening(null)} title={`เปิด EOC ${opening?.name_th || ""}`}
        description="ข้อมูลนี้บันทึกเป็นประวัติเหตุการณ์ และแสดงในภาพรวมสถานการณ์" onSubmit={submitOpen} busy={busy} error={formError} submitText="ยืนยันเปิด EOC">
        <FormGrid>
          <Field label="วันและเวลาที่เปิด" required>
            <input type="datetime-local" className={inputClass} value={openForm.openedAt || ""} onChange={(event) => setOpenForm((current) => ({ ...current, openedAt: event.target.value }))} />
          </Field>
          {opening?.id === "festival-accidents" ? (
            <Field label="เทศกาล" required>
              <select className={inputClass} value={openForm.festivalType} onChange={(event) => setOpenForm((current) => ({ ...current, festivalType: event.target.value }))}>
                <option value="newyear">ปีใหม่</option>
                <option value="songkran">สงกรานต์</option>
              </select>
            </Field>
          ) : null}
          {opening?.id === "disease" ? (
            <Field label="โรคที่ติดตาม" required>
              <select className={inputClass} value={openForm.diseaseId} onChange={(event) => setOpenForm((current) => ({ ...current, diseaseId: event.target.value }))}>
                <option value="">เลือกโรค/กลุ่มโรค</option>
                {diseases.map((disease) => <option key={disease.id || disease.name} value={disease.id}>{disease.name}</option>)}
                <option value="__custom__">อื่น ๆ (ระบุเอง)</option>
              </select>
              {openForm.diseaseId === "__custom__" ? (
                <input className={`${inputClass} mt-2`} placeholder="ชื่อโรคหรือกลุ่มโรค" value={openForm.customDiseaseName} onChange={(event) => setOpenForm((current) => ({ ...current, customDiseaseName: event.target.value }))} />
              ) : null}
            </Field>
          ) : null}
          <Field label="เหตุผล/สถานการณ์ที่ต้องเปิด" required wide hint="เช่น ฝนตกหนักต่อเนื่อง น้ำล้นตลิ่ง อ.ควนโดน ตามคำสั่ง นพ.สสจ.">
            <textarea rows={3} className={inputClass} value={openForm.description || ""} onChange={(event) => setOpenForm((current) => ({ ...current, description: event.target.value }))} />
          </Field>
          <Field label="ไฟล์คำสั่งเปิด EOC" wide hint="ไม่บังคับ • PDF, DOC, DOCX, JPG, PNG ไม่เกิน 20MB">
            <input type="file" accept=".pdf,.doc,.docx,.jpg,.jpeg,.png" className="block w-full text-sm text-slate-700 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:font-semibold"
              onChange={(event) => setOpenForm((current) => ({ ...current, orderFile: event.target.files?.[0] || null }))} />
          </Field>
        </FormGrid>
      </FormDialog>

      {/* ฟอร์มปิด EOC */}
      <FormDialog open={Boolean(closing)} onOpenChange={(value) => !value && setClosing(null)} title={`ปิด EOC ${closing?.name_th || ""}`}
        description={closing?.status?.activated_at ? `เปิดมาตั้งแต่ ${formatDateTime(closing.status.activated_at)}` : ""} onSubmit={submitClose} busy={busy} error={formError} submitText="ยืนยันปิด EOC" size="md">
        <div className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
          เมื่อปิดแล้ว ทีมจะกรอกข้อมูลของรอบนี้ไม่ได้ และถ้าไม่มีเหตุการณ์อื่นเปิดอยู่ ปุ่มขอความช่วยเหลือบนหน้าเว็บประชาชนจะปิดตาม
        </div>
        <FormGrid className="sm:grid-cols-1">
          <Field label="วันและเวลาที่ปิด" required>
            <input type="datetime-local" className={inputClass} value={closeForm.closedAt || ""} min={closing?.status?.activated_at ? toDateTimeLocal(closing.status.activated_at) : undefined}
              onChange={(event) => setCloseForm((current) => ({ ...current, closedAt: event.target.value }))} />
          </Field>
          <Field label="สรุปสถานการณ์/เหตุผลที่ปิด" required>
            <textarea rows={4} className={inputClass} value={closeForm.description || ""} onChange={(event) => setCloseForm((current) => ({ ...current, description: event.target.value }))} placeholder="เช่น ระดับน้ำลดลงทุกพื้นที่ ปิดศูนย์พักพิงครบแล้ว" />
          </Field>
        </FormGrid>
      </FormDialog>

      {/* ฟอร์มประเภทเหตุการณ์ */}
      <FormDialog open={Boolean(editingType)} onOpenChange={(value) => !value && setEditingType(null)} title={editingType?.id ? `แก้ไขประเภท ${editingType.name_th}` : "เพิ่มประเภทเหตุการณ์"}
        onSubmit={saveType} busy={busy} error={formError} size="md">
        <FormGrid>
          <Field label="ชื่อภาษาไทย" required><input className={inputClass} value={typeForm.name_th} onChange={(event) => setTypeForm((current) => ({ ...current, name_th: event.target.value }))} placeholder="ดินโคลนถล่ม" /></Field>
          <Field label="ชื่อภาษาอังกฤษ" required><input className={inputClass} value={typeForm.name_en} onChange={(event) => setTypeForm((current) => ({ ...current, name_en: event.target.value }))} placeholder="Landslide" /></Field>
          {!editingType?.id ? (
            <Field label="รหัส" required hint="ใช้ในระบบ เปลี่ยนภายหลังไม่ได้ • a-z, 0-9, -">
              <input className={inputClass} value={typeForm.id} onChange={(event) => setTypeForm((current) => ({ ...current, id: event.target.value.toLowerCase().trim() }))} placeholder="landslide" />
            </Field>
          ) : null}
          <Field label="คำอธิบาย" wide><textarea rows={2} className={inputClass} value={typeForm.description || ""} onChange={(event) => setTypeForm((current) => ({ ...current, description: event.target.value }))} /></Field>
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-sm font-semibold text-slate-600">การแสดงผล (ขั้นสูง)</summary>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              <Field label="ไอคอน"><input className={inputClass} value={typeForm.icon} onChange={(event) => setTypeForm((current) => ({ ...current, icon: event.target.value }))} /></Field>
              <Field label="สีหลัก"><input className={inputClass} value={typeForm.color_primary} onChange={(event) => setTypeForm((current) => ({ ...current, color_primary: event.target.value }))} /></Field>
              <Field label="ไล่สี"><input className={inputClass} value={typeForm.color_gradient} onChange={(event) => setTypeForm((current) => ({ ...current, color_gradient: event.target.value }))} /></Field>
            </div>
          </details>
        </FormGrid>
      </FormDialog>

      <AppDialog open={Boolean(deletingType)} onOpenChange={(value) => !value && setDeletingType(null)} title="ลบประเภทเหตุการณ์" size="sm" busy={busy}
        footer={(
          <AppDialogActions>
            <AppDialogCancel disabled={busy} />
            <Button variant="danger" onClick={deleteType} disabled={busy}>{busy ? "กำลังลบ…" : "ลบ"}</Button>
          </AppDialogActions>
        )}>
        <p className="text-sm text-slate-700">ลบประเภท <strong>{deletingType?.name_th}</strong> ลบได้เฉพาะประเภทที่ยังไม่เคยเปิด EOC (ถ้าเคยเปิดแล้ว ระบบจะไม่ให้ลบเพื่อเก็บประวัติ)</p>
      </AppDialog>
      {notice}
    </AdminPage>
  );
}
