"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  BellRing,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock3,
  Database,
  FileSpreadsheet,
  FileText,
  Gauge,
  Home,
  LayoutGrid,
  ListChecks,
  Map,
  MapPin,
  Megaphone,
  MessageSquareText,
  MonitorCog,
  NotebookPen,
  Package,
  Radio,
  Send,
  ShieldCheck,
  Target,
  Users,
  Waves
} from "lucide-react";
import EOCLayout from "@/components/layouts/EOCLayout";
import {
  FLOOD_EOC_BASE_PATH,
  MISSION_COLUMNS,
  REPORTING_STATUSES,
  getFloodEocManagementData
} from "@/lib/eocFloodManagement";

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
  { key: "reports", label: "รายงาน", href: `${FLOOD_EOC_BASE_PATH}/reports`, icon: FileSpreadsheet }
];

const STATUS_CLASS = {
  green: "border-emerald-200 bg-emerald-50 text-emerald-700",
  yellow: "border-yellow-200 bg-yellow-50 text-yellow-700",
  red: "border-red-200 bg-red-50 text-red-700",
  orange: "border-orange-200 bg-orange-50 text-orange-700",
  cyan: "border-cyan-200 bg-cyan-50 text-cyan-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  violet: "border-violet-200 bg-violet-50 text-violet-700",
  sky: "border-sky-200 bg-sky-50 text-sky-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
  gray: "border-gray-200 bg-gray-50 text-gray-600"
};

function formatThaiDate(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleDateString("th-TH", { day: "2-digit", month: "short", year: "numeric" });
}

function formatThaiDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("th-TH", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatNumber(value) {
  return Number(value || 0).toLocaleString("th-TH");
}

function statusClass(status) {
  const color = REPORTING_STATUSES[status]?.color || "slate";
  return STATUS_CLASS[color] || STATUS_CLASS.slate;
}

function StatusPill({ status }) {
  const meta = REPORTING_STATUSES[status] || { label: status || "-", color: "slate" };
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-black ${STATUS_CLASS[meta.color] || STATUS_CLASS.slate}`}>
      {meta.label}
    </span>
  );
}

function DeadlineCountdown() {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(timer);
  }, []);

  const target = new Date(now);
  target.setHours(15, 0, 0, 0);
  const diffMs = target.getTime() - now.getTime();
  const isLate = diffMs <= 0;
  const absMs = Math.abs(diffMs);
  const hours = Math.floor(absMs / 3600000);
  const minutes = Math.floor((absMs % 3600000) / 60000);

  return (
    <div className={`rounded-lg border p-3 ${isLate ? "border-orange-200 bg-orange-50 text-orange-800" : "border-cyan-200 bg-cyan-50 text-cyan-800"}`}>
      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wide">
        <Clock3 className="h-4 w-4" />
        กำหนดส่ง 15:00 น.
      </div>
      <div className="mt-1 text-2xl font-black">
        {isLate ? `เลยเวลา ${hours} ชม. ${minutes} นาที` : `${hours} ชม. ${minutes} นาที`}
      </div>
    </div>
  );
}

export default function FloodEocManagementDashboard({ view = "overview" }) {
  const data = useMemo(() => getFloodEocManagementData(), []);
  const summary = data.selected_summary;
  const session = data.session;
  const viewMeta = VIEWS.find((item) => item.key === view) || VIEWS[0];

  return (
    <EOCLayout>
      <div className="mx-auto max-w-[1600px] space-y-4">
        <HeaderBlock session={session} summary={summary} viewMeta={viewMeta} />
        <ViewNav activeView={view} />

        {view === "overview" && <OverviewView data={data} />}
        {view === "daily" && <DailyDashboardView data={data} />}
        {view === "command" && <CommandRoomView data={data} />}
        {view === "workspace" && <TeamWorkspaceView data={data} />}
        {view === "completeness" && <CompletenessView data={data} />}
        {view === "forms" && <FormsView data={data} />}
        {view === "missions" && <MissionsView data={data} />}
        {view === "meetings" && <MeetingsView data={data} />}
        {view === "decisions" && <DecisionsView data={data} />}
        {view === "reports" && <ReportsView data={data} />}
      </div>
    </EOCLayout>
  );
}

function HeaderBlock({ session, summary, viewMeta }) {
  const Icon = viewMeta.icon;
  return (
    <section className="rounded-lg border border-slate-200 bg-[#082f49] p-4 text-white shadow-sm">
      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px] lg:items-center">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-cyan-200">
            <Icon className="h-4 w-4" />
            ระบบจัดการศูนย์ปฏิบัติการ EOC สำหรับเจ้าหน้าที่
          </div>
          <h1 className="mt-2 text-2xl font-black lg:text-3xl">{session.session_name}</h1>
          <p className="mt-1 max-w-5xl text-sm leading-6 text-slate-200">
            การจัดการตามเหตุการณ์และรอบรายงานประจำวันสำหรับอุทกภัยน้ำท่วม โดยทุกทีมต้องส่งข้อมูลก่อน 15:00 น.
          </p>
          <div className="mt-3 flex flex-wrap gap-2 text-xs font-bold">
            <span className="rounded-full bg-white/12 px-3 py-1">{session.session_code}</span>
            <span className="rounded-full bg-white/12 px-3 py-1">{session.eoc_status}</span>
            <span className="rounded-full bg-white/12 px-3 py-1">{session.eoc_level}</span>
            <span className="rounded-full bg-white/12 px-3 py-1">วันที่ {summary.day_no}</span>
            <span className="rounded-full bg-white/12 px-3 py-1">ผู้บัญชาการ: {session.commander_name}</span>
          </div>
        </div>
        <DeadlineCountdown />
      </div>
    </section>
  );
}

function ViewNav({ activeView }) {
  return (
    <nav className="grid grid-cols-2 gap-2 md:grid-cols-5 xl:grid-cols-10">
      {VIEWS.map((item) => {
        const Icon = item.icon;
        const active = item.key === activeView;
        return (
          <Link
            key={item.key}
            href={item.href}
            className={`flex min-h-[58px] items-center gap-2 rounded-lg border px-3 py-2 text-xs font-black transition ${active ? "border-cyan-300 bg-cyan-700 text-white shadow-sm" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

function OverviewView({ data }) {
  const summary = data.selected_summary;
  return (
    <div className="space-y-4">
      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <InfoCard icon={CalendarClock} label="เปิด EOC" value={formatThaiDateTime(data.session.opened_at)} detail={data.session.eoc_status} />
        <InfoCard icon={ShieldCheck} label="ความครบถ้วนข้อมูล" value={`${summary.data_completeness_score}%`} detail={`${summary.submitted_team_count} ทีมส่งแล้ว`} />
        <InfoCard icon={AlertTriangle} label="ทีมยังไม่ส่ง" value={summary.missing_team_count} detail="ติดตามก่อนประชุม" tone="red" />
        <InfoCard icon={ClipboardList} label="ข้อมูลรอตรวจสอบ" value={summary.need_review_count} detail="รอตรวจสอบ" tone="cyan" />
      </section>

      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
        <Panel title="หน่วยงาน EOC อุทกภัยน้ำท่วม" icon={Waves}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {data.teams.map((team) => (
              <div key={team.team_code} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                <div className="text-xs font-black text-cyan-700">{team.team_code}</div>
                <h3 className="mt-1 font-black text-slate-900">{team.team_name_th}</h3>
                <p className="mt-1 text-xs font-semibold text-slate-500">หัวหน้าทีม: {team.lead}</p>
                <div className="mt-3 flex flex-wrap gap-1">
                  {team.required_data.slice(0, 3).map((item) => (
                    <span key={item} className="rounded-full bg-white px-2 py-1 text-[11px] font-bold text-slate-600">{item}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="สิทธิ์การใช้งานตามบทบาท" icon={Users}>
          <div className="space-y-2">
            {Object.entries(data.role_access_mock).map(([role, permissions]) => (
              <div key={role} className="rounded-lg border border-slate-100 bg-slate-50 p-3">
                <div className="font-black text-slate-900">{role}</div>
                <div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{permissions.join(", ")}</div>
              </div>
            ))}
          </div>
        </Panel>
      </section>

      <DailyDashboardView data={data} compact />
    </div>
  );
}

function DailyDashboardView({ data, compact = false }) {
  const summary = data.selected_summary;
  const kpis = [
    ["เหตุการณ์อุทกภัยน้ำท่วมวันนี้", data.current_flood_reports.length, Waves],
    ["อำเภอได้รับผลกระทบ", summary.affected_districts, MapPin],
    ["ตำบลได้รับผลกระทบ", summary.affected_subdistricts, Map],
    ["หมู่บ้านได้รับผลกระทบ", summary.affected_villages, Home],
    ["ครัวเรือนได้รับผลกระทบ", summary.affected_households, Home],
    ["ประชาชนได้รับผลกระทบ", summary.affected_population, Users],
    ["กลุ่มเปราะบาง", summary.vulnerable_population, ShieldCheck],
    ["ถนนปิด", summary.road_closed_count, AlertTriangle],
    ["ศูนย์พักพิงเปิด", summary.shelter_open_count, Home],
    ["ผู้เข้าพักศูนย์พักพิง", summary.shelter_occupancy, Users],
    ["หน่วยบริการสุขภาพกระทบ", summary.health_facility_affected_count, Radio],
    ["คำขอความช่วยเหลือ", summary.help_request_count, BellRing],
    ["ภารกิจเกินกำหนด", summary.overdue_mission_count, Clock3],
    ["ทรัพยากรขาดแคลน", summary.resource_shortage_count, Package]
  ];

  return (
    <div className="space-y-4">
      <Panel title={`สรุปสถานการณ์อุทกภัยน้ำท่วมรายวัน - ${formatThaiDate(summary.report_date)}`} icon={BarChart3}>
        <p className="rounded-lg border border-cyan-100 bg-cyan-50 p-3 text-sm font-semibold leading-6 text-cyan-900">
          {summary.situation_summary}
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
          {kpis.map(([label, value, Icon]) => (
            <InfoCard key={label} icon={Icon} label={label} value={formatNumber(value)} compact />
          ))}
        </div>
      </Panel>

      {!compact && (
        <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
          <SituationMap reports={data.current_flood_reports} shelters={data.shelters} healthFacilities={data.health_facilities} />
          <TeamStatusTable inputs={data.current_team_inputs} />
        </section>
      )}
    </div>
  );
}

function CommandRoomView({ data }) {
  return (
    <div className="space-y-4">
      <DailySituationHeader data={data} />
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="space-y-4">
          <Panel title="สรุปสำหรับผู้บริหาร" icon={FileText}>
            <p className="text-sm font-semibold leading-7 text-slate-700">
              ระบบพบว่าอำเภอละงูและมะนังมีระดับความเสี่ยงสูงจากฝนสะสมและจุดอุทกภัยน้ำท่วมหลายจุด มีประชาชนได้รับผลกระทบรวม {formatNumber(data.selected_summary.affected_population)} คน ขณะที่ทีมที่ยังไม่ส่งหรือส่งหลังเวลา 15:00 น. ต้องถูกติดตามก่อนประชุม จึงควรพิจารณาเปิดศูนย์พักพิงเพิ่มเติม เร่งส่งทรัพยากร และออกประกาศเตือนภัยเพิ่มเติมในพื้นที่เสี่ยง
            </p>
          </Panel>
          <SituationMap reports={data.current_flood_reports} shelters={data.shelters} healthFacilities={data.health_facilities} />
          <TeamSummaryPanels teams={data.teams} inputs={data.current_team_inputs} />
        </div>
        <div className="space-y-4">
          <MissingDataAlert items={data.missing_data} />
          <DecisionQueue decisions={data.decisions} />
          <MissionStatusSummary missions={data.current_missions} />
        </div>
      </section>
      <MeetingsView data={data} compact />
    </div>
  );
}

function TeamWorkspaceView({ data }) {
  return (
    <div className="grid gap-4 xl:grid-cols-[360px_minmax(0,1fr)]">
      <Panel title="พื้นที่ทำงานทีม" icon={Users}>
        <div className="space-y-3">
          {data.current_team_inputs.map((input) => (
            <div key={input.id} className={`rounded-lg border p-3 ${statusClass(input.raw_status)}`}>
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black">{input.team_code}</div>
                  <div className="font-black text-slate-900">{input.team_name}</div>
                </div>
                <StatusPill status={input.raw_status} />
              </div>
              <div className="mt-3 h-2 rounded-full bg-white/70">
                <div className="h-2 rounded-full bg-current" style={{ width: `${input.completed_percent}%` }} />
              </div>
              <div className="mt-2 text-xs font-bold">ครบถ้วน {input.completed_percent}%</div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="รายการที่ต้องกรอกวันนี้" icon={ListChecks}>
        <div className="grid gap-3 md:grid-cols-2">
          {data.teams.map((team) => {
            const input = data.current_team_inputs.find((item) => item.team_code === team.team_code);
            return (
              <div key={team.team_code} className="rounded-lg border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black text-cyan-700">{team.team_code}</div>
                    <h3 className="font-black text-slate-900">{team.team_name_th}</h3>
                    <p className="mt-1 text-xs font-semibold text-slate-500">กำหนดส่งวันนี้: 15:00 น.</p>
                  </div>
                  <StatusPill status={input?.raw_status} />
                </div>
                <ul className="mt-3 space-y-2">
                  {team.required_data.map((item) => (
                    <li key={item} className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`${FLOOD_EOC_BASE_PATH}/forms?team=${team.team_code}`} className="rounded-lg bg-cyan-700 px-3 py-2 text-xs font-black text-white hover:bg-cyan-800">
                    เปิดแบบฟอร์ม
                  </Link>
                  <button type="button" className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50">
                    แนบไฟล์/รูปภาพ
                  </button>
                  <button type="button" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-black text-emerald-700 hover:bg-emerald-100">
                    ส่งข้อมูลประจำวัน
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Panel>
    </div>
  );
}

function CompletenessView({ data }) {
  return (
    <div className="space-y-4">
      <Panel title="ตารางความครบถ้วนของข้อมูล" icon={ClipboardCheck}>
        <TeamStatusTable inputs={data.current_team_inputs} wide />
      </Panel>
      <MissingDataAlert items={data.missing_data} />
      <Panel title="ประวัติการดำเนินการ" icon={Database}>
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="text-left text-xs font-black uppercase text-slate-500">
              <tr><th className="p-2">เวลา</th><th className="p-2">ผู้ใช้</th><th className="p-2">ทีม</th><th className="p-2">การดำเนินการ</th><th className="p-2">ตารางข้อมูล</th><th className="p-2">หมายเหตุ</th></tr>
            </thead>
            <tbody>
              {data.audit_logs.slice(0, 18).map((log) => (
                <tr key={log.id} className="border-t border-slate-100">
                  <td className="p-2 font-semibold">{formatThaiDateTime(log.action_datetime)}</td>
                  <td className="p-2">{log.user_name}</td>
                  <td className="p-2">{log.team_code}</td>
                  <td className="p-2 font-black text-cyan-700">{log.action_type}</td>
                  <td className="p-2">{log.table_name}</td>
                  <td className="p-2">{log.remarks}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
    </div>
  );
}

function FormsView({ data }) {
  return (
    <Panel title="แบบฟอร์มกรอกข้อมูลรายทีม" icon={NotebookPen}>
      <div className="grid gap-4 xl:grid-cols-2">
        {data.forms.map((form) => (
          <form key={form.team_code} className="rounded-lg border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-cyan-700">{form.team_code}</div>
                <h3 className="text-lg font-black text-slate-900">{form.title}</h3>
              </div>
              <StatusPill status={data.current_team_inputs.find((input) => input.team_code === form.team_code)?.raw_status} />
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {form.fields.slice(0, 10).map((field) => (
                <label key={field} className="text-xs font-black text-slate-600">
                  {field}
                  <input className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800" placeholder={field} />
                </label>
              ))}
            </div>
            <label className="mt-3 block text-xs font-black text-slate-600">
              หมายเหตุ
              <textarea className="mt-1 min-h-[82px] w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm" placeholder="บันทึกรายละเอียดเพิ่มเติม" />
            </label>
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-black text-slate-700">บันทึกร่าง</button>
              <button type="button" className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-black text-white">ส่งข้อมูลก่อน 15:00 น.</button>
            </div>
          </form>
        ))}
      </div>
    </Panel>
  );
}

function MissionsView({ data }) {
  return (
    <Panel title="กระดานติดตามภารกิจ" icon={LayoutGrid}>
      <div className="grid gap-3 xl:grid-cols-6">
        {MISSION_COLUMNS.map((column) => {
          const missions = data.missions.filter((mission) => mission.status === column.key);
          return (
            <div key={column.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h3 className="font-black text-slate-900">{column.label}</h3>
                <span className="rounded-full bg-white px-2 py-1 text-xs font-black text-slate-600">{missions.length}</span>
              </div>
              <div className="space-y-2">
                {missions.slice(0, 8).map((mission) => (
                  <article key={mission.id} className="rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="text-[11px] font-black text-cyan-700">{mission.mission_code}</div>
                    <h4 className="mt-1 text-sm font-black text-slate-900">{mission.mission_name}</h4>
                    <p className="mt-1 text-xs font-semibold text-slate-500">{mission.area}</p>
                    <div className="mt-3 h-2 rounded-full bg-slate-100"><div className="h-2 rounded-full bg-cyan-600" style={{ width: `${mission.progress_percent}%` }} /></div>
                    <div className="mt-2 flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>{mission.assigned_team}</span>
                      <span>{mission.priority}</span>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function MeetingsView({ data, compact = false }) {
  return (
    <Panel title="บันทึกการประชุมและข้อสั่งการ" icon={MessageSquareText}>
      <div className="grid gap-3 xl:grid-cols-2">
        {data.meeting_notes.slice(0, compact ? 2 : 5).map((note) => (
          <article key={note.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <div className="text-xs font-black text-cyan-700">{formatThaiDate(note.meeting_date)} เวลา {note.meeting_time} น.</div>
                <h3 className="mt-1 font-black text-slate-900">ประชุมห้องบัญชาการ วันที่ {note.id}</h3>
              </div>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-black text-emerald-700">{note.followup_status}</span>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{note.situation_summary}</p>
            <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm leading-6 text-slate-700">
              <b>ข้อสั่งการ:</b> {note.orders}
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function DecisionsView({ data }) {
  return (
    <Panel title="บันทึกการตัดสินใจ" icon={Target}>
      <div className="space-y-3">
        {data.decisions.map((decision) => (
          <article key={decision.id} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black text-cyan-700">{formatThaiDateTime(decision.decision_datetime)}</div>
                <h3 className="mt-1 font-black text-slate-900">{decision.issue}</h3>
              </div>
              <span className="rounded-full border border-blue-200 bg-blue-50 px-2 py-1 text-xs font-black text-blue-700">{decision.status}</span>
            </div>
            <div className="mt-3 grid gap-3 md:grid-cols-3">
              <Detail label="ข้อมูลประกอบ" value={decision.supporting_data} />
              <Detail label="การตัดสินใจ" value={decision.decision} />
              <Detail label="ทีมที่รับผิดชอบ" value={decision.assigned_team} />
            </div>
          </article>
        ))}
      </div>
    </Panel>
  );
}

function ReportsView({ data }) {
  return (
    <div className="space-y-4">
      <Panel title="สร้างรายงาน" icon={FileSpreadsheet}>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          {data.reports.daily_situation_reports.map((report) => (
            <article key={report.id} className="rounded-lg border border-slate-200 bg-white p-4">
              <div className="text-xs font-black text-cyan-700">{report.report_type}</div>
              <h3 className="mt-1 font-black text-slate-900">{formatThaiDate(report.report_date)}</h3>
              <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-600">{report.summary}</p>
              <div className="mt-3 flex flex-wrap gap-1">
                {report.export_formats.map((format) => <span key={format} className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-black text-slate-600">{format}</span>)}
              </div>
              <button type="button" className="mt-3 w-full rounded-lg bg-cyan-700 px-3 py-2 text-xs font-black text-white">สร้างรายงาน</button>
            </article>
          ))}
        </div>
      </Panel>
      <Panel title="รายงานสรุปเหตุการณ์" icon={FileText}>
        <div className="grid gap-3 md:grid-cols-4">
          <InfoCard icon={CalendarClock} label="จำนวนวันเปิด EOC" value={`${data.reports.session_summary_report.coverage_days} วัน`} />
          <InfoCard icon={Users} label="ประชาชนกระทบสะสม" value={formatNumber(data.reports.session_summary_report.cumulative_population)} />
          <InfoCard icon={Send} label="ภารกิจทั้งหมด" value={data.reports.session_summary_report.mission_total} />
          <InfoCard icon={ClipboardList} label="ข้อสั่งการทั้งหมด" value={data.reports.session_summary_report.order_total} />
        </div>
      </Panel>
    </div>
  );
}

function DailySituationHeader({ data }) {
  const summary = data.selected_summary;
  return (
    <Panel title="สรุปสถานการณ์ประจำวัน" icon={Gauge}>
      <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-8">
        <InfoCard icon={CalendarClock} label="วันที่ประชุม" value={formatThaiDate(summary.report_date)} compact />
        <InfoCard icon={Clock3} label="ลำดับวัน" value={summary.day_no} compact />
        <InfoCard icon={MonitorCog} label="สถานะ EOC" value={data.session.eoc_status} compact />
        <InfoCard icon={ShieldCheck} label="ระดับ EOC" value={data.session.eoc_level} compact />
        <InfoCard icon={Database} label="ความครบถ้วน" value={`${summary.data_completeness_score}%`} compact />
        <InfoCard icon={CheckCircle2} label="ทีมส่งแล้ว" value={summary.submitted_team_count} compact />
        <InfoCard icon={AlertTriangle} label="ทีมยังไม่ส่ง" value={summary.missing_team_count} compact tone="red" />
        <InfoCard icon={ClipboardList} label="รอตรวจสอบ" value={summary.need_review_count} compact tone="cyan" />
      </div>
    </Panel>
  );
}

function SituationMap({ reports, shelters, healthFacilities }) {
  return (
    <Panel title="แผนที่สถานการณ์" icon={Map}>
      <div className="relative min-h-[420px] overflow-hidden rounded-lg border border-slate-200 bg-[#dff3fb]">
        <div className="absolute inset-4 rounded-[32px] border-2 border-cyan-700/35 bg-cyan-50/70" />
        {reports.slice(0, 18).map((report, index) => (
          <div
            key={report.id}
            className={`absolute flex h-8 w-8 items-center justify-center rounded-full border-2 border-white text-[10px] font-black text-white shadow-lg ${report.severity_level === "critical" ? "bg-red-600" : report.severity_level === "high" ? "bg-orange-500" : "bg-yellow-500"}`}
            style={{ left: `${10 + (index % 6) * 14}%`, top: `${18 + Math.floor(index / 6) * 22}%` }}
            title={`${report.district} ${report.water_level_cm} ซม.`}
          >
            {report.water_level_cm}
          </div>
        ))}
        {shelters.slice(0, 6).map((shelter, index) => (
          <div key={shelter.id} className="absolute rounded-md bg-blue-700 px-2 py-1 text-[10px] font-black text-white shadow" style={{ right: `${8 + (index % 3) * 18}%`, top: `${18 + Math.floor(index / 3) * 28}%` }}>
            ศพ {shelter.current_occupancy}
          </div>
        ))}
        {healthFacilities.slice(0, 5).map((facility, index) => (
          <div key={facility.id} className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-xs font-black text-white shadow" style={{ left: `${18 + index * 13}%`, bottom: `${14 + (index % 2) * 16}%` }}>
            +
          </div>
        ))}
        <div className="absolute bottom-3 left-3 rounded-lg bg-white/95 p-3 text-xs font-bold text-slate-700 shadow">
          <div className="mb-2 font-black text-slate-900">คำอธิบายสัญลักษณ์</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-red-600" /> น้ำวิกฤต</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-orange-500" /> เสี่ยงสูง</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded bg-blue-700" /> ศูนย์พักพิง</div>
          <div className="flex items-center gap-2"><span className="h-3 w-3 rounded-full bg-emerald-600" /> หน่วยบริการสุขภาพ</div>
        </div>
      </div>
    </Panel>
  );
}

function TeamStatusTable({ inputs, wide = false }) {
  return (
    <div className="overflow-x-auto">
      <table className={`w-full text-sm ${wide ? "min-w-[1080px]" : "min-w-[760px]"}`}>
        <thead className="text-left text-xs font-black uppercase text-slate-500">
          <tr>
            <th className="p-2">ทีม</th><th className="p-2">รายการข้อมูลหลัก</th><th className="p-2">กำหนดส่ง</th><th className="p-2">สถานะ</th><th className="p-2">ส่งล่าสุด</th><th className="p-2">ผู้ส่ง</th><th className="p-2">ตรวจสอบ</th><th className="p-2">หมายเหตุ</th>
          </tr>
        </thead>
        <tbody>
          {inputs.map((input) => (
            <tr key={input.id} className="border-t border-slate-100">
              <td className="p-2 font-black text-slate-900">{input.team_code}<div className="text-xs font-semibold text-slate-500">{input.team_name}</div></td>
              <td className="p-2 max-w-[320px] text-slate-600">{input.required_data_name}</td>
              <td className="p-2 font-bold">15:00</td>
              <td className="p-2"><StatusPill status={input.raw_status} /></td>
              <td className="p-2">{input.submitted_at ? formatThaiDateTime(input.submitted_at) : "-"}</td>
              <td className="p-2">{input.submitted_by}</td>
              <td className="p-2">{input.reviewed_by}</td>
              <td className="p-2">{input.remarks}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MissingDataAlert({ items }) {
  return (
    <Panel title="แจ้งเตือนข้อมูลที่ยังขาด" icon={AlertTriangle}>
      <div className="space-y-2">
        {items.slice(0, 10).map((item) => (
          <div key={item.id} className={`rounded-lg border p-3 ${item.severity === "critical" ? STATUS_CLASS.red : item.severity === "high" ? STATUS_CLASS.orange : STATUS_CLASS.yellow}`}>
            <div className="text-xs font-black">{item.team_code}</div>
            <div className="mt-1 text-sm font-bold text-slate-900">{item.issue}</div>
            <div className="mt-1 text-xs font-semibold">{item.action}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function DecisionQueue({ decisions }) {
  return (
    <Panel title="รายการรอการตัดสินใจ" icon={Target}>
      <div className="space-y-2">
        {decisions.slice(0, 5).map((decision) => (
          <div key={decision.id} className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-sm font-black text-slate-900">{decision.issue}</div>
            <div className="mt-1 text-xs font-semibold leading-5 text-slate-600">{decision.decision}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function MissionStatusSummary({ missions }) {
  return (
    <Panel title="สถานะภารกิจ" icon={Send}>
      <div className="grid grid-cols-2 gap-2">
        {MISSION_COLUMNS.map((column) => (
          <div key={column.key} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <div className="text-xs font-black text-slate-500">{column.label}</div>
            <div className="mt-1 text-2xl font-black text-slate-900">{missions.filter((mission) => mission.status === column.key).length}</div>
          </div>
        ))}
      </div>
    </Panel>
  );
}

function TeamSummaryPanels({ teams, inputs }) {
  return (
    <Panel title="สรุปข้อมูลรายทีม" icon={Users}>
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {teams.map((team) => {
          const input = inputs.find((item) => item.team_code === team.team_code);
          return (
            <div key={team.team_code} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="text-xs font-black text-cyan-700">{team.team_code}</div>
                  <h3 className="font-black text-slate-900">{team.team_name_th}</h3>
                </div>
                <StatusPill status={input?.raw_status} />
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-slate-600">{input?.required_data_name}</p>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

function InfoCard({ icon: Icon, label, value, detail, tone = "cyan", compact = false }) {
  const toneClass = tone === "red" ? "border-red-200 bg-red-50 text-red-800" : tone === "orange" ? "border-orange-200 bg-orange-50 text-orange-800" : "border-slate-200 bg-white text-slate-900";
  return (
    <div className={`rounded-lg border p-3 shadow-sm ${toneClass}`}>
      <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wide text-slate-500">
        <Icon className="h-4 w-4" />
        {label}
      </div>
      <div className={`mt-2 font-black ${compact ? "text-xl" : "text-2xl"}`}>{value}</div>
      {detail && <div className="mt-1 text-xs font-semibold text-slate-500">{detail}</div>}
    </div>
  );
}

function Panel({ title, icon: Icon, children }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
      <div className="mb-3 flex items-center gap-2">
        <Icon className="h-5 w-5 text-cyan-700" />
        <h2 className="text-lg font-black text-slate-900">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <div className="text-xs font-black text-slate-500">{label}</div>
      <div className="mt-1 text-sm font-semibold leading-6 text-slate-700">{value}</div>
    </div>
  );
}
