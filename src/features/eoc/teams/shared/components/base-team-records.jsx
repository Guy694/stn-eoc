"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOperationSessionLockByType } from "@/lib/eocSessionLock";
import { downloadCsv } from "@/lib/exportCsv";
import TeamPageShell from "../../../shared/components/team-page-shell";
import EmptyState from "../../../shared/components/empty-state";
import { getTeamReportDefinition } from "../../../registries/team-report-definition.registry";
import { getTeamMembers } from "../services/team-members.service";
import { createTeamReport, getTeamReports, reviewTeamReport, submitTeamReport, updateTeamReport } from "../services/team-reports.service";
import { showError, showSuccess } from "@/lib/sweetAlert";

const STATUS_LABELS = { draft: "ฉบับร่าง", submitted: "รอตรวจสอบ", verified: "ตรวจสอบแล้ว", approved: "อนุมัติแล้ว", returned: "ส่งกลับแก้ไข" };

function nowInputValue() {
  const date = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  return date.toISOString().slice(0, 16);
}

function emptyPayload(definition) {
  return Object.fromEntries(definition.fields.map((item) => [item.name, ""]));
}

export default function BaseTeamRecords({ eocType, teamCode }) {
  const definition = getTeamReportDefinition(teamCode);
  const [context, setContext] = useState(null);
  const [result, setResult] = useState(null);
  const [filters, setFilters] = useState({ search: "", status: "", dateFrom: "", dateTo: "" });
  const [appliedFilters, setAppliedFilters] = useState(filters);
  const [form, setForm] = useState({ title: "", reportDate: nowInputValue(), reportType: "periodic", payload: emptyPayload(definition) });
  const [editingId, setEditingId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const workflowPath = definition.existingWorkflow?.[eocType] || definition.existingWorkflow?.default;

  const loadReports = useCallback(async (resolvedContext = context) => {
    if (!resolvedContext) return;
    setLoading(true);
    try {
      const data = await getTeamReports(resolvedContext.session.id, resolvedContext.team.session_team_id, appliedFilters);
      setResult(data);
      setError("");
    } catch (loadError) { setError(loadError.message); }
    finally { setLoading(false); }
  }, [appliedFilters, context]);

  useEffect(() => {
    const controller = new AbortController();
    const moduleType = eocType === "dengue" ? "disease" : eocType;
    const querySessionId = new URLSearchParams(window.location.search).get("sessionId");
    const sessionId = querySessionId || getOperationSessionLockByType(moduleType)?.sessionId || null;
    getTeamMembers(eocType, teamCode, { sessionId, signal: controller.signal })
      .then((resolved) => { setContext(resolved); return getTeamReports(resolved.session.id, resolved.team.session_team_id, appliedFilters, { signal: controller.signal }); })
      .then((data) => { setResult(data); setError(""); })
      .catch((loadError) => { if (loadError.name !== "AbortError") setError(loadError.message); })
      .finally(() => setLoading(false));
    return () => controller.abort();
  }, [appliedFilters, eocType, teamCode]);

  const resetForm = () => {
    setForm({ title: "", reportDate: nowInputValue(), reportType: "periodic", payload: emptyPayload(definition) });
    setEditingId(null);
    setShowForm(false);
  };

  const saveReport = async (event) => {
    event.preventDefault();
    if (!context) return;
    setSaving(true); setError("");
    try {
      if (editingId) await updateTeamReport(context.session.id, context.team.session_team_id, editingId, form);
      else await createTeamReport(context.session.id, context.team.session_team_id, form);
      showSuccess(editingId ? "แก้ไขรายงานแล้ว" : "บันทึกร่างรายงานแล้ว");
      resetForm();
      await loadReports(context);
    } catch (saveError) { showError(saveError.message); }
    finally { setSaving(false); }
  };

  const editReport = (report) => {
    const date = new Date(report.report_date);
    setForm({ title: report.title, reportDate: Number.isNaN(date.getTime()) ? nowInputValue() : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16), reportType: report.report_type, payload: { ...emptyPayload(definition), ...report.payload } });
    setEditingId(report.id); setShowForm(true);
  };

  const runWorkflow = async (operation) => {
    try {
      const result = await operation();
      showSuccess(result.message || "ดำเนินการรายงานแล้ว");
      await loadReports(context);
    }
    catch (workflowError) { showError(workflowError.message); }
  };

  const exportRows = useMemo(() => (result?.data || []).map((report) => [report.id, report.report_date, report.title, STATUS_LABELS[report.status], report.created_by_name || "", report.updated_at || ""]), [result]);
  const exportCsv = () => downloadCsv([["ID", "วันรายงาน", "หัวข้อ", "สถานะ", "ผู้บันทึก", "อัปเดตล่าสุด"], ...exportRows], `team-${teamCode}-reports.csv`);

  return <TeamPageShell eocType={eocType} teamCode={teamCode} activeSection="records">
    <header className="border border-slate-200 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><h2 className="text-xl font-black text-slate-900">{definition.title}</h2><p className="mt-1 text-sm text-slate-600">{definition.purpose}{context ? ` · Session #${context.session.session_number}` : ""}</p></div><div className="flex gap-2">{workflowPath ? <Link href={workflowPath} className="border border-cyan-700 px-4 py-2 text-sm font-bold text-cyan-800">เปิดระบบปฏิบัติการเดิม</Link> : null}<button type="button" onClick={exportCsv} disabled={!exportRows.length} className="border border-slate-300 px-4 py-2 text-sm font-bold disabled:opacity-40">ส่งออก CSV</button>{result?.permissions.canWrite ? <button type="button" onClick={() => setShowForm(true)} className="bg-cyan-700 px-4 py-2 text-sm font-bold text-white">สร้างรายงาน</button> : null}</div></div>{context?.session.status === "closed" ? <p className="mt-3 border border-cyan-200 bg-cyan-50 p-3 text-sm text-cyan-900">Session ปิดแล้ว แต่ยังสามารถจัดทำ แก้ไข และส่งรายงานย้อนหลังได้</p> : null}</header>

    <form onSubmit={(event) => { event.preventDefault(); setAppliedFilters(filters); }} className="grid gap-3 bg-white p-4 shadow-sm md:grid-cols-5"><input value={filters.search} onChange={(e) => setFilters((v) => ({ ...v, search: e.target.value }))} placeholder="ค้นหาหัวข้อ/ผู้บันทึก" className="border border-slate-300 px-3 py-2 md:col-span-2"/><select value={filters.status} onChange={(e) => setFilters((v) => ({ ...v, status: e.target.value }))} className="border border-slate-300 px-3 py-2"><option value="">ทุกสถานะ</option>{Object.entries(STATUS_LABELS).map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select><input type="date" value={filters.dateFrom} onChange={(e) => setFilters((v) => ({ ...v, dateFrom: e.target.value }))} className="border border-slate-300 px-3 py-2"/><div className="flex gap-2"><input type="date" value={filters.dateTo} onChange={(e) => setFilters((v) => ({ ...v, dateTo: e.target.value }))} className="min-w-0 flex-1 border border-slate-300 px-2"/><button className="bg-slate-800 px-3 text-sm font-bold text-white">กรอง</button></div></form>

    {error ? <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{error}</div> : null}
    {showForm ? <form onSubmit={saveReport} className="space-y-4 border border-cyan-200 bg-white p-5 shadow-sm"><h3 className="text-lg font-black">{editingId ? "แก้ไขรายงาน" : "สร้างรายงานใหม่"}</h3><div className="grid gap-4 md:grid-cols-2"><label className="text-sm font-bold">หัวข้อรายงาน<input required value={form.title} onChange={(e) => setForm((v) => ({ ...v, title: e.target.value }))} className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal"/></label><label className="text-sm font-bold">วันเวลารายงาน<input type="datetime-local" required value={form.reportDate} onChange={(e) => setForm((v) => ({ ...v, reportDate: e.target.value }))} className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal"/></label>{definition.fields.map((item) => <DynamicField key={item.name} field={item} value={form.payload[item.name]} onChange={(value) => setForm((current) => ({ ...current, payload: { ...current.payload, [item.name]: value } }))}/>)}</div><div className="flex justify-end gap-2"><button type="button" onClick={resetForm} className="border border-slate-300 px-4 py-2 text-sm font-bold">ยกเลิก</button><button disabled={saving} className="bg-cyan-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึกฉบับร่าง"}</button></div></form> : null}

    {loading ? <div className="bg-white p-10 text-center text-sm text-slate-500">กำลังโหลดรายงาน...</div> : result?.data.length ? <div className="overflow-x-auto bg-white shadow-sm"><table className="min-w-full text-left text-sm"><thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">วันรายงาน</th><th className="px-4 py-3">หัวข้อ</th><th className="px-4 py-3">ผู้บันทึก</th><th className="px-4 py-3">สถานะ</th><th className="px-4 py-3">การทำงาน</th></tr></thead><tbody>{result.data.map((report) => <tr key={report.id} className="border-t border-slate-100"><td className="whitespace-nowrap px-4 py-3">{new Date(report.report_date).toLocaleString("th-TH")}</td><td className="px-4 py-3 font-bold">{report.title}{report.review_comment ? <p className="mt-1 text-xs text-red-700">หมายเหตุ: {report.review_comment}</p> : null}</td><td className="px-4 py-3">{report.created_by_name || "-"}</td><td className="px-4 py-3">{STATUS_LABELS[report.status]}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-2">{report.permissions?.canEdit ? <button onClick={() => editReport(report)} className="text-cyan-700 underline">แก้ไข</button> : null}{report.permissions?.canSubmit ? <button onClick={() => runWorkflow(() => submitTeamReport(context.session.id, context.team.session_team_id, report.id))} className="text-blue-700 underline">ส่ง</button> : null}{report.permissions?.canVerify ? <button onClick={() => runWorkflow(() => reviewTeamReport(context.session.id, context.team.session_team_id, report.id, "verified"))} className="text-cyan-700 underline">ตรวจสอบ</button> : null}{report.permissions?.canApprove ? <button onClick={() => runWorkflow(() => reviewTeamReport(context.session.id, context.team.session_team_id, report.id, "approved"))} className="text-emerald-700 underline">อนุมัติ</button> : null}{report.permissions?.canReturn ? <button onClick={() => runWorkflow(() => reviewTeamReport(context.session.id, context.team.session_team_id, report.id, "returned", "กรุณาตรวจสอบและแก้ไขข้อมูล"))} className="text-red-700 underline">ส่งกลับ</button> : null}</div></td></tr>)}</tbody></table></div> : <EmptyState title="ยังไม่มีรายงาน" description="ไม่พบรายงานตามเงื่อนไขที่เลือก" />}
  </TeamPageShell>;
}

function DynamicField({ field, value, onChange }) {
  const className = "mt-1 w-full border border-slate-300 px-3 py-2 font-normal";
  return <label className={`text-sm font-bold ${field.type === "textarea" ? "md:col-span-2" : ""}`}>{field.label}{field.type === "textarea" ? <textarea required={field.required} rows="3" value={value || ""} onChange={(e) => onChange(e.target.value)} className={className}/> : field.type === "select" ? <select required={field.required} value={value || ""} onChange={(e) => onChange(e.target.value)} className={className}><option value="">-- เลือก --</option>{field.options.map((option) => <option key={option} value={option}>{option}</option>)}</select> : <input type={field.type} required={field.required} value={value || ""} onChange={(e) => onChange(e.target.value)} className={className}/>}</label>;
}
