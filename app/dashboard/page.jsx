"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Activity,
    ArrowRight,
    CalendarClock,
    Car,
    Droplets,
    Sun
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import CitizenDashboard from "@/components/CitizenDashboard";
import { getOperationSessionLock, setOperationSessionLock } from "@/lib/eocSessionLock";
import { EVENT_MODULES, groupMenuItems } from "@/src/config/navigation/admin-navigation";
import { MENU_ICONS } from "@/components/Sidebar";
import { ClipboardList, Flag } from "lucide-react";
import { UpdatedAt } from "@/components/admin/crud";
import { areaLabel, flagMeta, stageMeta } from "@/lib/floodTriggers";

// กำหนดเหตุการณ์ที่ระบบรองรับ
const EOC_MODULES = [
    {
        key: 'flood',
        name: 'อุทกภัยน้ำท่วม',
        icon: Droplets,
        description: 'ระบบติดตามสถานการณ์อุทกภัยน้ำท่วม พื้นที่ประสบภัย ศูนย์อพยพ',
        path: '/eoc/flood/overview',
        tone: 'blue',
        accentClass: 'bg-[#0b4c86]',
        iconClass: 'bg-[#edf5fc] text-[#0b4c86]',
        activeClass: 'border-[#c9dcee] bg-[#f7fbff]',
    },
    {
        key: 'disease',
        name: 'โรคระบาด',
        icon: Activity,
        description: 'ระบบติดตามสถานการณ์โรคระบาด รายงานผู้ป่วย และเฝ้าระวังรายวัน',
        path: '/eoc/disease',
        tone: 'emerald',
        accentClass: 'bg-[#0b4c86]',
        iconClass: 'bg-[#edf5fc] text-[#0b4c86]',
        activeClass: 'border-[#c9dcee] bg-[#f7fbff]',
    },
    {
        key: 'festival-accidents',
        name: 'อุบัติเหตุช่วงเทศกาล',
        icon: Car,
        description: 'ระบบติดตามอุบัติเหตุ 7 วันอันตราย ปีใหม่ / สงกรานต์',
        path: '/eoc/festival-accidents',
        tone: 'rose',
        accentClass: 'bg-[#0b4c86]',
        iconClass: 'bg-[#edf5fc] text-[#0b4c86]',
        activeClass: 'border-[#c9dcee] bg-[#f7fbff]',
    },
    {
        key: 'drought',
        name: 'ภัยแล้ง',
        icon: Sun,
        description: 'ระบบติดตามสถานการณ์ภัยแล้ง พื้นที่ขาดแคลนน้ำ',
        path: '#',
        tone: 'amber',
        accentClass: 'bg-slate-300',
        iconClass: 'bg-slate-100 text-slate-500',
        activeClass: 'border-[#c9dcee] bg-[#f7fbff]',
        comingSoon: true,
    },
];

export default function DashboardPage() {
    const router = useRouter();
    const { user, loading } = useAuth();
    const { eocStatus, loading: eocLoading } = useEOC();
    const [moduleSessions, setModuleSessions] = useState({});
    const [selectedSessions, setSelectedSessions] = useState({});
    const [loadingModuleSessions, setLoadingModuleSessions] = useState({});
    const [entryError, setEntryError] = useState("");

    const isOperationalUser = user?.role !== 'admin' && user?.role !== 'citizen';

    // Redirect if not logged in
    useEffect(() => {
        if (!loading && !user) {
            router.push("/login");
        }
    }, [user, loading, router]);

    useEffect(() => {
        if (loading || !user || !isOperationalUser) return;

        const modulesToLoad = EOC_MODULES.filter((item) => !item.comingSoon);
        modulesToLoad.forEach(async (module) => {
            setLoadingModuleSessions((prev) => ({ ...prev, [module.key]: true }));
            try {
                const response = await fetch(`/stn-eoc/api/eoc/sessions?type=${module.key}&limit=100`);
                const result = await response.json();
                const sessions = result.success ? (Array.isArray(result.data) ? result.data : []) : [];

                setModuleSessions((prev) => ({
                    ...prev,
                    [module.key]: sessions
                }));

                const lock = getOperationSessionLock();
                const defaultSession = sessions.find((item) => item.status === 'active') || sessions[0] || null;
                const lockedSession = lock?.moduleType === module.key
                    ? sessions.find((item) => Number(item.id) === Number(lock.sessionId))
                    : null;
                const selected = lockedSession || defaultSession;

                if (selected) {
                    setSelectedSessions((prev) => ({
                        ...prev,
                        [module.key]: Number(selected.id)
                    }));
                }
            } catch (error) {
                console.error(`Error loading sessions for ${module.key}:`, error);
                setModuleSessions((prev) => ({ ...prev, [module.key]: [] }));
            } finally {
                setLoadingModuleSessions((prev) => ({ ...prev, [module.key]: false }));
            }
        });
    }, [isOperationalUser, loading, user]);

    const handleSelectSession = (moduleKey, sessionId) => {
        setSelectedSessions((prev) => ({
            ...prev,
            [moduleKey]: Number(sessionId)
        }));
    };

    // ทางลัดจากแถบ "เหตุการณ์ที่เปิดอยู่": ล็อกเหตุการณ์ที่เปิดอยู่ให้อัตโนมัติ แล้วไปหน้าที่เลือก
    const handleQuickEnter = (module, path) => {
        if (isOperationalUser) {
            const active = (moduleSessions[module.key] || []).find((item) => item.status === 'active');
            if (active) {
                setOperationSessionLock({
                    moduleType: module.key,
                    sessionId: active.id,
                    sessionNumber: active.session_number,
                    sessionStatus: active.status,
                    sessionOpenedAt: active.opened_at
                });
            }
        }
        router.push(path);
    };

    const handleEnterOperations = (module) => {
        if (!isOperationalUser) {
            router.push(module.path);
            return;
        }

        const selectedSessionId = selectedSessions[module.key];
        const sessions = moduleSessions[module.key] || [];
        const selectedSession = sessions.find((item) => Number(item.id) === Number(selectedSessionId));

        if (!selectedSession) {
            setEntryError(`กรุณาเลือกเหตุการณ์ EOC ของ${module.name}ก่อนเข้าสู่หน้าปฏิบัติการ`);
            return;
        }

        setOperationSessionLock({
            moduleType: module.key,
            sessionId: selectedSession.id,
            sessionNumber: selectedSession.session_number,
            sessionStatus: selectedSession.status,
            sessionOpenedAt: selectedSession.opened_at
        });
        setEntryError("");
        router.push(module.path);
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-2 border-[#c9dcee] border-t-[#0b4c86] mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const activeModules = EOC_MODULES.filter((mod) => eocStatus?.[mod.key]?.is_active).length;
    const currentDateLabel = new Date().toLocaleDateString('th-TH', {
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <EOCLayout>
            <div className="mx-auto max-w-7xl p-4 sm:p-6">
                {user.role === 'citizen' ? (
                    <CitizenDashboard />
                ) : (
                    <>
                        <header className="mb-4 flex flex-wrap items-end justify-between gap-3">
                            <div className="min-w-0">
                                <p className="text-sm font-semibold text-[#0b4c86]">
                                    สวัสดี {`${user.title || ''}${user.givenName || ''} ${user.familyName || ''}`.trim() || user.username}
                                    <span className="font-normal text-slate-500"> · {user.roleDisplay || user.role}{user.department ? ` · ${user.department}` : ''}</span>
                                </p>
                                <h1 className="text-2xl font-black text-slate-900 sm:text-3xl">
                                    {activeModules ? 'เหตุการณ์ที่กำลังปฏิบัติงาน' : 'ยังไม่มีเหตุการณ์ที่เปิดอยู่'}
                                </h1>
                            </div>
                            <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700">
                                <CalendarClock className="h-4 w-4" aria-hidden="true" />
                                {currentDateLabel}
                            </div>
                        </header>

                        <ActiveEvents
                            loading={eocLoading}
                            modules={EOC_MODULES.filter((mod) => eocStatus?.[mod.key]?.is_active)}
                            eocStatus={eocStatus}
                            onEnter={handleQuickEnter}
                        />

                        {/* EOC Event Modules */}
                        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-black text-slate-900">ทุกประเภทเหตุการณ์</h2>
                                    <p className="text-sm text-slate-500">ระบบจะแสดงเฉพาะหน้าปฏิบัติการที่พร้อมใช้งาน และสำหรับเจ้าหน้าที่จะต้องเลือกเหตุการณ์ก่อนเข้าใช้งาน</p>
                                </div>
                            </div>
                            {entryError && (
                                <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                                    {entryError}
                                </div>
                            )}
                            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
                                {EOC_MODULES.map(mod => {
                                    const status = eocStatus?.[mod.key];
                                    const isActive = status?.is_active || false;

                                    return (
                                        <EventModuleCard
                                            key={mod.key}
                                            module={mod}
                                            isActive={isActive}
                                            eocLoading={eocLoading}
                                            sessionInfo={status}
                                            isOperationalUser={isOperationalUser}
                                            sessions={moduleSessions[mod.key] || []}
                                            selectedSessionId={selectedSessions[mod.key] || ""}
                                            loadingSessions={Boolean(loadingModuleSessions[mod.key])}
                                            onSelectSession={handleSelectSession}
                                            onEnterOperations={handleEnterOperations}
                                        />
                                    );
                                })}
                            </div>
                        </div>
                    </>
                )}
            </div>
        </EOCLayout>
    );
}

function EventModuleCard({
    module,
    isActive,
    eocLoading,
    sessionInfo,
    isOperationalUser,
    sessions,
    selectedSessionId,
    loadingSessions,
    onSelectSession,
    onEnterOperations
}) {
    const Icon = module.icon;
    const statusLabel = module.comingSoon ? 'ยังไม่เปิดให้ใช้งาน' : isActive ? 'เปิดใช้งาน' : 'ปิดอยู่';
    const statusClass = module.comingSoon
        ? 'bg-slate-100 text-slate-500'
        : isActive
            ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200'
            : 'bg-slate-100 text-slate-500';

    const content = (
        <div
            className={`group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-xl border bg-white transition ${
                module.comingSoon
                    ? 'border-dashed border-slate-300 bg-slate-50/60'
                    : isActive
                        ? `${module.activeClass} shadow-sm hover:shadow-md`
                        : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
            }`}
        >
            <div className={`h-1.5 ${module.comingSoon ? 'bg-transparent' : isActive ? 'bg-[#0b4c86]' : 'bg-slate-200'}`} />

            <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${isActive ? 'bg-[#0b4c86] text-white' : module.comingSoon ? 'bg-slate-100 text-slate-400' : 'bg-slate-100 text-slate-600'}`}>
                        <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={2.2} />
                    </div>
                    {eocLoading ? (
                        <div className="h-7 w-20 animate-pulse rounded-full bg-slate-200" />
                    ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
                            {isActive && <span className="h-2 w-2 rounded-full bg-emerald-500" />}
                            {statusLabel}
                        </span>
                    )}
                </div>

                <h3 className="text-lg font-bold text-slate-900">{module.name}</h3>
                <p className="mt-2 min-h-[44px] text-sm leading-6 text-slate-600">{module.description}</p>

                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                    {isActive && sessionInfo?.session_number ? (
                        <>
                            <InfoRow label="เหตุการณ์" value={`ครั้งที่ ${sessionInfo.session_number}`} />
                            {sessionInfo.activated_at && (
                                <InfoRow label="เปิดเมื่อ" value={new Date(sessionInfo.activated_at).toLocaleDateString('th-TH')} />
                            )}
                            {module.key === 'disease' && sessionInfo?.disease_name && (
                                <InfoRow label="เฝ้าระวัง" value={sessionInfo.disease_name} />
                            )}
                        </>
                    ) : (
                        <InfoRow label="สถานะ" value={module.comingSoon ? 'ยังไม่เปิดให้ใช้งาน' : 'พร้อมเปิดเมื่อมีการ activate EOC'} />
                    )}
                </div>

                <div className="mt-auto pt-5">
                    {module.comingSoon ? (
                        <div className="flex h-10 items-center justify-between rounded-lg bg-slate-100 px-3 text-sm font-bold text-slate-400">
                            <span>รอเปิดใช้งาน</span>
                        </div>
                    ) : (
                        <>
                            {isOperationalUser && (
                                <div className="mb-3">
                                    <label className="mb-1 block text-xs font-semibold text-slate-600">
                                        เลือกเหตุการณ์ EOC ก่อนเข้าปฏิบัติการ
                                    </label>
                                    <select
                                        value={selectedSessionId}
                                        onChange={(event) => onSelectSession(module.key, event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:border-[#0b4c86] focus:ring-2 focus:ring-[#0b4c86]/15"
                                        disabled={loadingSessions || sessions.length === 0}
                                    >
                                        {loadingSessions && <option value="">กำลังโหลดเหตุการณ์...</option>}
                                        {!loadingSessions && sessions.length === 0 && <option value="">ไม่พบเหตุการณ์</option>}
                                        {sessions.map((item) => (
                                            <option key={item.id} value={item.id}>
                                                #{item.session_number || item.id} · {item.status === 'active' ? 'เปิดอยู่' : 'ปิดแล้ว'} เวลา {item.opened_at ? new Date(item.opened_at).toLocaleDateString('th-TH') : 'ไม่ระบุ'} ถึง {item.closed_at ? new Date(item.closed_at).toLocaleDateString('th-TH') : 'ไม่ระบุ'}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => onEnterOperations(module)}
                                className="flex h-10 w-full items-center justify-between rounded-lg bg-[#0b4c86] px-3 text-sm font-bold text-white transition hover:bg-[#083865] disabled:cursor-not-allowed disabled:opacity-50"
                                disabled={isOperationalUser && sessions.length === 0}
                            >
                                <span>เข้าสู่หน้าปฏิบัติการ</span>
                                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );

    if (module.comingSoon) {
        return content;
    }

    return <div className="block">{content}</div>;
}

// สถานะล่าสุดของเหตุการณ์ (สรุปสถานการณ์ + ธงที่ประกาศ) — โหลดแยก ไม่ให้หน้าหลักช้า
function useEventPulse(eocKey, sessionId) {
    const [pulse, setPulse] = useState(null);
    useEffect(() => {
        if (!eocKey || !sessionId) return undefined;
        let cancelled = false;
        const params = `eoc=${eocKey}&session_id=${sessionId}`;
        Promise.all([
            fetch(`/stn-eoc/api/eoc/situation-board/?${params}`).then((r) => (r.ok ? r.json() : null)).catch(() => null),
            eocKey === 'flood' ? fetch(`/stn-eoc/api/eoc/area-triggers/?${params}`).then((r) => (r.ok ? r.json() : null)).catch(() => null) : Promise.resolve(null)
        ]).then(([board, triggers]) => {
            if (cancelled) return;
            setPulse({
                headline: board?.success ? board.headline : null,
                agendaTotal: board?.success ? board.agendaTotal : null,
                generatedAt: board?.generated_at || null,
                triggers: triggers?.success ? triggers.current || [] : null
            });
        });
        return () => { cancelled = true; };
    }, [eocKey, sessionId]);
    return pulse;
}

const HEADLINE_TONE = {
    red: 'border-red-200 bg-red-50 text-red-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-900',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    gray: 'border-slate-200 bg-slate-50 text-slate-700'
};

function ActiveEventBanner({ module, status, onEnter }) {
    const definition = EVENT_MODULES[module.key];
    const items = definition ? definition.items({ sessionId: status.session_id }) : [];
    const groups = groupMenuItems(items);
    const pulse = useEventPulse(module.key, status.session_id);
    const Icon = module.icon;
    const name = module.key === 'disease' && status.disease_name ? status.disease_name : module.name;
    return (
        <section className="mb-6 overflow-hidden rounded-2xl border border-[#c9dcee] bg-white shadow-sm" aria-label={`${name} ที่เปิดอยู่`}>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-3 bg-[#083865] px-5 py-4 text-white">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white/10 ring-1 ring-white/20"><Icon className="h-6 w-6" aria-hidden="true" /></span>
                <div className="min-w-0 flex-1">
                    <p className="text-xl font-black leading-tight sm:text-2xl">{name}{status.session_number ? ` ครั้งที่ ${status.session_number}` : ''}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-sm text-blue-100">
                        <span className="inline-flex items-center gap-1.5 font-semibold text-emerald-300"><span className="h-2 w-2 rounded-full bg-emerald-400" aria-hidden="true" />เปิดอยู่</span>
                        {status.activated_at ? <span>ตั้งแต่ {new Date(status.activated_at).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' })}</span> : null}
                        {pulse?.generatedAt ? <span className="[&_time]:text-blue-100">· สรุปล่าสุด <UpdatedAt value={pulse.generatedAt} staleHours={1} /></span> : null}
                    </p>
                </div>
                <button type="button" onClick={() => onEnter(module, module.path)} className="inline-flex h-11 items-center gap-2 rounded-lg bg-white px-4 text-sm font-bold text-[#083865] hover:bg-blue-50">
                    เข้าห้องปฏิบัติการ <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </button>
            </div>

            {pulse && (pulse.headline || pulse.triggers?.length || pulse.agendaTotal) ? (
                <div className="grid gap-3 border-b border-slate-100 p-4 lg:grid-cols-[minmax(0,1fr)_auto]">
                    {pulse.headline?.text ? (
                        <button type="button" onClick={() => onEnter(module, module.path)} className={`rounded-xl border px-4 py-3 text-left ${HEADLINE_TONE[pulse.headline.tone] || HEADLINE_TONE.gray}`}>
                            <span className="block text-base font-black leading-snug">{pulse.headline.text}</span>
                            {pulse.agendaTotal ? <span className="mt-0.5 block text-sm font-semibold opacity-80">เรื่องที่ต้องตัดสินใจและติดตาม {pulse.agendaTotal} เรื่อง</span> : null}
                        </button>
                    ) : <span />}
                    {pulse.triggers ? (
                        <button type="button" onClick={() => onEnter(module, '/eoc/flood/triggers')} className="flex min-w-[15rem] flex-col justify-center rounded-xl border border-slate-200 px-4 py-3 text-left hover:border-[#0b4c86]">
                            <span className="flex items-center gap-1.5 text-sm font-bold text-slate-700"><Flag className="h-4 w-4" aria-hidden="true" />ธงเตือนภัย/Trigger</span>
                            {pulse.triggers.length ? (
                                <span className="mt-1.5 flex flex-wrap gap-1.5">
                                    {pulse.triggers.slice(0, 4).map((item) => {
                                        const flag = flagMeta(stageMeta(item.stage)?.flag);
                                        return (
                                            <span key={item.id} className="rounded-full px-2 py-0.5 text-xs font-bold" style={flag ? { background: flag.soft, color: flag.text, boxShadow: `inset 0 0 0 1.5px ${flag.color}` } : { background: '#f1f5f9', color: '#334155' }}>
                                                {areaLabel(item)} · {flag ? flag.label : `T${stageMeta(item.stage)?.trigger}`}
                                            </span>
                                        );
                                    })}
                                    {pulse.triggers.length > 4 ? <span className="text-xs font-semibold text-slate-500">+{pulse.triggers.length - 4}</span> : null}
                                </span>
                            ) : <span className="mt-1 text-sm text-slate-500">ยังไม่มีพื้นที่ที่ประกาศ</span>}
                        </button>
                    ) : null}
                </div>
            ) : null}

            <nav aria-label={`งานใน${name}`} className="grid gap-x-6 gap-y-4 p-4 sm:grid-cols-2 xl:grid-cols-5">
                {groups.map((group) => (
                    <div key={group.title || 'main'} className="min-w-0">
                        {group.title ? <h3 className="mb-1.5 text-xs font-bold text-slate-500">{group.title}</h3> : null}
                        <ul className="space-y-0.5">
                            {group.items.map((item) => {
                                const ItemIcon = MENU_ICONS[item.iconKey] || ClipboardList;
                                return (
                                    <li key={item.key}>
                                        <button type="button" onClick={() => onEnter(module, item.path)} title={item.description || item.name}
                                            className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm font-semibold text-slate-700 hover:bg-[#edf5fc] hover:text-[#0b4c86]">
                                            <ItemIcon className="h-4 w-4 shrink-0 text-[#0b4c86]" aria-hidden="true" strokeWidth={2.2} />
                                            <span className="min-w-0 leading-snug">{item.name}</span>
                                        </button>
                                    </li>
                                );
                            })}
                        </ul>
                    </div>
                ))}
            </nav>
        </section>
    );
}

// เหตุการณ์ที่เปิดอยู่: แถบเต็มความกว้าง + สถานะล่าสุด + ทางลัดทุกงาน จัดกลุ่มตามเมนู
function ActiveEvents({ loading, modules, eocStatus, onEnter }) {
    if (loading) return <div className="mb-6 h-48 animate-pulse rounded-2xl bg-slate-100" />;
    if (!modules.length) {
        return (
            <p className="mb-6 rounded-xl border border-dashed border-slate-300 bg-white px-4 py-5 text-sm text-slate-600">
                เมื่อผู้บัญชาการเปิดเหตุการณ์ ทางลัดไปงานที่ต้องทำจะแสดงตรงนี้ ระหว่างนี้เลือกประเภทเหตุการณ์ด้านล่างเพื่อดูข้อมูลย้อนหลังได้
            </p>
        );
    }
    return modules.map((module) => <ActiveEventBanner key={module.key} module={module} status={eocStatus?.[module.key] || {}} onEnter={onEnter} />);
}

function InfoRow({ label, value }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{label}</span>
            <span className="truncate font-semibold text-slate-800">{value}</span>
        </div>
    );
}
