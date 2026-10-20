"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  ClipboardList,
  LayoutGrid,
  MessageSquareText,
  Target,
  Users,
} from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { getOperationSessionLockByType } from "@/lib/eocSessionLock";
import { showError, showSuccess } from "@/lib/sweetAlert";
import ReasonDialog from "@/components/ui/reason-dialog";
import DailyDirectivesBoard from "@/components/eoc/directives/DailyDirectivesBoard";

export const FLOOD_EOC_BASE_PATH = "/eoc/flood/management";

// เมนู "ภารกิจและข้อสั่งการ" เหลือเฉพาะงานสั่งการ — ภาพรวม/สรุปรายวัน/ความครบรายงาน อยู่ที่หน้าภาพรวมสถานการณ์
// และแบบบันทึกหลักอยู่ที่หน้าบันทึกพื้นที่น้ำท่วม (หน้าเดิมเหล่านั้น redirect ไปแล้ว)
const VIEWS = [
  { key: "directives", label: "สถานการณ์/ข้อสั่งการรายวัน", href: `${FLOOD_EOC_BASE_PATH}/directives`, icon: ClipboardList },
  { key: "missions", label: "ภารกิจ", href: `${FLOOD_EOC_BASE_PATH}/missions`, icon: LayoutGrid },
  { key: "meetings", label: "ประชุมและสั่งการ", href: `${FLOOD_EOC_BASE_PATH}/meetings`, icon: MessageSquareText },
  { key: "decisions", label: "บันทึกการตัดสินใจ", href: `${FLOOD_EOC_BASE_PATH}/decisions`, icon: Target },
  { key: "workspace", label: "รายงานของกลุ่มภารกิจ", href: `${FLOOD_EOC_BASE_PATH}/team-workspace`, icon: Users },
];

// สถานะรายงานทีมจากระบบเดิมเก็บเป็นภาษาอังกฤษ
const TEAM_STATUS_LABELS = {
  "not started": "ยังไม่เริ่ม",
  draft: "ฉบับร่าง",
  "in progress": "กำลังจัดทำ",
  submitted: "ส่งแล้ว",
  verified: "ตรวจแล้ว",
  approved: "อนุมัติแล้ว",
  returned: "ส่งกลับแก้ไข",
};
const teamStatusLabel = (value) => TEAM_STATUS_LABELS[String(value || "not started").toLowerCase()] || value;

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

async function resolveSessionId(signal) {
  const querySessionId = new URLSearchParams(window.location.search).get("sessionId");
  const locked = querySessionId || getOperationSessionLockByType("flood")?.sessionId;
  if (locked) return Number(locked);
  const status = await fetch("/stn-eoc/api/eoc/status", { signal }).then((res) => res.json());
  const id = (status.data || []).find((row) => row.eoc_type === "flood" && row.session_id)?.session_id;
  return id ? Number(id) : null;
}

export default function FloodEocManagementDashboard({ view = "directives" }) {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const viewMeta = VIEWS.find((item) => item.key === view) || VIEWS[0];

  // งานสั่งการใช้แค่รหัสเหตุการณ์ — มีเพียง "รายงานของกลุ่มภารกิจ" ที่ต้องใช้ข้อมูลทีม SAT จาก API รวม
  const load = useCallback(async (signal) => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const sessionId = await resolveSessionId(signal);
      if (!sessionId) throw new Error("ยังไม่มีเหตุการณ์อุทกภัยที่เปิดอยู่");
      if (view !== "workspace") {
        setState({ loading: false, data: { session: { id: sessionId } }, error: "" });
        return;
      }
      const response = await fetch(`/stn-eoc/api/eoc/flood/management?session_id=${sessionId}`, { signal });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดข้อมูลได้");
      setState({ loading: false, data: result, error: "" });
    } catch (error) {
      if (error.name !== "AbortError") setState({ loading: false, data: null, error: error.message || "ไม่สามารถโหลดข้อมูลได้" });
    }
  }, [view]);

  useEffect(() => {
    const controller = new AbortController();
    load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const content = useMemo(() => {
    if (!state.data) return null;
    if (view === "workspace") return <TeamStatusView data={state.data} />;
    if (["missions", "meetings", "decisions"].includes(view)) return <OperationalResourceView view={view} sessionId={state.data.session.id} />;
    return <DailyDirectivesBoard sessionId={state.data.session.id} />;
  }, [state.data, view]);

  return (
    <EOCLayout>
      <section className="mx-auto max-w-7xl space-y-4">
        <header className="relative overflow-hidden rounded-2xl bg-[#0b4c86] p-5 font-[family-name:var(--font-kanit)] text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)] sm:p-6 space-y-1">
          <p className="text-sm font-semibold text-blue-100">ภารกิจและข้อสั่งการ</p>
          <h1 className="text-xl font-semibold text-white sm:text-3xl sm:text-2xl">{viewMeta.label}</h1>
          {state.data?.session?.status === "closed" ? (
            <p className="mt-2 rounded-lg border border-[#c9dcee] bg-white/15 px-3 py-2 text-sm text-white">
              เหตุการณ์นี้ปิดแล้ว งานปฏิบัติการอยู่ในโหมดอ่านอย่างเดียว แต่ยังจัดทำ แก้ไข ส่ง และตรวจรายงานย้อนหลังได้
            </p>
          ) : null}
        </header>

        <nav className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1" aria-label="เมนูภารกิจและข้อสั่งการ">
          {VIEWS.map((item) => {
            const Icon = item.icon;
            const active = item.key === view;
            return (
              <Link key={item.key} href={item.href} aria-current={active ? "page" : undefined}
                className={`inline-flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold ${active ? "bg-[#0b4c86] text-white" : "text-slate-700 hover:bg-[#edf5fc] hover:text-[#0b4c86]"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{item.label}
              </Link>
            );
          })}
        </nav>

        {state.loading ? <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-500">กำลังโหลดข้อมูล…</div> : null}
        {state.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm font-bold text-red-800" role="alert">
            {state.error}
            {state.error.includes("ทีม") ? (
              <p className="mt-2 font-semibold text-red-700">รายงานของกลุ่มภารกิจใช้ข้อมูลทีม SAT — เพิ่มทีมเข้าเหตุการณ์ได้ที่ <Link href="/eoc/flood/operations-team" className="underline">ทีมปฏิบัติการ</Link></p>
            ) : null}
          </div>
        ) : null}
        {!state.loading && !state.error ? content : null}
      </section>
    </EOCLayout>
  );
}

function TeamStatusView({ data }) {
  if (!data.teams?.length) {
    return <p className="rounded-xl border border-dashed border-slate-300 bg-white p-8 text-center text-sm text-slate-600">ยังไม่มีกลุ่มภารกิจในเหตุการณ์นี้ — เพิ่มได้ที่ <Link href="/eoc/flood/operations-team" className="font-bold text-[#0b4c86] underline">ทีมปฏิบัติการ</Link></p>;
  }
  return (
    <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
      <table className="min-w-full text-left text-sm">
        <caption className="sr-only">สถานะรายงานประจำวันของแต่ละกลุ่มภารกิจ</caption>
        <thead className="bg-slate-50 text-xs text-slate-600">
          <tr>
            <th scope="col" className="px-4 py-3 font-semibold">กลุ่มภารกิจ</th>
            <th scope="col" className="px-4 py-3 font-semibold">หัวหน้าทีม</th>
            <th scope="col" className="px-4 py-3 text-right font-semibold">สมาชิก</th>
            <th scope="col" className="px-4 py-3 font-semibold">รายงานประจำวัน</th>
            <th scope="col" className="px-4 py-3 font-semibold"><span className="sr-only">การทำงาน</span></th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.teams.map((team) => {
            const input = data.current_team_inputs?.find((item) => item.team_code === team.team_code);
            const teamCode = String(team.team_code).toLowerCase();
            return (
              <tr key={team.session_team_id}>
                <td className="px-4 py-3"><p className="font-black text-slate-900">{team.team_code}</p><p className="text-xs text-slate-500">{team.team_name_th}</p></td>
                <td className="px-4 py-3">{team.lead || "ยังไม่กำหนด"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{formatNumber(team.member_count)}</td>
                <td className="px-4 py-3 font-bold text-[#0b4c86]">{teamStatusLabel(input?.raw_status)}</td>
                <td className="px-4 py-3"><Link href={`/eoc/flood/teams/${teamCode}/records?sessionId=${data.session.id}`} className="font-bold text-[#0b4c86] underline">เปิดรายงานทีม</Link></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function OperationalResourceView({ view, sessionId }) {
  const [resource, setResource] = useState({ loading: true, rows: [], permissions: {}, error: "" });
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingMove, setPendingMove] = useState(null);
  const [moving, setMoving] = useState(false);
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
  const moveMission = (row, status) => {
    setPendingMove({ row, status });
  };
  const confirmMoveMission = async (reason) => {
    if (!pendingMove) return;
    const { row, status } = pendingMove;
    setMoving(true);
    try {
      const response = await fetch(`/stn-eoc/api/eoc/flood/management/resources/${row.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type: "missions", session_id: sessionId, status, reason, progress_percent: status === "completed" ? 100 : row.progress_percent }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "เปลี่ยนสถานะไม่สำเร็จ");
      showSuccess(`เปลี่ยนสถานะภารกิจเป็น ${status} แล้ว`);
      setPendingMove(null);
      loadResource();
    } catch (error) {
      showError(error.message);
    } finally {
      setMoving(false);
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
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-sm text-slate-600">{resource.rows.length ? `${resource.rows.length.toLocaleString("th-TH")} รายการในเหตุการณ์นี้` : "บันทึกของเหตุการณ์ที่เปิดอยู่"}</p>
      {resource.permissions.canOperate ? <button type="button" onClick={() => setShowForm((value) => !value)} className="rounded-lg bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white hover:bg-[#083865]">{showForm ? "ปิดแบบฟอร์ม" : `เพิ่ม${labels[view]}`}</button> : null}
    </div>
    {showForm ? <ResourceForm view={view} form={form} setForm={setForm} submit={submit} saving={saving} /> : null}
    {!resource.rows.length ? <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center"><CalendarClock className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" /><p className="mt-3 font-bold text-slate-900">ยังไม่มี{labels[view]}ในเหตุการณ์นี้</p><p className="mt-1 text-sm text-slate-500">{resource.permissions.canOperate ? `กด "เพิ่ม${labels[view]}" เพื่อเริ่มบันทึก` : "เมื่อมีการบันทึกจะแสดงที่นี่"}</p></div> :
      <div className="overflow-x-auto border border-slate-200 bg-white shadow-sm"><table className="min-w-full text-left text-sm">
        <thead className="bg-slate-900 text-white"><tr>{columns.map(([, label]) => <th key={label} className="px-4 py-3">{label}</th>)}{view === "missions" ? <th className="px-4 py-3">ขั้นตอนงาน</th> : null}</tr></thead>
        <tbody>{resource.rows.map((row) => <tr key={row.id} className="border-t border-slate-100">{columns.map(([key]) => <td key={key} className="max-w-xs px-4 py-3">{key === "progress_percent" ? `${row[key] ?? 0}%` : row[key] ?? "-"}</td>)}{view === "missions" ? <td className="px-4 py-3"><MissionActions row={row} canVerify={resource.permissions.canVerify} onMove={moveMission} /></td> : null}</tr>)}</tbody>
      </table></div>}
    <ReasonDialog
      open={Boolean(pendingMove)}
      onOpenChange={(open) => { if (!open) setPendingMove(null); }}
      title="ยืนยันการเปลี่ยนสถานะภารกิจ"
      description={pendingMove ? `เปลี่ยนสถานะเป็น ${pendingMove.status}` : ""}
      label="เหตุผลการเปลี่ยนสถานะ"
      confirmText="เปลี่ยนสถานะ"
      busy={moving}
      onConfirm={confirmMoveMission}
    />
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
  return <form onSubmit={submit} className="space-y-4 border border-[#c9dcee] bg-white p-5 shadow-sm">
    <h3 className="text-lg font-black">บันทึกข้อมูลจากการปฏิบัติงานจริง</h3>
    <div className="grid gap-4 md:grid-cols-2">
      {view === "missions" ? <>{field("mission_code", "รหัสภารกิจ", { required: true })}{field("mission_type", "ประเภทภารกิจ", { required: true })}{field("mission_name", "ชื่อภารกิจ", { required: true, wide: true })}{field("area", "พื้นที่")}{field("assigned_team", "ทีมรับผิดชอบ")}{field("responsible_agency", "หน่วยงานรับผิดชอบ")}{field("responsible_person", "ผู้รับผิดชอบ")}{field("due_at", "กำหนดเสร็จ", { type: "datetime-local" })}{field("progress_percent", "ความคืบหน้า 0–100", { type: "number", min: 0, max: 100 })}{field("remarks", "หมายเหตุ", { textarea: true, wide: true })}</> : null}
      {view === "meetings" ? <>{field("meeting_date", "วันที่ประชุม", { type: "date", required: true })}{field("meeting_time", "เวลาประชุม", { type: "time", required: true })}{field("chairperson", "ประธาน")}{field("attendees", "ผู้เข้าร่วม (คั่นด้วย ,)")}{field("agenda", "วาระ", { textarea: true, wide: true })}{field("situation_summary", "สรุปสถานการณ์", { textarea: true, wide: true })}{field("key_issues", "ประเด็นสำคัญ", { textarea: true })}{field("decisions", "มติ", { textarea: true })}{field("orders", "ข้อสั่งการ", { textarea: true, wide: true })}{field("responsible_team", "ทีมรับผิดชอบ")}{field("due_date", "กำหนดติดตาม", { type: "date" })}<label className="flex items-center gap-2 text-sm font-bold md:col-span-2"><input type="checkbox" checked={form.create_linked_work} onChange={(event) => update("create_linked_work", event.target.checked)} />สร้างการตัดสินใจและ ภารกิจ ที่เชื่อมโยงกันในการบันทึกครั้งเดียว</label>{form.create_linked_work ? <>{field("mission_code", "รหัสภารกิจ", { required: true })}{field("mission_name", "ชื่อภารกิจ", { required: true })}</> : null}</> : null}
      {view === "decisions" ? <>{field("decision_datetime", "วันเวลา", { type: "datetime-local", required: true })}{field("decision_maker", "ผู้ตัดสินใจ")}{field("issue", "ประเด็น", { textarea: true, required: true })}{field("supporting_data", "ข้อมูลประกอบ", { textarea: true })}{field("decision", "ข้อสั่งการ", { textarea: true, required: true, wide: true })}{field("assigned_team", "ทีมรับผิดชอบ")}{field("followup_due", "กำหนดติดตาม", { type: "datetime-local" })}</> : null}
    </div>
    <div className="flex justify-end"><button disabled={saving} className="bg-[#0b4c86] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{saving ? "กำลังบันทึก..." : "บันทึก"}</button></div>
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
  return <div className="flex min-w-36 flex-wrap gap-2">{next.map(([status, label]) => <button key={status} type="button" onClick={() => onMove(row, status)} className="whitespace-nowrap text-xs font-bold text-[#0b4c86] underline">{label}</button>)}</div>;
}
