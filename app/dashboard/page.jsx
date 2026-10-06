"use client";

// หน้าหลักเจ้าหน้าที่: ตอบ 3 คำถามแรกหลังเข้าสู่ระบบ
//   1) ตอนนี้มีเหตุการณ์อะไรเปิดอยู่ และสถานการณ์เป็นอย่างไร
//   2) มีงานอะไรรอเราอยู่
//   3) จะเข้าไปทำงานในเหตุการณ์ไหน (เจ้าหน้าที่ต้องเลือกเหตุการณ์ก่อนเข้า เพื่อไม่ให้บันทึกผิดครั้ง)
import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Activity, ArrowRight, Car, ChevronRight, Droplets, Inbox, ListChecks, RefreshCw, Sun } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import CitizenDashboard from "@/components/CitizenDashboard";
import { getOperationSessionLock, setOperationSessionLock } from "@/lib/eocSessionLock";

const EOC_MODULES = [
  { key: "flood", name: "อุทกภัยน้ำท่วม", icon: Droplets, path: "/eoc/flood/overview", hasBoard: true, description: "พื้นที่ประสบภัย ศูนย์พักพิง สุขภาพ และเวชภัณฑ์" },
  { key: "disease", name: "โรคระบาด", icon: Activity, path: "/eoc/disease", description: "รายงานผู้ป่วยและการเฝ้าระวังรายวัน" },
  { key: "festival-accidents", name: "อุบัติเหตุช่วงเทศกาล", icon: Car, path: "#", comingSoon: true, description: "7 วันอันตราย ปีใหม่ / สงกรานต์" },
  { key: "drought", name: "ภัยแล้ง", icon: Sun, path: "#", comingSoon: true, description: "พื้นที่ขาดแคลนน้ำ" }
];

const LEVEL = {
  critical: { label: "วิกฤต", cls: "bg-red-700 text-white" },
  serious: { label: "เร่งด่วน", cls: "bg-red-50 text-red-800 ring-1 ring-red-200" },
  warning: { label: "เฝ้าระวัง", cls: "bg-amber-50 text-amber-900 ring-1 ring-amber-200" },
  info: { label: "ข้อมูล", cls: "bg-slate-100 text-slate-700" }
};

const HEADLINE_TONE = {
  red: "border-red-200 bg-red-50 text-red-900",
  amber: "border-amber-200 bg-amber-50 text-amber-950",
  green: "border-emerald-200 bg-emerald-50 text-emerald-900",
  gray: "border-slate-200 bg-slate-50 text-slate-700"
};

const REVIEWER_ROLES = ["admin", "commander", "MCATT", "SAT", "SeRHT", "staff"];

function thaiDate(value, options = { day: "numeric", month: "short", year: "numeric" }) {
  if (!value) return "-";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "-" : date.toLocaleDateString("th-TH", options);
}

function daysSince(value) {
  if (!value) return null;
  const start = new Date(value);
  if (Number.isNaN(start.getTime())) return null;
  return Math.max(1, Math.floor((Date.now() - start.getTime()) / 86400000) + 1);
}

function sessionOptionLabel(item) {
  const range = `${thaiDate(item.opened_at)} – ${item.closed_at ? thaiDate(item.closed_at) : "ปัจจุบัน"}`;
  return `ครั้งที่ ${item.session_number || item.id} · ${item.status === "active" ? "เปิดอยู่" : "ปิดแล้ว"} · ${range}`;
}

export default function DashboardPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const { eocStatus, loading: eocLoading } = useEOC();
  const [sessions, setSessions] = useState({});
  const [selected, setSelected] = useState({});
  const [loadingSessions, setLoadingSessions] = useState({});
  const [boards, setBoards] = useState({});
  const [pendingReports, setPendingReports] = useState(null);
  const [entryError, setEntryError] = useState("");

  const isOperationalUser = user?.role !== "admin" && user?.role !== "citizen";

  useEffect(() => {
    if (!loading && !user) router.push("/login");
  }, [user, loading, router]);

  // รายการเหตุการณ์ของแต่ละประเภท (เจ้าหน้าที่ต้องเลือกก่อนเข้า)
  useEffect(() => {
    if (loading || !user || !isOperationalUser) return;
    EOC_MODULES.filter((item) => !item.comingSoon).forEach(async (module) => {
      setLoadingSessions((prev) => ({ ...prev, [module.key]: true }));
      try {
        const response = await fetch(`/stn-eoc/api/eoc/sessions?type=${module.key}&limit=100`);
        const result = await response.json();
        const list = result.success && Array.isArray(result.data) ? result.data : [];
        setSessions((prev) => ({ ...prev, [module.key]: list }));
        const lock = getOperationSessionLock();
        const locked = lock?.moduleType === module.key ? list.find((item) => Number(item.id) === Number(lock.sessionId)) : null;
        const fallback = list.find((item) => item.status === "active") || list[0] || null;
        const pick = locked || fallback;
        if (pick) setSelected((prev) => ({ ...prev, [module.key]: Number(pick.id) }));
      } catch (error) {
        console.error(`Error loading sessions for ${module.key}:`, error);
        setSessions((prev) => ({ ...prev, [module.key]: [] }));
      } finally {
        setLoadingSessions((prev) => ({ ...prev, [module.key]: false }));
      }
    });
  }, [isOperationalUser, loading, user]);

  const activeModules = useMemo(
    () => EOC_MODULES.filter((module) => !module.comingSoon && eocStatus?.[module.key]?.is_active),
    [eocStatus]
  );
  const otherModules = EOC_MODULES.filter((module) => !activeModules.includes(module));

  // สรุปสถานการณ์ของเหตุการณ์ที่เปิดอยู่ (ใช้ชุดเดียวกับหน้าภาพรวมสถานการณ์)
  const loadBoards = useCallback(async () => {
    const targets = activeModules.filter((module) => module.hasBoard);
    await Promise.all(targets.map(async (module) => {
      setBoards((prev) => ({ ...prev, [module.key]: { ...(prev[module.key] || {}), loading: true } }));
      try {
        const response = await fetch(`/stn-eoc/api/eoc/situation-board/?eoc=${module.key}`, { cache: "no-store" });
        const json = await response.json();
        setBoards((prev) => ({ ...prev, [module.key]: { loading: false, data: json.success ? json : null } }));
      } catch {
        setBoards((prev) => ({ ...prev, [module.key]: { loading: false, data: null } }));
      }
    }));
  }, [activeModules]);

  useEffect(() => {
    if (!user || user.role === "citizen" || eocLoading) return;
    loadBoards();
  }, [user, eocLoading, loadBoards]);

  useEffect(() => {
    if (!user || !REVIEWER_ROLES.includes(user.role)) return;
    fetch("/stn-eoc/api/admin/incident-reports?status=pending&limit=1")
      .then((response) => (response.ok ? response.json() : null))
      .then((json) => setPendingReports(json?.success ? Number(json.pagination?.total || 0) : null))
      .catch(() => setPendingReports(null));
  }, [user]);

  // ล็อกเหตุการณ์ที่เลือกก่อนเข้าไปทำงาน แล้วค่อยไปหน้าเป้าหมาย
  const enter = (module, href = module.path) => {
    if (!isOperationalUser) {
      router.push(href);
      return;
    }
    const list = sessions[module.key] || [];
    const session = list.find((item) => Number(item.id) === Number(selected[module.key]));
    if (!session) {
      setEntryError(`เลือกเหตุการณ์ของ${module.name}ก่อนเข้าหน้าปฏิบัติการ`);
      return;
    }
    setOperationSessionLock({
      moduleType: module.key,
      sessionId: session.id,
      sessionNumber: session.session_number,
      sessionStatus: session.status,
      sessionOpenedAt: session.opened_at
    });
    setEntryError("");
    router.push(href);
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f8fc]">
        <div className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 animate-spin rounded-full border-2 border-[#c9dcee] border-t-[#0b4c86]" />
          <p className="text-slate-600">กำลังโหลด…</p>
        </div>
      </div>
    );
  }
  if (!user) return null;

  if (user.role === "citizen") {
    return (
      <EOCLayout>
        <div className="mx-auto max-w-7xl p-4 sm:p-6"><CitizenDashboard /></div>
      </EOCLayout>
    );
  }

  const displayName = `${user.title || ""}${user.givenName || ""} ${user.familyName || ""}`.trim() || user.username;
  const tasks = buildTasks({ pendingReports, boards, activeModules });

  return (
    <EOCLayout>
      <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
        <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <div className="mb-1 text-sm font-semibold text-[#0b4c86]">หน้าหลัก</div>
            <h1 className="text-2xl font-black text-slate-900 sm:text-[1.7rem]">สวัสดี {displayName}</h1>
            <p className="mt-1 text-sm text-slate-600">
              {[user.roleDisplay || user.role, user.position, user.department].filter(Boolean).join(" · ")}
            </p>
          </div>
          <p className="shrink-0 text-sm font-semibold text-slate-600">{thaiDate(new Date(), { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
        </header>

        {entryError ? (
          <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-800" role="alert">{entryError}</p>
        ) : null}

        <section aria-labelledby="active-title" className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 id="active-title" className="text-lg font-black text-slate-900">เหตุการณ์ที่เปิดอยู่</h2>
            {activeModules.some((module) => module.hasBoard) ? (
              <button type="button" onClick={loadBoards} className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0b4c86] hover:underline">
                <RefreshCw className="h-4 w-4" aria-hidden="true" /> ดึงข้อมูลล่าสุด
              </button>
            ) : null}
          </div>

          {eocLoading ? (
            <div className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />
          ) : activeModules.length ? (
            activeModules.map((module) => (
              <ActiveEventCard
                key={module.key}
                module={module}
                status={eocStatus?.[module.key]}
                board={boards[module.key]}
                isOperationalUser={isOperationalUser}
                sessions={sessions[module.key] || []}
                selectedId={selected[module.key] || ""}
                loadingSessions={Boolean(loadingSessions[module.key])}
                onSelect={(value) => setSelected((prev) => ({ ...prev, [module.key]: Number(value) }))}
                onEnter={(href) => enter(module, href)}
              />
            ))
          ) : (
            <div className="rounded-xl border border-dashed border-[#c9dcee] bg-white px-5 py-6">
              <p className="font-bold text-slate-900">ขณะนี้ไม่มี EOC เปิดอยู่</p>
              <p className="mt-1 text-sm text-slate-600">
                เมื่อผู้บัญชาการเปิดเหตุการณ์ จะแสดงที่นี่พร้อมสรุปสถานการณ์ ระหว่างนี้ดูข้อมูลเหตุการณ์ย้อนหลังได้จากรายการด้านล่าง
              </p>
            </div>
          )}
        </section>

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
          <section aria-labelledby="tasks-title" className="rounded-xl border border-slate-200 bg-white">
            <h2 id="tasks-title" className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 text-base font-black text-slate-900">
              <ListChecks className="h-5 w-5 text-[#0b4c86]" aria-hidden="true" /> งานที่รอดำเนินการ
            </h2>
            {tasks.length ? (
              <ul className="divide-y divide-slate-100">
                {tasks.map((task) => (
                  <li key={task.key}>
                    <button
                      type="button"
                      onClick={() => (task.module ? enter(task.module, task.href) : router.push(task.href))}
                      className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-[#edf5fc] focus-visible:bg-[#edf5fc] focus-visible:outline-none"
                    >
                      <span className={`flex h-9 min-w-9 items-center justify-center rounded-lg px-2 text-sm font-black ${task.urgent ? "bg-red-700 text-white" : "bg-[#edf5fc] text-[#083865]"}`}>{task.count}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold text-slate-900">{task.title}</span>
                        {task.detail ? <span className="block truncate text-xs text-slate-500">{task.detail}</span> : null}
                      </span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="flex items-center gap-2 px-4 py-6 text-sm text-slate-600">
                <Inbox className="h-5 w-5 text-slate-400" aria-hidden="true" /> ไม่มีงานค้างในตอนนี้
              </p>
            )}
          </section>

          <section aria-labelledby="modules-title" className="rounded-xl border border-slate-200 bg-white">
            <h2 id="modules-title" className="border-b border-slate-200 px-4 py-3 text-base font-black text-slate-900">
              {activeModules.length ? "เหตุการณ์ประเภทอื่น" : "ประเภทเหตุการณ์"}
            </h2>
            <ul className="divide-y divide-slate-100">
              {otherModules.map((module) => (
                <ModuleRow
                  key={module.key}
                  module={module}
                  isOperationalUser={isOperationalUser}
                  sessions={sessions[module.key] || []}
                  selectedId={selected[module.key] || ""}
                  loadingSessions={Boolean(loadingSessions[module.key])}
                  onSelect={(value) => setSelected((prev) => ({ ...prev, [module.key]: Number(value) }))}
                  onEnter={() => enter(module)}
                />
              ))}
            </ul>
          </section>
        </div>
      </div>
    </EOCLayout>
  );
}

// งานค้างที่ควรเห็นทันทีหลังเข้าสู่ระบบ
function buildTasks({ pendingReports, boards, activeModules }) {
  const tasks = [];
  if (pendingReports) {
    tasks.push({ key: "reports", count: pendingReports, title: "คำขอจากประชาชนรอตรวจ", detail: "คำขอความช่วยเหลือและจุดปัญหาที่ยังไม่มีผู้รับเรื่อง", href: "/admin/incident-reports?status=pending", urgent: true });
  }
  for (const mod of activeModules) {
    const data = boards[mod.key]?.data;
    if (!data) continue;
    if (data.setup && !data.setup.complete) {
      const left = data.setup.total - data.setup.done;
      tasks.push({ key: `${mod.key}-setup`, count: left, title: "ขั้นตอนหลังเปิด EOC ที่ยังไม่ครบ", detail: `${mod.name} · ทำแล้ว ${data.setup.done}/${data.setup.total}`, href: mod.path, module: mod });
    }
    if (data.directives?.open) {
      tasks.push({ key: `${mod.key}-directives`, count: data.directives.open, title: "ข้อสั่งการที่ยังไม่ดำเนินการ", detail: `${mod.name}${data.directives.date ? ` · รายงานวันที่ ${thaiDate(data.directives.date)}` : ""}`, href: `/eoc/${mod.key}/management/directives`, module: mod });
    }
    if (data.completeness && data.completeness.total && data.completeness.percent < 100) {
      tasks.push({ key: `${mod.key}-completeness`, count: `${data.completeness.percent}%`, title: "รายงานประจำวันยังไม่ครบ", detail: `${mod.name} · ส่งแล้ว ${data.completeness.reported}/${data.completeness.total} ตำบล`, href: `/eoc/${mod.key}/records`, module: mod });
    }
  }
  return tasks;
}

function SessionSelect({ id, sessions, value, loading, onChange }) {
  return (
    <select
      id={id}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      disabled={loading || sessions.length === 0}
      className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-800 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#0b4c86]/15 disabled:bg-slate-100"
    >
      {loading ? <option value="">กำลังโหลดเหตุการณ์…</option> : null}
      {!loading && sessions.length === 0 ? <option value="">ยังไม่มีเหตุการณ์</option> : null}
      {sessions.map((item) => <option key={item.id} value={item.id}>{sessionOptionLabel(item)}</option>)}
    </select>
  );
}

function ActiveEventCard({ module, status, board, isOperationalUser, sessions, selectedId, loadingSessions, onSelect, onEnter }) {
  const Icon = module.icon;
  const days = daysSince(status?.activated_at);
  const data = board?.data;
  const agenda = (data?.agenda || []).slice(0, 3);
  const selectedSession = sessions.find((item) => Number(item.id) === Number(selectedId));
  const viewingPast = isOperationalUser && selectedSession && selectedSession.status !== "active";

  return (
    <article className="overflow-hidden rounded-xl border border-[#c9dcee] bg-white">
      <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4 p-5">
          <div className="flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#edf5fc] text-[#0b4c86]">
              <Icon className="h-6 w-6" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <h3 className="text-xl font-black text-slate-900">
                {module.name}{status?.session_number ? ` ครั้งที่ ${status.session_number}` : ""}
              </h3>
              <p className="text-sm text-slate-600">
                <span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-500 align-middle" aria-hidden="true" />
                เปิดอยู่{days ? ` · วันที่ ${days} ของเหตุการณ์` : ""}{status?.activated_at ? ` · เริ่ม ${thaiDate(status.activated_at)}` : ""}
                {module.key === "disease" && status?.disease_name ? ` · เฝ้าระวัง${status.disease_name}` : ""}
              </p>
            </div>
          </div>

          {module.hasBoard ? (
            board?.loading && !data ? (
              <div className="space-y-2" aria-hidden="true">
                <div className="h-12 animate-pulse rounded-lg bg-slate-100" />
                <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
              </div>
            ) : data ? (
              <>
                <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${HEADLINE_TONE[data.headline?.tone] || HEADLINE_TONE.gray}`}>
                  {data.headline?.text}
                </div>
                {agenda.length ? (
                  <div>
                    <div className="mb-1.5 flex items-baseline justify-between gap-2">
                      <h4 className="text-sm font-bold text-slate-800">เรื่องที่ต้องตัดสินใจ</h4>
                      {data.agendaTotal > agenda.length ? <span className="text-xs text-slate-500">อีก {data.agendaTotal - agenda.length} เรื่องในหน้าภาพรวม</span> : null}
                    </div>
                    <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                      {agenda.map((item, index) => {
                        const level = LEVEL[item.level] || LEVEL.info;
                        return (
                          <li key={`${item.title}-${index}`}>
                            <button type="button" onClick={() => onEnter(item.href || module.path)} className="flex w-full items-start gap-2.5 px-3 py-2.5 text-left hover:bg-[#edf5fc]">
                              <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[11px] font-bold ${level.cls}`}>{level.label}</span>
                              <span className="min-w-0">
                                <span className="block text-sm font-semibold text-slate-900">{item.title}</span>
                                {item.detail ? <span className="block truncate text-xs text-slate-500">{item.module} · {item.detail}</span> : null}
                              </span>
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ) : (
                  <p className="text-sm text-slate-600">ยังไม่มีเรื่องที่ต้องตัดสินใจเร่งด่วน</p>
                )}
              </>
            ) : (
              <p className="text-sm text-slate-500">โหลดสรุปสถานการณ์ไม่สำเร็จ — เข้าหน้าภาพรวมเพื่อดูรายละเอียด</p>
            )
          ) : (
            <p className="text-sm text-slate-600">{module.description}</p>
          )}
        </div>

        <div className="flex flex-col justify-end gap-3 border-t border-[#c9dcee] bg-[#f7fbff] p-5 lg:border-l lg:border-t-0">
          {isOperationalUser ? (
            <div>
              <label htmlFor={`session-${module.key}`} className="mb-1 block text-xs font-bold text-slate-700">ทำงานในเหตุการณ์</label>
              <SessionSelect id={`session-${module.key}`} sessions={sessions} value={selectedId} loading={loadingSessions} onChange={onSelect} />
              {viewingPast ? <p className="mt-1 text-xs font-semibold text-amber-800">เลือกเหตุการณ์ที่ปิดแล้ว — ข้อมูลที่บันทึกจะเข้าเหตุการณ์ย้อนหลัง</p> : null}
            </div>
          ) : null}
          <button
            type="button"
            onClick={() => onEnter(module.path)}
            disabled={isOperationalUser && sessions.length === 0}
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#0b4c86] px-4 text-sm font-bold text-white hover:bg-[#083865] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#0b4c86]/40 disabled:cursor-not-allowed disabled:opacity-50"
          >
            เข้าหน้าปฏิบัติการ <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </button>
          {module.hasBoard ? (
            <Link href="/eoc/flood/meeting-brief" onClick={(event) => { event.preventDefault(); onEnter("/eoc/flood/meeting-brief"); }} className="text-center text-sm font-bold text-[#0b4c86] hover:underline">
              สรุปสำหรับห้องประชุม
            </Link>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function ModuleRow({ module, isOperationalUser, sessions, selectedId, loadingSessions, onSelect, onEnter }) {
  const Icon = module.icon;
  return (
    <li className={`flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center ${module.comingSoon ? "opacity-60" : ""}`}>
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
          <Icon className="h-5 w-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <div className="font-bold text-slate-900">{module.name}</div>
          <div className="truncate text-xs text-slate-500">{module.comingSoon ? "ยังไม่เปิดให้ใช้งานในระบบ" : `ปิดอยู่ · ${module.description}`}</div>
        </div>
      </div>
      {module.comingSoon ? null : (
        <div className="flex gap-2 sm:w-[340px]">
          {isOperationalUser ? (
            <div className="min-w-0 flex-1">
              <label htmlFor={`session-${module.key}`} className="sr-only">เลือกเหตุการณ์ของ{module.name}</label>
              <SessionSelect id={`session-${module.key}`} sessions={sessions} value={selectedId} loading={loadingSessions} onChange={onSelect} />
            </div>
          ) : null}
          <button
            type="button"
            onClick={onEnter}
            disabled={isOperationalUser && sessions.length === 0}
            className="inline-flex h-10 shrink-0 items-center gap-1 rounded-lg border border-slate-300 bg-white px-3 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isOperationalUser ? "ดูย้อนหลัง" : "เปิดดู"}
          </button>
        </div>
      )}
    </li>
  );
}
