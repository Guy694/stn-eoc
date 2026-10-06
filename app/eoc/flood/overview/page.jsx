'use client';

import { useEffect, useState } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import AppIcon from "@/components/icons/AppIcon";
import ReportingCompleteness from '@/components/eoc/ReportingCompleteness';
import OverviewTeams from '@/components/eoc/flood-overview/OverviewTeams';
import MeetingSummary from '@/components/eoc/flood-overview/MeetingSummary';
import ImpactSection from '@/components/eoc/flood-overview/ImpactSection';
import FloodMapSection from '@/components/eoc/flood-overview/FloodMapSection';
import ResourcesSection from '@/components/eoc/flood-overview/ResourcesSection';
import HealthSection from '@/components/eoc/flood-overview/HealthSection';
import VulnerableSection from '@/components/eoc/flood-overview/VulnerableSection';
import SuppliesSection from '@/components/eoc/flood-overview/SuppliesSection';
import { getOperationSessionLockByType } from '@/lib/eocSessionLock';

const SECTION_LINKS = [
    { id: 'sec-completeness', label: 'ความครบรายงาน' },
    { id: 'sec-teams', label: 'กลุ่มภารกิจ' },
    { id: 'sec-meeting', label: 'สรุปประชุม' },
    { id: 'sec-casualties', label: 'ผู้ประสบภัย' },
    { id: 'sec-areas', label: 'พื้นที่ผลกระทบ' },
    { id: 'sec-map', label: 'แผนที่' },
    { id: 'sec-shelters', label: 'ศูนย์พักพิง' },
    { id: 'sec-health', label: 'สุขภาพและโรค' },
    { id: 'sec-vulnerable', label: 'กลุ่มเปราะบาง' },
    { id: 'sec-supplies', label: 'เวชภัณฑ์และคลังยา' }
];

export default function EOCOverview() {
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [sessions, setSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);
    const [viewMode, setViewMode] = useState('cumulative');
    const [selectedDate, setSelectedDate] = useState('');
    const [missionTeams, setMissionTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(false);

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

    useEffect(() => {
        if (!selectedSession) {
            return;
        }

        const loadTeams = async () => {
            setLoadingTeams(true);
            try {
                const response = await fetch(`/stn-eoc/api/eoc/sessions/${selectedSession}/teams`);
                const result = await response.json();
                if (result.success) {
                    setMissionTeams(Array.isArray(result.teams) ? result.teams : []);
                } else {
                    setMissionTeams([]);
                }
            } catch (error) {
                console.error('Error loading mission teams:', error);
                setMissionTeams([]);
            } finally {
                setLoadingTeams(false);
            }
        };

        loadTeams();
    }, [selectedSession]);

    if (loading) {
        return (
            <EOCLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b border-[#0b4c86] mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (sessions.length === 0) {
        return (
            <EOCLayout>
                <div className="mx-auto max-w-7xl">
                    <h1 className="mb-6 text-2xl font-black text-slate-900"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ภาพรวม EOC</h1>
                    <div className="bg-yellow-50 border border-yellow-400 p-6 rounded-lg">
                        <div className="flex items-center">
                            <div className="text-4xl mr-4"><AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
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

    const {
        session,
        casualties,
        affected_areas,
        resources,
        teams,
        shelters,
        diseases,
        vulnerable_groups,
        flood_map,
        shelter_diseases,
        medical_inventory,
        meeting_summary
    } = dashboardData;
    const isDailyMode = dashboardData.filters?.mode === 'daily';
    const formatNumber = (value) => Number(value || 0).toLocaleString('th-TH');
    const formatDateKey = (value) => {
        if (!value) return '-';
        return new Date(`${String(value).slice(0, 10)}T00:00:00`).toLocaleDateString('th-TH');
    };
    const effectiveDateLabel = dashboardData.filters?.effective_date
        ? new Date(`${dashboardData.filters.effective_date}T00:00:00`).toLocaleDateString('th-TH')
        : 'วันที่เลือก';
    const diseaseLatestDateLabel = diseases?.latest_report_date
        ? new Date(`${String(diseases.latest_report_date).split('T')[0]}T00:00:00`).toLocaleDateString('th-TH')
        : 'วันล่าสุด';
    const impactScopeLabel = isDailyMode ? `ประจำวันที่ ${effectiveDateLabel}` : 'สะสมทั้งเหตุการณ์';
    const mapStartDate = flood_map?.start_date || (session.open_time ? String(session.open_time).slice(0, 10) : '');
    const mapEndDate = flood_map?.end_date || (session.close_time ? String(session.close_time).slice(0, 10) : mapStartDate);

    return (
        <EOCLayout>
            <div className="mx-auto max-w-7xl">
                {/* หัวหน้า: สถานะเหตุการณ์ + ตัวควบคุมมุมมอง */}
                <header className="mb-4 overflow-hidden rounded-2xl bg-gradient-to-br from-[#0b4c86] to-[#11466e] text-white shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-4 p-5 sm:p-6">
                        <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-bold ${session.status === 'active' ? 'bg-emerald-400 text-emerald-950' : 'bg-white/20 text-white'}`}>
                                    <span className={`h-2 w-2 rounded-full ${session.status === 'active' ? 'bg-emerald-900' : 'bg-slate-300'}`} aria-hidden="true" />
                                    {session.status === 'active' ? 'เปิดอยู่' : 'ปิดแล้ว'}
                                </span>
                                <span className="text-sm text-blue-100">ครั้งที่ {session.session_number}</span>
                            </div>
                            <h1 className="mt-2 text-2xl font-black sm:text-3xl">ภาพรวมสถานการณ์{session.eoc_type_name ? ` ${session.eoc_type_name}` : ''}</h1>
                            <p className="mt-1 text-sm text-blue-100">
                                เปิดโดย {session.opened_by_name || '-'} เมื่อ {new Date(session.open_time).toLocaleString('th-TH')}
                                {session.close_time ? ` · ปิดเมื่อ ${new Date(session.close_time).toLocaleString('th-TH')}` : ''}
                            </p>
                        </div>
                        <div className="w-full sm:w-auto">
                            <p className="mb-1.5 text-xs font-semibold text-blue-100">มุมมองข้อมูล</p>
                            <div className="inline-flex w-full overflow-hidden rounded-lg bg-white/10 p-1 sm:w-auto" role="group" aria-label="มุมมองข้อมูล">
                                <button type="button" onClick={() => setViewMode('cumulative')} aria-pressed={viewMode === 'cumulative'}
                                    className={`flex-1 rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${viewMode === 'cumulative' ? 'bg-white text-[#0b4c86]' : 'text-white hover:bg-white/10'}`}>
                                    สะสมทั้งเหตุการณ์
                                </button>
                                <button type="button" onClick={() => setViewMode('daily')} aria-pressed={viewMode === 'daily'}
                                    className={`flex-1 rounded-md px-4 py-1.5 text-sm font-bold transition-colors ${viewMode === 'daily' ? 'bg-white text-[#0b4c86]' : 'text-white hover:bg-white/10'}`}>
                                    รายวัน
                                </button>
                            </div>
                        </div>
                    </div>
                    {viewMode === 'daily' && (
                        <div className="flex flex-wrap items-center gap-3 border-t border-white/15 bg-black/10 px-5 py-3 sm:px-6">
                            <label htmlFor="overview-date" className="text-sm font-semibold">วันที่รายงาน</label>
                            <input
                                id="overview-date"
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                list="overview-report-dates"
                                className="rounded-lg border border-white/30 bg-white px-3 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-white/60"
                            />
                            <datalist id="overview-report-dates">
                                {(dashboardData.filters?.available_dates || []).map(date => (
                                    <option key={date} value={date} />
                                ))}
                            </datalist>
                            <button type="button" onClick={() => setSelectedDate(dashboardData.filters?.available_dates?.[0] || '')}
                                className="rounded-lg bg-white/15 px-3 py-1.5 text-sm font-bold hover:bg-white/25">
                                ดูวันล่าสุดที่มีข้อมูล
                            </button>
                        </div>
                    )}
                </header>

                {/* ทางลัดไปยังหัวข้อในหน้า */}
                <nav aria-label="ไปยังหัวข้อ" className="sticky top-0 z-20 -mx-1 mb-6 flex gap-1.5 overflow-x-auto rounded-xl border border-[#c9dcee] bg-white/95 px-2 py-2 shadow-sm backdrop-blur">
                    {SECTION_LINKS.map((item) => (
                        <a key={item.id} href={`#${item.id}`} className="shrink-0 rounded-lg px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-[#edf5fc] hover:text-[#0b4c86]">
                            {item.label}
                        </a>
                    ))}
                </nav>

                <ReportingCompleteness id="sec-completeness" eocType="flood" sessionId={session.id} />

                <OverviewTeams session={session} teams={teams} missionTeams={missionTeams} loadingTeams={loadingTeams} />

                <MeetingSummary meeting_summary={meeting_summary} isDailyMode={isDailyMode} formatNumber={formatNumber} formatDateKey={formatDateKey} effectiveDateLabel={effectiveDateLabel} />

                <ImpactSection casualties={casualties} affected_areas={affected_areas} impactScopeLabel={impactScopeLabel} />

                <FloodMapSection session={session} affected_areas={affected_areas} shelters={shelters} diseases={diseases} flood_map={flood_map} isDailyMode={isDailyMode} formatNumber={formatNumber} formatDateKey={formatDateKey} effectiveDateLabel={effectiveDateLabel} mapStartDate={mapStartDate} mapEndDate={mapEndDate} dashboardData={dashboardData} />

                <ResourcesSection resources={resources} teams={teams} shelters={shelters} formatNumber={formatNumber} />

                <HealthSection diseases={diseases} shelter_diseases={shelter_diseases} isDailyMode={isDailyMode} formatNumber={formatNumber} effectiveDateLabel={effectiveDateLabel} diseaseLatestDateLabel={diseaseLatestDateLabel} impactScopeLabel={impactScopeLabel} />

                <VulnerableSection vulnerable_groups={vulnerable_groups} formatNumber={formatNumber} />

                <SuppliesSection medical_inventory={medical_inventory} formatNumber={formatNumber} />

                {/* Info Box */}
                <div className="bg-[#edf5fc] border border-[#0b4c86] p-4 rounded-lg">
                    <div className="flex items-start">
                        <div className="text-2xl mr-3"><AppIcon icon="info" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                        <div>
                            <h4 className="font-semibold text-[#083865] mb-1">หมายเหตุ</h4>
                            <p className="text-sm text-[#0b4c86]">
                                หน้านี้แสดงข้อมูลภาพรวมสถานการณ์ EOC แบบเรียลไทม์
                                ข้อมูลจะอัปเดตอัตโนมัติตามการบันทึกของทีมปฏิบัติการ
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}
