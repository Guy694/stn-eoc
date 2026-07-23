"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Bell, CalendarClock, CheckCheck, ClipboardList, RefreshCw, Target, Users } from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { showError, showSuccess } from "@/lib/sweetAlert";

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("th-TH", { dateStyle: "medium", timeStyle: "short" });
}

export default function OfficerInboxPage() {
  const [state, setState] = useState({ loading: true, data: null, error: "" });
  const load = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: "" }));
    try {
      const response = await fetch("/stn-eoc/api/officer/inbox");
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "ไม่สามารถโหลดกล่องงานได้");
      setState({ loading: false, data: result, error: "" });
    } catch (error) {
      setState({ loading: false, data: null, error: error.message });
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  const markAllRead = async () => {
    try {
      const response = await fetch("/stn-eoc/api/officer/notifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ read_all: true }),
      });
      const result = await response.json();
      if (!response.ok || !result.success) throw new Error(result.message || "อัปเดตการแจ้งเตือนไม่สำเร็จ");
      showSuccess("ทำเครื่องหมายว่าอ่านการแจ้งเตือนทั้งหมดแล้ว");
      load();
    } catch (error) {
      showError(error.message);
    }
  };

  const result = state.data;
  return <EOCLayout><section className="mx-auto max-w-7xl space-y-5">
    <header className="border-b-4 border-cyan-700 bg-white p-5 shadow-sm"><div className="flex flex-wrap items-center justify-between gap-3"><div><p className="text-xs font-black text-cyan-700">OFFICER WORK INBOX</p><h1 className="mt-1 text-2xl font-black text-slate-900">กล่องงานของฉัน</h1><p className="mt-1 text-sm text-slate-600">งาน รายงาน ข้อสั่งการ การประชุม และการแจ้งเตือนตามสิทธิ์ของคุณ</p></div><button type="button" onClick={load} className="inline-flex h-10 items-center gap-2 border border-slate-300 px-3 text-sm font-bold"><RefreshCw className="h-4 w-4" />รีเฟรช</button></div></header>
    {state.error ? <div className="border border-red-200 bg-red-50 p-4 text-sm font-bold text-red-800">{state.error}</div> : null}
    {state.loading ? <div className="bg-white p-12 text-center text-slate-500">กำลังโหลดข้อมูลจากฐานข้อมูล...</div> : result ? <>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
        <Metric icon={Users} label="Session" value={result.summary.assigned_sessions} />
        <Metric icon={Users} label="กลุ่มภารกิจ" value={result.summary.assigned_teams} />
        <Metric icon={ClipboardList} label="รายงานส่งกลับ" value={result.summary.returned_reports} alert />
        <Metric icon={Target} label="ภารกิจใกล้กำหนด" value={result.summary.due_soon_missions} />
        <Metric icon={CalendarClock} label="ภารกิจเกินกำหนด" value={result.summary.overdue_missions} alert />
        <Metric icon={Bell} label="ยังไม่อ่าน" value={result.summary.unread_notifications} />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="รายงานที่ต้องดำเนินการ" icon={ClipboardList}>{result.data.reports.length ? result.data.reports.map((item) => <Link key={item.id} href={`/eoc/staff/${item.eoc_session_id}/teams/${item.session_team_id}`} className="block border-t border-slate-100 p-3 hover:bg-slate-50"><div className="flex justify-between gap-3"><span className="font-bold">{item.title}</span><Status value={item.status} /></div><p className="mt-1 text-xs text-slate-500">{item.team_code} · {formatDate(item.report_date)}</p></Link>) : <Empty />}</Panel>
        <Panel title="Mission ที่รับผิดชอบ" icon={Target}>{result.data.missions.length ? result.data.missions.map((item) => <Link key={item.id} href={`/eoc/flood/management/missions?sessionId=${item.session_id}`} className="block border-t border-slate-100 p-3 hover:bg-slate-50"><div className="flex justify-between gap-3"><span className="font-bold">{item.mission_code} · {item.mission_name}</span><span className="text-xs font-bold text-cyan-700">{item.progress_percent}%</span></div><p className="mt-1 text-xs text-slate-500">{item.status} · กำหนด {formatDate(item.due_at)}</p></Link>) : <Empty />}</Panel>
        <Panel title="Decision ที่ต้องติดตาม" icon={CheckCheck}>{result.data.decisions.length ? result.data.decisions.map((item) => <Link key={item.id} href={`/eoc/flood/management/decisions?sessionId=${item.session_id}`} className="block border-t border-slate-100 p-3 hover:bg-slate-50"><p className="font-bold">{item.issue}</p><p className="mt-1 line-clamp-2 text-xs text-slate-500">{item.decision} · กำหนด {formatDate(item.followup_due)}</p></Link>) : <Empty />}</Panel>
        <Panel title="การประชุมถัดไป" icon={CalendarClock}>{result.data.meetings.length ? result.data.meetings.map((item) => <Link key={item.id} href={`/eoc/flood/management/meetings?sessionId=${item.session_id}`} className="block border-t border-slate-100 p-3 hover:bg-slate-50"><p className="font-bold">{item.agenda || "การประชุม EOC"}</p><p className="mt-1 text-xs text-slate-500">{formatDate(item.next_meeting_datetime || `${String(item.meeting_date).slice(0, 10)}T${item.meeting_time}`)}</p></Link>) : <Empty />}</Panel>
      </div>
      <Panel title="การแจ้งเตือนที่ยังไม่ได้อ่าน" icon={Bell} action={<button type="button" onClick={markAllRead} className="text-xs font-bold text-cyan-700 underline">อ่านทั้งหมด</button>}>{result.data.notifications.length ? result.data.notifications.map((item) => <Link key={item.id} href={item.target_url || "/eoc/staff/inbox"} className="block border-t border-slate-100 p-3 hover:bg-slate-50"><p className="font-bold">{item.title}</p><p className="mt-1 text-sm text-slate-600">{item.detail || "-"}</p><p className="mt-1 text-xs text-slate-400">{formatDate(item.created_at)}</p></Link>) : <Empty />}</Panel>
    </> : null}
  </section></EOCLayout>;
}

function Metric({ icon: Icon, label, value, alert }) { return <div className="bg-white p-4 shadow-sm"><Icon className={`h-5 w-5 ${alert && Number(value) ? "text-red-600" : "text-cyan-700"}`} /><p className="mt-3 text-xs font-bold text-slate-500">{label}</p><p className="mt-1 text-2xl font-black">{value}</p></div>; }
function Panel({ title, icon: Icon, action, children }) { return <section className="overflow-hidden bg-white shadow-sm"><header className="flex items-center justify-between border-b border-slate-200 p-4"><h2 className="flex items-center gap-2 text-lg font-black"><Icon className="h-5 w-5 text-cyan-700" />{title}</h2>{action}</header><div className="max-h-96 overflow-y-auto">{children}</div></section>; }
function Empty() { return <p className="p-8 text-center text-sm text-slate-500">ไม่มีรายการที่ต้องดำเนินการ</p>; }
function Status({ value }) { const colors = value === "returned" ? "border-red-200 bg-red-50 text-red-700" : "border-cyan-200 bg-cyan-50 text-cyan-700"; return <span className={`border px-2 py-1 text-xs font-bold ${colors}`}>{value}</span>; }
