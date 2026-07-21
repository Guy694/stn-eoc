"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
    Activity,
    ArrowRight,
    CalendarClock,
    Car,
    Droplets,
    Gauge,
    ShieldCheck,
    Sun,
    UserRound
} from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import CitizenDashboard from "@/components/CitizenDashboard";
import { getOperationSessionLock, setOperationSessionLock } from "@/lib/eocSessionLock";

// กำหนดเหตุการณ์ที่ระบบรองรับ
const EOC_MODULES = [
    {
        key: 'flood',
        name: 'อุทกภัยน้ำท่วม',
        icon: Droplets,
        description: 'ระบบติดตามสถานการณ์อุทกภัยน้ำท่วม พื้นที่ประสบภัย ศูนย์อพยพ',
        path: '/eoc/flood/overview',
        tone: 'blue',
        accentClass: 'bg-blue-600',
        iconClass: 'bg-blue-50 text-blue-700',
        activeClass: 'border-blue-300 bg-blue-50/40',
    },
    {
        key: 'disease',
        name: 'โรคระบาด',
        icon: Activity,
        description: 'ระบบติดตามสถานการณ์โรคระบาด รายงานผู้ป่วย และเฝ้าระวังรายวัน',
        path: '/eoc/disease',
        tone: 'emerald',
        accentClass: 'bg-emerald-600',
        iconClass: 'bg-emerald-50 text-emerald-700',
        activeClass: 'border-emerald-300 bg-emerald-50/40',
    },
    {
        key: 'festival-accidents',
        name: 'อุบัติเหตุช่วงเทศกาล',
        icon: Car,
        description: 'ระบบติดตามอุบัติเหตุ 7 วันอันตราย ปีใหม่ / สงกรานต์',
        path: '#',
        tone: 'rose',
        accentClass: 'bg-rose-600',
        iconClass: 'bg-rose-50 text-rose-700',
        activeClass: 'border-rose-300 bg-rose-50/40',
        comingSoon: true,
    },
    {
        key: 'drought',
        name: 'ภัยแล้ง',
        icon: Sun,
        description: 'ระบบติดตามสถานการณ์ภัยแล้ง พื้นที่ขาดแคลนน้ำ',
        path: '#',
        tone: 'amber',
        accentClass: 'bg-amber-500',
        iconClass: 'bg-amber-50 text-amber-700',
        activeClass: 'border-amber-300 bg-amber-50/40',
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

    const handleEnterOperations = (module) => {
        if (!isOperationalUser) {
            router.push(module.path);
            return;
        }

        const selectedSessionId = selectedSessions[module.key];
        const sessions = moduleSessions[module.key] || [];
        const selectedSession = sessions.find((item) => Number(item.id) === Number(selectedSessionId));

        if (!selectedSession) {
            setEntryError(`กรุณาเลือก EOC Session ของ${module.name}ก่อนเข้าสู่หน้าปฏิบัติการ`);
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
                    <div className="animate-spin rounded-full h-16 w-16 border-b border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!user) {
        return null;
    }

    const activeModules = EOC_MODULES.filter((mod) => eocStatus?.[mod.key]?.is_active).length;
    const availableModules = EOC_MODULES.filter((mod) => !mod.comingSoon).length;
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
                        <div className="mb-6 grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
                            <section className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
                                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                                    <div>
                                        <p className="mb-2 text-sm font-semibold text-slate-500">ระบบศูนย์ปฏิบัติการภาวะฉุกเฉิน ด้านการแพทย์และสาธารณสุข จังหวัดสตูล</p>
                                        <h1 className="text-2xl font-bold text-slate-900 sm:text-3xl">
                                            เหตุการณ์ต่างๆ
                                        </h1>
                                        <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                                            เลือกประเภทเหตุการณ์เพื่อเข้าสู่หน้าปฏิบัติการและติดตามข้อมูลล่าสุดของแต่ละ EOC
                                        </p>
                                    </div>
                                    <div className="inline-flex w-fit items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                                        <CalendarClock className="h-4 w-4" aria-hidden="true" />
                                        {currentDateLabel}
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-3 sm:grid-cols-3">
                                    <StatusTile
                                        icon={Gauge}
                                        label="EOC เปิดใช้งาน"
                                        value={eocLoading ? '-' : activeModules}
                                        unit="ประเภท"
                                        tone="text-green-700 bg-green-50 border-green-100"
                                    />
                                    <StatusTile
                                        icon={ShieldCheck}
                                        label="โมดูลพร้อมใช้งาน"
                                        value={availableModules}
                                        unit="ประเภท"
                                        tone="text-blue-700 bg-blue-50 border-blue-100"
                                    />
                                    <StatusTile
                                        icon={Activity}
                                        label="ทั้งหมดในระบบ"
                                        value={EOC_MODULES.length}
                                        unit="ประเภท"
                                        tone="text-slate-700 bg-slate-50 border-slate-100"
                                    />
                                </div>
                            </section>

                            <aside className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                                <div className="flex items-center gap-3">
                                    <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-green-50 text-green-700">
                                        <UserRound className="h-5 w-5" aria-hidden="true" />
                                    </div>
                                    <div className="min-w-0">
                                        <p className="truncate text-sm font-semibold text-slate-500">ผู้ใช้งาน</p>
                                        <h2 className="truncate text-lg font-bold text-slate-900">
                                            {`${user.title || ''} ${user.givenName || ''} ${user.familyName || ''}`.trim() || user.username}
                                        </h2>
                                    </div>
                                </div>
                                <div className="mt-5 space-y-3 text-sm">
                                    <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                                        <span className="text-slate-500">สิทธิ์</span>
                                        <span className="font-semibold text-green-700">{user.roleDisplay || user.role}</span>
                                    </div>
                                    {user.department && (
                                        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                                            <span className="text-slate-500">หน่วยงาน</span>
                                            <span className="truncate font-semibold text-slate-700">{user.department}</span>
                                        </div>
                                    )}
                                    {user.position && (
                                        <div className="flex items-center justify-between gap-3 rounded-lg bg-slate-50 px-3 py-2">
                                            <span className="text-slate-500">ตำแหน่ง</span>
                                            <span className="truncate font-semibold text-slate-700">{user.position}</span>
                                        </div>
                                    )}
                                </div>
                            </aside>
                        </div>

                        {/* EOC Event Modules */}
                        <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                            <div className="mb-4 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h2 className="text-xl font-bold text-slate-900">เลือกประเภทเหตุการณ์</h2>
                                    <p className="text-sm text-slate-500">ระบบจะแสดงเฉพาะหน้าปฏิบัติการที่พร้อมใช้งาน และสำหรับเจ้าหน้าที่จะต้องเลือก session ก่อนเข้าใช้งาน</p>
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
            ? 'bg-green-50 text-green-700 ring-1 ring-green-200'
            : 'bg-slate-100 text-slate-500';

    const content = (
        <div
            className={`group relative flex h-full min-h-[260px] flex-col overflow-hidden rounded-lg border bg-white transition ${
                module.comingSoon
                    ? 'border-slate-200 opacity-70'
                    : isActive
                        ? `${module.activeClass} shadow-sm hover:shadow-md`
                        : 'border-slate-200 shadow-sm hover:border-slate-300 hover:shadow-md'
            }`}
        >
            <div className={`h-1.5 ${module.accentClass}`} />

            <div className="flex flex-1 flex-col p-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                    <div className={`flex h-12 w-12 items-center justify-center rounded-lg ${module.iconClass}`}>
                        <Icon className="h-6 w-6" aria-hidden="true" strokeWidth={2.2} />
                    </div>
                    {eocLoading ? (
                        <div className="h-7 w-20 animate-pulse rounded-full bg-slate-200" />
                    ) : (
                        <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold ${statusClass}`}>
                            {isActive && <span className="h-2 w-2 rounded-full bg-green-500" />}
                            {statusLabel}
                        </span>
                    )}
                </div>

                <h3 className="text-lg font-bold text-slate-900">{module.name}</h3>
                <p className="mt-2 min-h-[44px] text-sm leading-6 text-slate-600">{module.description}</p>

                <div className="mt-5 space-y-2 border-t border-slate-100 pt-4 text-sm">
                    {isActive && sessionInfo?.session_number ? (
                        <>
                            <InfoRow label="เหตุการณ์" value={`#${sessionInfo.session_number}`} />
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
                                        เลือก EOC Session ก่อนเข้าปฏิบัติการ
                                    </label>
                                    <select
                                        value={selectedSessionId}
                                        onChange={(event) => onSelectSession(module.key, event.target.value)}
                                        className="h-10 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-700"
                                        disabled={loadingSessions || sessions.length === 0}
                                    >
                                        {loadingSessions && <option value="">กำลังโหลด session...</option>}
                                        {!loadingSessions && sessions.length === 0 && <option value="">ไม่พบ session</option>}
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
                                className="flex h-10 w-full items-center justify-between rounded-lg bg-slate-900 px-3 text-sm font-bold text-white transition group-hover:bg-slate-800"
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

function StatusTile({ icon: Icon, label, value, unit, tone }) {
    return (
        <div className={`rounded-lg border px-4 py-3 ${tone}`}>
            <div className="flex items-center justify-between gap-3">
                <div>
                    <p className="text-xs font-semibold opacity-75">{label}</p>
                    <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-2xl font-bold">{value}</span>
                        <span className="text-xs font-semibold opacity-70">{unit}</span>
                    </div>
                </div>
                <Icon className="h-5 w-5 opacity-80" aria-hidden="true" />
            </div>
        </div>
    );
}

function InfoRow({ label, value }) {
    return (
        <div className="flex items-center justify-between gap-3">
            <span className="text-slate-500">{label}</span>
            <span className="truncate font-semibold text-slate-800">{value}</span>
        </div>
    );
}
