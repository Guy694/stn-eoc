'use client';

import { useEffect, useState } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import AppIcon from "@/components/icons/AppIcon";
import ReportingCompleteness from '@/components/eoc/ReportingCompleteness';
import SituationBoard from '@/components/eoc/flood-overview/SituationBoard';
import FloodMapSection from '@/components/eoc/flood-overview/FloodMapSection';
import { getOperationSessionLockByType } from '@/lib/eocSessionLock';
import { getEocTypeLabel } from '@/lib/eocDisplay';

const SECTION_LINKS = [
    { id: 'sec-situation', label: 'สรุปสถานการณ์' },
    { id: 'sec-districts', label: 'รายอำเภอ' },
    { id: 'sec-map', label: 'แผนที่และรายวัน' },
    { id: 'sec-completeness', label: 'ความครบรายงาน' }
];

export default function EOCOverview() {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [viewMode, setViewMode] = useState('cumulative');
    const [selectedDate, setSelectedDate] = useState('');

    async function fetchSessions() {
        try {
            const response = await fetch('/stn-eoc/api/eoc/sessions?type=flood&limit=100');
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                setSessions(result.data);
                const lock = getOperationSessionLockByType('flood');
                const lockedSession = lock
                    ? result.data.find((session) => Number(session.id) === Number(lock.sessionId))
                    : null;
                const activeSession = result.data.find(session => session.status === 'active') || result.data[0];
                setSelectedSession((lockedSession || activeSession).id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching active sessions:', error);
            setLoading(false);
        }
    }

    async function fetchDashboardData(sessionId, mode, date) {
        try {
            setLoading(true);
            const params = new URLSearchParams({
                session_id: String(sessionId),
                mode
            });
            if (mode === 'daily' && date) {
                params.append('date', date);
            }
            const response = await fetch(`/stn-eoc/api/commander/dashboard?${params}`);
            const result = await response.json();

            if (result.success) {
                setDashboardData(result.data);
                if (mode === 'daily' && !date && result.data?.filters?.effective_date) {
                    setSelectedDate(result.data.filters.effective_date);
                }
            } else {
                console.error('Error:', result.error);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    }

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (selectedSession) {
            fetchDashboardData(selectedSession, viewMode, selectedDate);
        }
    }, [selectedDate, selectedSession, viewMode]);


    if (loading && !dashboardData) {
        return (
            <EOCLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                        <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (sessions.length === 0) {
        return (
            <EOCLayout>
                <div className="w-full">
                    <h1 className="mb-6 flex items-center gap-2.5 font-[family-name:var(--font-kanit)] text-2xl font-semibold text-slate-900"><span className="flex h-10 w-10 items-center justify-center rounded-xl bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><AppIcon icon="barChart" className="h-5 w-5" /></span>ภาพรวม EOC</h1>
                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6">
                        <div className="flex items-center">
                            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 text-slate-400 ring-1 ring-slate-200"><AppIcon icon="alert" className="h-6 w-6" /></span>
                            <div>
                                <h3 className="text-lg font-semibold text-yellow-800">ไม่มีเหตุการณ์ EOC</h3>
                                <p className="text-yellow-700">ยังไม่มีข้อมูลเหตุการณ์สำหรับแสดงผลย้อนหลัง</p>
                            </div>
                        </div>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!dashboardData) return null;

    const { session, affected_areas, shelters, diseases, flood_map } = dashboardData;
    const isDailyMode = dashboardData.filters?.mode === 'daily';
    const formatNumber = (value) => Number(value || 0).toLocaleString('th-TH');
    const formatDateKey = (value) => {
        if (!value) return '-';
        return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH');
    };
    const effectiveDateLabel = dashboardData.filters?.effective_date
        ? new Date(`${dashboardData.filters.effective_date}T00:00:00`).toLocaleDateString('th-TH')
        : 'วันที่เลือก';
    const impactScopeLabel = isDailyMode ? `ประจำวันที่ ${effectiveDateLabel}` : 'สะสมทั้งเหตุการณ์';
    const mapStartDate = flood_map?.start_date || (session.open_time ? String(session.open_time).slice(0, 10) : '');
    const mapEndDate = flood_map?.end_date || (session.close_time ? String(session.close_time).slice(0, 10) : mapStartDate);

    return (
        <EOCLayout>
            <div className="w-full">
                {/* หัวเรื่อง — สถานะเหตุการณ์แสดงอยู่แล้วในแถบเหตุการณ์ด้านบน จึงไม่ซ้ำ */}
                <header className="mb-3 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                    <h1 className="text-2xl font-black text-slate-900 sm:text-[1.7rem]">ภาพรวมสถานการณ์ <span className="font-semibold text-[#0b4c86]">{getEocTypeLabel(session.eoc_type || 'flood')} ครั้งที่ {session.session_number}</span></h1>
                    <p className="text-sm text-slate-600">
                        {session.status === 'active' ? 'เปิดอยู่ · ' : 'ปิดแล้ว · '}
                        {session.opened_by_name ? `เปิดโดย ${session.opened_by_name} ` : 'เปิด'}เมื่อ {new Date(session.open_time).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}
                        {session.close_time ? ` · ปิดเมื่อ ${new Date(session.close_time).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })}` : ''}
                    </p>
                </header>

                {/* ทางลัดไปยังหัวข้อในหน้า */}
                <nav aria-label="ไปยังหัวข้อ" className="sticky top-0 z-20 -mx-1 mb-5 flex gap-1.5 overflow-x-auto rounded-2xl border border-slate-200 bg-white/90 p-1.5 font-[family-name:var(--font-kanit)] shadow-[0_8px_20px_-16px_rgba(15,23,42,.5)] backdrop-blur [scrollbar-width:none]">
                    {SECTION_LINKS.map((item) => (
                        <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-xl px-3.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-[#edf5fc] hover:text-[#0b4c86]">
                            {item.label}
                        </a>
                    ))}
                </nav>

                <SituationBoard sessionId={session.id} eocType="flood" />

                {/* แผนที่และบันทึกรายวัน — ส่วนที่แผงสรุปด้านบนไม่มี (ดูย้อนหลังเป็นรายวันได้)
                    ตัวเลขผู้ประสบภัย/ศูนย์พักพิง/โรค/กลุ่มเปราะบาง/เวชภัณฑ์/IT อยู่ในแผงสรุปด้านบน และหน้าของแต่ละเมนูแล้ว จึงไม่แสดงซ้ำที่นี่ */}
                <div className="mb-4 flex flex-wrap items-end justify-between gap-3 border-t border-[#c9dcee] pt-6">
                    <div>
                        <h2 className="text-xl font-black text-slate-900">แผนที่และบันทึกรายวัน</h2>
                        <p className="text-sm text-slate-600">{impactScopeLabel} · เลือก &ldquo;รายวัน&rdquo; เพื่อดูย้อนหลังว่าแต่ละวันเกิดอะไรขึ้นบ้าง{loading ? ' · กำลังโหลด…' : ''}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="inline-flex overflow-hidden rounded-2xl border border-slate-200 bg-white p-1" role="group" aria-label="ช่วงข้อมูลของรายละเอียด">
                            <button type="button" onClick={() => setViewMode('cumulative')} aria-pressed={viewMode === 'cumulative'}
                                className={`rounded-md px-3 py-1.5 text-sm font-bold ${viewMode === 'cumulative' ? 'bg-[#0b4c86] text-white' : 'text-slate-700 hover:bg-[#edf5fc]'}`}>
                                สะสมทั้งเหตุการณ์
                            </button>
                            <button type="button" onClick={() => setViewMode('daily')} aria-pressed={viewMode === 'daily'}
                                className={`rounded-md px-3 py-1.5 text-sm font-bold ${viewMode === 'daily' ? 'bg-[#0b4c86] text-white' : 'text-slate-700 hover:bg-[#edf5fc]'}`}>
                                รายวัน
                            </button>
                        </div>
                        {viewMode === 'daily' && (
                            <>
                                <label htmlFor="overview-date" className="sr-only">วันที่รายงาน</label>
                                <input id="overview-date" type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} list="overview-report-dates"
                                    className="rounded-lg border border-[#c9dcee] bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#0b4c86]" />
                                <datalist id="overview-report-dates">
                                    {(dashboardData.filters?.available_dates || []).map(date => <option key={date} value={date} />)}
                                </datalist>
                                <button type="button" onClick={() => setSelectedDate(dashboardData.filters?.available_dates?.[0] || '')}
                                    className="rounded-lg border border-[#c9dcee] bg-white px-3 py-1.5 text-sm font-bold text-[#0b4c86] hover:bg-[#edf5fc]">
                                    วันล่าสุดที่มีข้อมูล
                                </button>
                            </>
                        )}
                    </div>
                </div>

                <FloodMapSection session={session} affected_areas={affected_areas} shelters={shelters} diseases={diseases} flood_map={flood_map} isDailyMode={isDailyMode} formatNumber={formatNumber} formatDateKey={formatDateKey} effectiveDateLabel={effectiveDateLabel} mapStartDate={mapStartDate} mapEndDate={mapEndDate} dashboardData={dashboardData} />

                {/* ความครบของรายงาน: ตัวเลขอยู่ในแผงสรุปและตารางรายอำเภอแล้ว — เก็บไว้แบบพับเพื่อใช้ "ส่งเตือนทาง Telegram" และดูรายชื่อตำบลที่ยังไม่ส่ง
                    (กลุ่มภารกิจย้ายไปดูที่เมนูทีมปฏิบัติการ ไม่แสดงที่หน้านี้แล้ว) */}
                <details id="sec-completeness" className="group mb-6 scroll-mt-20 rounded-2xl border border-slate-200 bg-white font-[family-name:var(--font-kanit)]">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-3 [&::-webkit-details-marker]:hidden">
                        <span>
                            <span className="block font-semibold text-slate-900">ตำบลที่ยังไม่ส่งรายงาน และส่งเตือนทาง Telegram</span>
                            <span className="block text-sm text-slate-600">ดูรายชื่อตำบลรายวัน แล้วส่งรายชื่อเตือนเข้ากลุ่มของศูนย์ในคลิกเดียว</span>
                        </span>
                        <span className="shrink-0 text-sm font-bold text-[#0b4c86] group-open:hidden">แสดง</span>
                        <span className="hidden shrink-0 text-sm font-bold text-[#0b4c86] group-open:inline">ซ่อน</span>
                    </summary>
                    <div className="border-t border-slate-100 p-3">
                        <ReportingCompleteness eocType="flood" sessionId={session.id} />
                    </div>
                </details>

            </div>
        </EOCLayout>
    );
}
