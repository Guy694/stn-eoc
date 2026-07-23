"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  CalendarClock,
  ClipboardCheck,
  ClipboardList,
  FileSpreadsheet,
  Gauge,
  LayoutGrid,
  MapPin,
  MessageSquareText,
  MonitorCog,
  NotebookPen,
  RefreshCw,
  Target,
  Users,
  Waves,
} from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { getOperationSessionLockByType } from "@/lib/eocSessionLock";
import { showError, showSuccess } from "@/lib/sweetAlert";

export const FLOOD_EOC_BASE_PATH = "/eoc/flood/management";

const VIEWS = [
  { key: "overview", label: "ภาพรวมเหตุการณ์", href: FLOOD_EOC_BASE_PATH, icon: MonitorCog },
  { key: "daily", label: "สรุปรายวัน", href: `${FLOOD_EOC_BASE_PATH}/daily`, icon: BarChart3 },
  { key: "command", label: "ศูนย์บัญชาการ", href: `${FLOOD_EOC_BASE_PATH}/command-room`, icon: Gauge },
  { key: "workspace", label: "พื้นที่ทำงานทีม", href: `${FLOOD_EOC_BASE_PATH}/team-workspace`, icon: Users },
  { key: "completeness", label: "ความครบถ้วน", href: `${FLOOD_EOC_BASE_PATH}/completeness`, icon: ClipboardCheck },
  { key: "forms", label: "แบบฟอร์มทีม", href: `${FLOOD_EOC_BASE_PATH}/forms`, icon: NotebookPen },
  { key: "missions", label: "ภารกิจ", href: `${FLOOD_EOC_BASE_PATH}/missions`, icon: LayoutGrid },
  { key: "meetings", label: "ประชุมและสั่งการ", href: `${FLOOD_EOC_BASE_PATH}/meetings`, icon: MessageSquareText },
  { key: "decisions", label: "บันทึกการตัดสินใจ", href: `${FLOOD_EOC_BASE_PATH}/decisions`, icon: Target },
  { key: "reports", label: "รายงาน", href: `${FLOOD_EOC_BASE_PATH}/reports`, icon: FileSpreadsheet },
];

function todayKey() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(`${String(value).slice(0, 10)}T00:00:00+07:00`).toLocaleDateString("th-TH", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export default function FloodEocManagementDashboard({ view = "overview" }) {
  const [date, setDate] = useState("");
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const viewMeta = VIEWS.find((item) => item.key === view) || VIEWS[0];

  const load = useCallback(async () => {
    const controller = new AbortController();
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const querySessionId = new URLSearchParams(window.location.search).get("sessionId");
      const sessionId = querySessionId || getOperationSessionLockByType("flood")?.sessionId || null;
      const params = new URLSearchParams();
      if (date) params.set("report_date", date);
      if (sessionId) params.set("session_id", String(sessionId));
      const response = await fetch(`/stn-eoc/api/eoc/flood/management?${params.toString()}`, {
        signal: controller.signal,
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดข้อมูลได้");
      setState({ loading: false, data: result, error: "" });
      if (result.report_date && result.report_date !== date) setDate(result.report_date);
    } catch (error) {
      if (error.name !== "AbortError") {
        setState({ loading: false, data: null, error: error.message || "ไม่สามารถโหลดข้อมูลได้" });
      }
    }
    return () => controller.abort();
  }, [date]);

  useEffect(() => {
    const cleanupPromise = load();
    return () => { cleanupPromise.then((cleanup) => cleanup?.()); };
  }, [load]);

  const content = useMemo(() => {
    if (!state.data) return null;
    if (["overview", "daily", "command"].includes(view)) return <DailyView data={state.data} compact={view === "overview"} />;
    if (["workspace", "completeness"].includes(view)) return <TeamStatusView data={state.data} />;
    if (view === "forms") return <ActionView data={state.data} mode="forms" />;
    if (view === "reports") return <ActionView data={state.data} mode="reports" />;
    if (["missions", "meetings", "decisions"].includes(view)) {
      return <OperationalResourceView view={view} sessionId={state.data.session.id} />;
    }
    return null;
  }, [state.data, view]);

  return (
    <EOCLayout>
      <section className="mx-auto max-w-[1500px] space-y-4">
        <header className="border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-wider text-cyan-300">ข้อมูลจากฐานข้อมูลจริง</p>
              <h1 className="mt-1 text-2xl font-black">{state.data?.session?.session_name || "ระบบจัดการ EOC อุทกภัย"}</h1>
              <p className="mt-2 text-sm text-slate-300">{viewMeta.label} · ข้อมูลแยกตาม Session และวันที่รายงาน</p>
            </div>
            <div className="flex flex-wrap items-end gap-2">
              <label className="text-xs font-bold text-slate-200">วันที่รายงาน
                <input type="date" value={date || todayKey()} onChange={(event) => setDate(event.target.value)} className="ml-2 h-10 bg-white px-3 text-slate-900" />
              </label>
              <button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 border border-white/30 px-3 text-sm font-bold hover:bg-white/10">
                <RefreshCw className="h-4 w-4" />รีเฟรช
              </button>
            </div>
          </div>
          {state.data?.session?.status === "closed" ? (
            <p className="mt-4 border border-cyan-300/40 bg-cyan-900/40 p-3 text-sm text-cyan-100">
              Session ปิดแล้ว งานปฏิบัติการอยู่ในโหมดอ่านอย่างเดียว แต่ยังสามารถจัดทำ แก้ไข ส่ง และตรวจรายงานย้อนหลังได้
            </p>
          ) : null}
        </header>

        <nav className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10" aria-label="เมนูจัดการ EOC อุทกภัย">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            return <Link key={item.key} href={item.href} className={`flex min-h-14 items-center gap-2 border px-3 py-2 text-xs font-black ${item.key === view ? "border-cyan-700 bg-cyan-700 text-white" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}><Icon className="h-4 w-4" />{item.label}</Link>;
          })}
        </nav>

        {state.loading ? <div className="bg-white p-12 text-center text-sm text-slate-500">กำลังโหลดข้อมูลจากฐานข้อมูล...</div> : null}
        {state.error ? <div className="border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800">{state.error}</div> : null}
        {!state.loading && !state.error ? content : null}
      </section>
    </EOCLayout>
  );
}

function DailyView({ data, compact }) {
  const summary = data.selected_summary;
  const cards = [
    ["อำเภอได้รับผลกระทบ", summary.affected_districts, MapPin],
    ["ตำบลได้รับผลกระทบ", summary.affected_subdistricts, MapPin],
    ["หมู่บ้านได้รับผลกระทบ", summary.affected_villages, Waves],
    ["ครัวเรือนได้รับผลกระทบ", summary.affected_households, Waves],
    ["ประชาชนได้รับผลกระทบ", summary.affected_population, Users],
    ["พื้นที่รุนแรง", summary.severe_count, AlertTriangle],
    ["ทีมส่งรายงานแล้ว", summary.submitted_team_count, ClipboardList],
    ["ความครบถ้วน", `${summary.data_completeness_score}%`, ClipboardCheck],
  ];
  return <div className="space-y-4">
    <div className="border border-cyan-200 bg-cyan-50 p-4 text-sm font-bold text-cyan-900">ประจำวันที่ {formatDate(summary.report_date)} · พบข้อมูล {data.current_flood_reports.length} รายการ</div>
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map(([label, value, Icon]) => <article key={label} className="border border-slate-200 bg-white p-4 shadow-sm"><Icon className="h-5 w-5 text-cyan-700" /><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black text-slate-900">{typeof value === "number" ? formatNumber(value) : value}</p></article>)}
    </div>
    {!compact ? <DistrictTable rows={data.district_summary} /> : null}
  </div>;
}

function DistrictTable({ rows }) {
  return <div className="overflow-x-auto border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full text-left text-sm">
      <thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">อำเภอ</th><th className="px-4 py-3 text-right">ตำบล</th><th className="px-4 py-3 text-right">หมู่บ้าน</th><th className="px-4 py-3 text-right">ครัวเรือน</th><th className="px-4 py-3 text-right">ประชาชน</th><th className="px-4 py-3 text-right">ระดับน้ำเฉลี่ย</th></tr></thead>
      <tbody>{rows.length ? rows.map((row) => <tr key={row.district} className="border-t border-slate-100"><td className="px-4 py-3 font-bold">{row.district}</td><td className="px-4 py-3 text-right">{formatNumber(row.tambon_count)}</td><td className="px-4 py-3 text-right">{formatNumber(row.village_count)}</td><td className="px-4 py-3 text-right">{formatNumber(row.total_households)}</td><td className="px-4 py-3 text-right">{formatNumber(row.total_population)}</td><td className="px-4 py-3 text-right">{formatNumber(row.avg_water_level)} ซม.</td></tr>) : <tr><td colSpan="6" className="p-10 text-center text-slate-500">ไม่มีข้อมูลในวันที่เลือก</td></tr>}</tbody>
    </table>
  </div>;
}

function TeamStatusView({ data }) {
  return <div className="overflow-x-auto border border-slate-200 bg-white shadow-sm">
    <table className="min-w-full text-left text-sm">
      <thead className="bg-slate-900 text-white"><tr><th className="px-4 py-3">กลุ่มภารกิจ</th><th className="px-4 py-3">หัวหน้าทีม</th><th className="px-4 py-3 text-right">สมาชิก</th><th className="px-4 py-3">สถานะรายงานประจำวัน</th><th className="px-4 py-3">การทำงาน</th></tr></thead>
      <tbody>{data.teams.map((team) => {
        const input = data.current_team_inputs.find((item) => item.team_code === team.team_code);
        const teamCode = String(team.team_code).toLowerCase();
        return <tr key={team.session_team_id} className="border-t border-slate-100"><td className="px-4 py-3"><p className="font-black">{team.team_code}</p><p className="text-xs text-slate-500">{team.team_name_th}</p></td><td className="px-4 py-3">{team.lead || "ยังไม่กำหนด"}</td><td className="px-4 py-3 text-right">{formatNumber(team.member_count)}</td><td className="px-4 py-3 font-bold text-cyan-700">{input?.raw_status || "Not Started"}</td><td className="px-4 py-3"><Link href={`/eoc/flood/teams/${teamCode}/records?sessionId=${data.session.id}`} className="font-bold text-cyan-700 underline">เปิดรายงานทีม</Link></td></tr>;
      })}</tbody>
    </table>
  </div>;
}

function ActionView({ data, mode }) {
  const isForms = mode === "forms";
  return <div className="border border-slate-200 bg-white p-6 shadow-sm">
    <h2 className="text-xl font-black text-slate-900">{isForms ? "แบบบันทึกสถานการณ์อุทกภัย" : "รายงานกลุ่มภารกิจ"}</h2>
    <p className="mt-2 text-sm text-slate-600">{isForms ? "ใช้แบบบันทึกหลักที่เชื่อมกับ flood_records โดยตรง เพื่อลดแบบฟอร์มและ API ที่ซ้ำกัน" : "รายงานทั้งหมดผูกกับ Session และกลุ่มภารกิจ พร้อม workflow ส่งและตรวจรายงาน"}</p>
    <div className="mt-5 flex flex-wrap gap-3">
      {isForms ? <Link href="/eoc/flood/records" className="bg-cyan-700 px-4 py-3 text-sm font-bold text-white">เปิดแบบบันทึกหลัก</Link> : null}
      <Link href="/eoc/staff" className="border border-cyan-700 px-4 py-3 text-sm font-bold text-cyan-800">เปิดศูนย์งานเจ้าหน้าที่</Link>
      <Link href={`/eoc/flood/daily-risk?sessionId=${data.session.id}`} className="border border-slate-300 px-4 py-3 text-sm font-bold text-slate-700">ดูรายละเอียดรายวัน</Link>
    </div>
  </div>;
}

function OperationalResourceView({ view, sessionId }) {
  const [resource, setResource] = useState({ loading: true, rows: [], permissions: {}, error: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialResourceForm(view));
  const loadResource = useCallback(() => {
    const controller = new AbortController();
    setResource((current) => ({ ...current, loading: true, error: "" }));
    fetch(`/stn-eoc/api/eoc/flood/management/resources?type=${view}&session_id=${sessionId}`, { signal: controller.signal })
      .then(async (response) => {
        const result = await response.json();
        if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดข้อมูลได้");
        setResource({ loading: false, rows: result.data || [], permissions: result.permissions || {}, error: "" });
      })
      .catch((error) => {
        if (error.name !== "AbortError") setResource((current) => ({ ...current, loading: false, error: error.message }));
      });
    return controller;
  }, [sessionId, view]);
  useEffect(() => {
    setForm(initialResourceForm(view));
    const controller = loadResource();
    return () => controller.abort();
  }, [loadResource, view]);

  const labels = { missions: "ภารกิจ", meetings: "การประชุมและข้อสั่งการ", decisions: "บันทึกการตัดสินใจ" };
  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const body = normalizeResourceForm(view, form);
      const response = await fetch("/stn-eoc/api/eoc/flood/management/resources", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: view, session_id: sessionId, ...body }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "บันทึกไม่สำเร็จ");
      showSuccess(`เพิ่ม${labels[view]}แล้ว`);
      setForm(initialResourceForm(view));
      setShowForm(false);
      loadResource();
    } catch (error) {
      showError(error.message);
    } finally {
      setSaving(false);
    }
  };
  const moveMission = async (row, status) => {
    const reason = window.prompt(`เหตุผลการเปลี่ยนสถานะเป็น ${status}`);
    if (!reason) return;
    try {
      const response = await fetch(`/stn-eoc/api/eoc/flood/management/resources/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "missions", session_id: sessionId, status, reason, progress_percent: status === "completed" ? 100 : row.progress_percent }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "เปลี่ยนสถานะไม่สำเร็จ");
      showSuccess(`เปลี่ยนสถานะภารกิจเป็น ${status} แล้ว`);
      loadResource();
    } catch (error) {
      showError(error.message);
    }
  };
  if (resource.loading) return <div className="border border-slate-200 bg-white p-10 text-center text-slate-500">กำลังโหลดข้อมูลจากฐานข้อมูล...</div>;
  const columns = {
    missions: [
      ["mission_code", "รหัส"], ["mission_name", "ภารกิจ"], ["area", "พื้นที่"],
      ["assigned_team", "ทีมรับผิดชอบ"], ["priority", "ความสำคัญ"], ["status", "สถานะ"], ["progress_percent", "ความคืบหน้า"]
    ],
    meetings: [
      ["meeting_date", "วันที่"], ["meeting_time", "เวลา"], ["chairperson", "ประธาน"],
      ["agenda", "วาระ"], ["responsible_team", "ทีมรับผิดชอบ"], ["followup_status", "ติดตามผล"]
    ],
    decisions: [
      ["decision_datetime", "วันเวลา"], ["issue", "ประเด็น"], ["decision", "ข้อสั่งการ"],
      ["decision_maker", "ผู้ตัดสินใจ"], ["assigned_team", "ทีมรับผิดชอบ"], ["status", "สถานะ"]
    ]
  }[view];
  return <div className="space-y-4">
    {resource.error ? <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{resource.error}</div> : null}
    <div className="flex flex-wrap items-center justify-between gap-3 border border-slate-200 bg-white p-4 shadow-sm">
      <div><h2 className="text-lg font-black text-slate-900">{labels[view]}</h2><p className="text-xs text-slate-500">ข้อมูลจากฐานข้อมูลตาม Session ที่เลือก</p></div>
      {resource.permissions.canOperate ? <button type="button" onClick={() => setShowForm((value) => !value)} className="bg-cyan-700 px-4 py-2 text-sm font-bold text-white">{showForm ? "ปิดแบบฟอร์ม" : `เพิ่ม${labels[view]}`}</button> : null}
    </div>
    {showForm ? <ResourceForm view={view} form={form} setForm={setForm} submit={submit} saving={saving} /> : null}
    {!resource.rows.length ? <div className="border border-slate-200 bg-white p-10 text-center shadow-sm"><CalendarClock className="mx-auto h-8 w-8 text-slate-400" /><h2 className="mt-3 text-lg font-black text-slate-900">{labels[view]}</h2><p className="mt-2 text-sm text-slate-500">ยังไม่มีข้อมูลจริงใน Session นี้ ระบบไม่แสดงข้อมูลจำลอง</p></div> :
      <div className="overflow-x-auto border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900 text-white"><tr>{columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}{view === "missions" ? <th className="px-4 py-3">Workflow</th> : null}</tr></thead>
        <tbody>{resource.rows.map((row) => <tr key={row.id} className="border-t border-slate-100">{columns.map(([key]) => <td key={key} className="max-w-xs px-4 py-3">{key === "progress_percent" ? `${row[key] ?? 0}%` : row[key] ?? "-"}</td>)}{view === "missions" ? <td className="px-4 py-3"><MissionActions row={row} canVerify={resource.permissions.canVerify} onMove={moveMission} /></td> : null}</tr>)}</tbody>
      </table></div>}
  </div>;
}

function initialResourceForm(view) {
  const now = new Date(Date.now() - new Date().getTimezoneOffset() * 60000);
  if (view === "missions") return { mission_code: "", mission_type: "", mission_name: "", area: "", assigned_team: "", responsible_agency: "", priority: "ปานกลาง", due_at: "", status: "intake", progress_percent: 0, responsible_person: "", remarks: "" };
  if (view === "meetings") return { meeting_date: now.toISOString().slice(0, 10), meeting_time: now.toISOString().slice(11, 16), chairperson: "", attendees: "", agenda: "", situation_summary: "", key_issues: "", decisions: "", orders: "", responsible_team: "", due_date: "", followup_status: "pending", next_meeting_datetime: "", create_linked_work: false, mission_code: "", mission_name: "" };
  return { decision_datetime: now.toISOString().slice(0, 16), decision_maker: "", issue: "", supporting_data: "", decision: "", assigned_team: "", followup_due: "", status: "pending" };
}

function normalizeResourceForm(view, form) {
  if (view !== "meetings") return form;
  const result = {
    ...form,
    attendees: form.attendees ? form.attendees.split(",").map((item) => item.trim()).filter(Boolean) : null,
    key_issues: form.key_issues ? form.key_issues.split("\n").filter(Boolean) : null,
    decisions: form.decisions ? form.decisions.split("\n").filter(Boolean) : null,
  };
  if (form.create_linked_work) {
    result.create_decision = {
      decision_datetime: `${form.meeting_date} ${form.meeting_time}`,
      decision_maker: form.chairperson,
      issue: form.key_issues || form.agenda,
      decision: form.decisions || form.orders,
      assigned_team: form.responsible_team,
      followup_due: form.due_date,
    };
    result.create_mission = {
      mission_code: form.mission_code,
      mission_type: "meeting_order",
      mission_name: form.mission_name,
      assigned_team: form.responsible_team,
      due_at: form.due_date,
      status: "assigned",
      progress_percent: 0,
    };
  }
  ["create_linked_work", "mission_code", "mission_name"].forEach((key) => delete result[key]);
  return result;
}

function ResourceForm({ view, form, setForm, submit, saving }) {
  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }));
  const field = (key, label, options = {}) => <label className={`text-sm font-bold text-slate-700 ${options.wide ? "md:col-span-2" : ""}`}>{label}{options.textarea ? <textarea required={options.required} rows="3" value={form[key] || ""} onChange={(event) => update(key, event.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal" /> : <input type={options.type || "text"} required={options.required} min={options.min} max={options.max} value={form[key] ?? ""} onChange={(event) => update(key, event.target.value)} className="mt-1 w-full border border-slate-300 px-3 py-2 font-normal" />}</label>;
  return <form onSubmit={submit} className="space-y-4 border border-cyan-200 bg-white p-5 shadow-sm">
    <h3 className="text-lg font-black">บันทึกข้อมูลจากการปฏิบัติงานจริง</h3>
    <div className="grid gap-4 md:grid-cols-2">
      {view === "missions" ? <>{field("mission_code", "รหัสภารกิจ", { required: true })}{field("mission_type", "ประเภทภารกิจ", { required: true })}{field("mission_name", "ชื่อภารกิจ", { required: true, wide: true })}{field("area", "พื้นที่")}{field("assigned_team", "ทีมรับผิดชอบ")}{field("responsible_agency", "หน่วยงานรับผิดชอบ")}{field("responsible_person", "ผู้รับผิดชอบ")}{field("due_at", "กำหนดเสร็จ", { type: "datetime-local" })}{field("progress_percent", "ความคืบหน้า 0–100", { type: "number", min: 0, max: 100 })}{field("remarks", "หมายเหตุ", { textarea: true, wide: true })}</> : null}
      {view === "meetings" ? <>{field("meeting_date", "วันที่ประชุม", { type: "date", required: true })}{field("meeting_time", "เวลาประชุม", { type: "time", required: true })}{field("chairperson", "ประธาน")}{field("attendees", "ผู้เข้าร่วม (คั่นด้วย ,)")}{field("agenda", "วาระ", { textarea: true, wide: true })}{field("situation_summary", "สรุปสถานการณ์", { textarea: true, wide: true })}{field("key_issues", "ประเด็นสำคัญ", { textarea: true })}{field("decisions", "มติ", { textarea: true })}{field("orders", "ข้อสั่งการ", { textarea: true, wide: true })}{field("responsible_team", "ทีมรับผิดชอบ")}{field("due_date", "กำหนดติดตาม", { type: "date" })}<label className="flex items-center gap-2 text-sm font-bold md:col-span-2"><input type="checkbox" checked={form.create_linked_work} onChange={(event) => update("create_linked_work", event.target.checked)} />สร้าง Decision และ Mission ที่เชื่อมโยงใน Transaction เดียว</label>{form.create_linked_work ? <>{field("mission_code", "รหัสภารกิจ", { required: true })}{field("mission_name", "ชื่อภารกิจ", { required: true })}</> : null}</> : null}
      {view === "decisions" ? <>{field("decision_datetime", "วันเวลา", { type: "datetime-local", required: true })}{field("decision_maker", "ผู้ตัดสินใจ")}{field("issue", "ประเด็น", { textarea: true, required: true })}{field("supporting_data", "ข้อมูลประกอบ", { textarea: true })}{field("decision", "ข้อสั่งการ", { textarea: true, required: true, wide: true })}{field("assigned_team", "ทีมรับผิดชอบ")}{field("followup_due", "กำหนดติดตาม", { type: "datetime-local" })}</> : null}
    </div>
    <div className="flex justify-end"><button disabled={saving} className="bg-cyan-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึก"}</button></div>
  </form>;
}

function MissionActions({ row, canVerify, onMove }) {
  const next = {
    intake: [["assigned", "มอบหมาย"]],
    assigned: [["in_progress", "เริ่มดำเนินการ"], ["blocked", "ติดขัด"]],
    in_progress: [["completed", "เสร็จสิ้น"], ["blocked", "ติดขัด"]],
    blocked: [["in_progress", "ดำเนินการต่อ"]],
    completed: canVerify ? [["verified", "ยืนยันผล"]] : [],
    verified: canVerify ? [["closed", "ปิดภารกิจ"]] : [],
    closed: [],
  }[row.status] || [];
  return <div className="flex min-w-36 flex-wrap gap-2">{next.map(([status, label]) => <button key={status} type="button" onClick={() => onMove(row, status)} className="whitespace-nowrap text-xs font-bold text-cyan-700 underline">{label}</button>)}</div>;
}
