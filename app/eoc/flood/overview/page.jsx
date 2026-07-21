'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import EOCLayout from '@/components/layouts/EOCLayout';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Bar, Pie } from 'react-chartjs-2';
import AppIcon from "@/components/icons/AppIcon";
import { getOperationSessionLockByType } from '@/lib/eocSessionLock';

const PublicIncidentMap = dynamic(() => import('@/components/PublicIncidentMap'), {
    ssr: false,
    loading: () => (
        <div className="flex h-full min-h-[420px] items-center justify-center bg-slate-100 text-slate-500">
            กำลังโหลดแผนที่...
        </div>
    )
});

ChartJS.register(
    CategoryScale,
    LinearScale,
    BarElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

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
        // eslint-disable-next-line react-hooks/set-state-in-effect
        fetchSessions();
    }, []);

    useEffect(() => {
        if (selectedSession) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
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
                        <div className="animate-spin rounded-full h-16 w-16 border-b border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (sessions.length === 0) {
        return (
            <EOCLayout>
                <div className="max-w-7xl mx-auto p-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ภาพรวม EOC</h1>
                    <div className="bg-yellow-50 border border-yellow-400 p-6 rounded-lg">
                        <div className="flex items-center">
                            <div className="text-4xl mr-4"><AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            <div>
                                <h3 className="text-lg font-semibold text-yellow-800">ไม่มี EOC Session</h3>
                                <p className="text-yellow-700">ยังไม่มีข้อมูล session สำหรับแสดงผลย้อนหลัง</p>
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
    const impactScopeLabel = isDailyMode ? `ประจำวันที่ ${effectiveDateLabel}` : 'สะสมทั้ง session';
    const mapStartDate = flood_map?.start_date || (session.open_time ? String(session.open_time).slice(0, 10) : '');
    const mapEndDate = flood_map?.end_date || (session.close_time ? String(session.close_time).slice(0, 10) : mapStartDate);

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ภาพรวม EOC</h1>
                    <p className="text-gray-600">ภาพรวมสถานการณ์ EOC ตามข้อมูลที่บันทึกและกรอกย้อนหลัง</p>
                </div>

                {/* Display Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">EOC Session ที่ล็อกใช้งาน</label>
                            <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-900">
                                เหตุการณ์ #{session.session_number} ({session.status === 'active' ? 'เปิดอยู่' : 'ปิดแล้ว'})
                            </div>
                            <p className="mt-1 text-xs text-gray-500">
                                ระบบเลือกจาก dashboard และใช้ session เดียวกันตลอดหน้าปฏิบัติการ
                            </p>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                รูปแบบการแสดงผล
                            </label>
                            <div className="inline-flex w-full rounded-lg border border-gray-300 overflow-hidden">
                                <button
                                    type="button"
                                    onClick={() => setViewMode('cumulative')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium ${viewMode === 'cumulative' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                    สะสม
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setViewMode('daily')}
                                    className={`flex-1 px-4 py-2 text-sm font-medium border-l border-gray-300 ${viewMode === 'daily' ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                                >
                                    รายวัน
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                วันที่รายงาน
                            </label>
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => {
                                    setSelectedDate(e.target.value);
                                    setViewMode('daily');
                                }}
                                list="overview-report-dates"
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                disabled={viewMode !== 'daily'}
                            />
                            <datalist id="overview-report-dates">
                                {(dashboardData.filters?.available_dates || []).map(date => (
                                    <option key={date} value={date} />
                                ))}
                            </datalist>
                        </div>
                        <div>
                            <button
                                type="button"
                                onClick={() => {
                                    setViewMode('daily');
                                    setSelectedDate(dashboardData.filters?.available_dates?.[0] || '');
                                }}
                                className="w-full px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-800"
                            >
                                ดูวันล่าสุด
                            </button>
                        </div>
                    </div>
                </div>

                {/* Session Info */}
                <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold mb-2">{session.eoc_type_name}</h2>
                            <p className="opacity-90">Session #{session.session_number} | เปิดโดย: {session.opened_by_name}</p>
                            <p className="text-sm opacity-75">เปิดเมื่อ: {new Date(session.open_time).toLocaleString('th-TH')}</p>
                            {session.close_time && (
                                <p className="text-sm opacity-75">ปิดเมื่อ: {new Date(session.close_time).toLocaleString('th-TH')}</p>
                            )}
                        </div>
                        <div className="text-5xl"><AppIcon icon="siren" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    </div>
                </div>

                <div className="mb-6 rounded-lg border border-cyan-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
                        <div>
                            <h3 className="text-xl font-bold text-slate-900">กลุ่มภารกิจที่เปิดใช้งาน</h3>
                            <p className="text-sm text-slate-600">แสดงข้อมูลเหมือนเมนูศูนย์ปฏิบัติงานเจ้าหน้าที่ EOC ของ session นี้</p>
                        </div>
                        <div className="rounded-lg bg-cyan-50 px-3 py-2 text-sm font-semibold text-cyan-700">
                            ทั้งหมด {missionTeams.length} กลุ่ม
                        </div>
                    </div>

                    {loadingTeams ? (
                        <div className="text-sm text-slate-500">กำลังโหลดกลุ่มภารกิจ...</div>
                    ) : missionTeams.length === 0 ? (
                        <div className="text-sm text-slate-500">ยังไม่มีกลุ่มภารกิจสำหรับ session นี้</div>
                    ) : (
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                            {missionTeams.map((team) => (
                                <Link
                                    key={team.session_team_id}
                                    href={`/eoc/staff/${session.id}/teams/${team.session_team_id}`}
                                    className="group rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-cyan-300 hover:shadow-md"
                                >
                                    <div className="flex items-start justify-between gap-3">
                                        <span className="text-2xl">{team.icon || 'ทีม'}</span>
                                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                                            {team.team_code || '-'}
                                        </span>
                                    </div>
                                    <h4 className="mt-3 text-base font-black text-slate-900">{team.team_name_th || team.team_name_en}</h4>
                                    <p className="mt-2 text-sm text-slate-600">หัวหน้าทีม: {team.team_lead_name || 'ยังไม่กำหนด'}</p>
                                    <p className="mt-1 text-sm text-slate-600">สมาชิก {team.member_count || 0} คน</p>
                                    <div className="mt-3 border-t border-slate-100 pt-2 text-xs font-bold text-cyan-700">Dashboard · รายงานผล · ประวัติ</div>
                                </Link>
                            ))}
                        </div>
                    )}
                </div>

                {/* Meeting Summary */}
                {meeting_summary && (
                    <div className="mb-6">
                        <div className="flex flex-col gap-1 mb-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">สรุปสำหรับห้องประชุมภาวะฉุกเฉิน</h3>
                                <p className="text-sm text-gray-500">
                                    ช่วงข้อมูล {formatDateKey(meeting_summary.period?.start_date)} - {formatDateKey(meeting_summary.period?.end_date)}
                                </p>
                            </div>
                            <span className="inline-flex w-fit rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700">
                                {isDailyMode ? `มุมมองรายวัน ${effectiveDateLabel}` : 'มุมมองสะสมทั้ง session'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
                            <div className="bg-white rounded-lg shadow p-5 border border-blue-100">
                                <p className="text-xs font-semibold text-gray-500">ผู้ได้รับผลกระทบ</p>
                                <p className="mt-2 text-3xl font-bold text-blue-700">{formatNumber(meeting_summary.kpis?.affected_people)}</p>
                                <p className="text-xs text-gray-500">คน</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5 border border-cyan-100">
                                <p className="text-xs font-semibold text-gray-500">บันทึกอุทกภัยน้ำท่วม</p>
                                <p className="mt-2 text-3xl font-bold text-cyan-700">{formatNumber(meeting_summary.kpis?.flood_records)}</p>
                                <p className="text-xs text-gray-500">จุด/หมู่บ้าน</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5 border border-violet-100">
                                <p className="text-xs font-semibold text-gray-500">ศูนย์พักพิงเปิด</p>
                                <p className="mt-2 text-3xl font-bold text-violet-700">{formatNumber(meeting_summary.kpis?.active_shelters)}</p>
                                <p className="text-xs text-gray-500">แห่ง</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5 border border-rose-100">
                                <p className="text-xs font-semibold text-gray-500">ผู้ป่วยสะสม</p>
                                <p className="mt-2 text-3xl font-bold text-rose-700">{formatNumber(meeting_summary.kpis?.disease_patients)}</p>
                                <p className="text-xs text-gray-500">ราย</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5 border border-emerald-100">
                                <p className="text-xs font-semibold text-gray-500">รายการเวชภัณฑ์</p>
                                <p className="mt-2 text-3xl font-bold text-emerald-700">{formatNumber(meeting_summary.kpis?.medical_item_types)}</p>
                                <p className="text-xs text-gray-500">ชนิด</p>
                            </div>
                        </div>
                        <div className="mt-4 bg-white rounded-lg shadow p-5">
                            <h4 className="font-semibold text-gray-800 mb-3">ประเด็นที่ควรติดตามในการประชุม</h4>
                            {meeting_summary.focus_points?.length > 0 ? (
                                <div className="grid gap-3 md:grid-cols-2">
                                    {meeting_summary.focus_points.map((item, index) => (
                                        <div key={index} className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">ยังไม่มีประเด็นเร่งด่วนจากข้อมูลที่บันทึกใน session นี้</p>
                            )}
                        </div>
                    </div>
                )}

                {/* Casualties Statistics */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="clipboard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถิติผู้ประสบภัย ({impactScopeLabel})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg shadow p-6 border border-red-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้เสียชีวิต</p>
                                    <p className="text-3xl font-bold text-red-600">{casualties.death}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="skull" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border border-orange-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้สูญหาย</p>
                                    <p className="text-3xl font-bold text-orange-600">{casualties.missing}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="search" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้บาดเจ็บ</p>
                                    <p className="text-3xl font-bold text-yellow-600">{casualties.injured}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="hospital" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border border-teal-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">รวมทั้งหมด</p>
                                    <p className="text-3xl font-bold text-teal-600">{casualties.total}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Affected Areas */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> พื้นที่ได้รับผลกระทบ ({impactScopeLabel})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">จำนวนอำเภอ</p>
                                    <p className="text-3xl font-bold text-blue-600">{affected_areas.districts}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="landmark" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">จำนวนตำบล</p>
                                    <p className="text-3xl font-bold text-green-600">{affected_areas.tambons}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="home" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>
                    </div>

                    {/* District List */}
                    {affected_areas.district_list && affected_areas.district_list.length > 0 && (
                        <div className="bg-white rounded-lg shadow p-6">
                            <h4 className="font-semibold text-gray-800 mb-3">รายชื่ออำเภอที่ได้รับผลกระทบ:</h4>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {affected_areas.district_list.map((district, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <span className="font-medium text-gray-700">{district.district}</span>
                                        <span className="text-sm text-gray-500">({district.total_casualties?.toLocaleString()} คน)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Flood Map */}
                <div className="mb-6">
                    <div className="flex flex-col gap-1 mb-4 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h3 className="text-xl font-bold text-gray-800">แผนที่อุทกภัยน้ำท่วมช่วง EOC</h3>
                            <p className="text-sm text-gray-500">
                                แสดงข้อมูลจากวันที่เปิดถึงวันที่ปิด EOC: {formatDateKey(mapStartDate)} - {formatDateKey(mapEndDate)}
                            </p>
                        </div>
                        <div className="text-sm text-gray-600">
                            วันที่มีข้อมูล {formatNumber(flood_map?.available_dates?.length)} วัน
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4 lg:grid-cols-5">
                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-gray-500">บันทึกอุทกภัยน้ำท่วม</p>
                            <p className="text-2xl font-bold text-blue-700">{formatNumber(flood_map?.stats?.total_records)}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-gray-500">พื้นที่ระดับสูง</p>
                            <p className="text-2xl font-bold text-red-700">{formatNumber(flood_map?.stats?.severe_count)}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-gray-500">พื้นที่ระดับปานกลาง</p>
                            <p className="text-2xl font-bold text-amber-700">{formatNumber(flood_map?.stats?.moderate_count)}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-gray-500">ครัวเรือนกระทบ</p>
                            <p className="text-2xl font-bold text-cyan-700">{formatNumber(flood_map?.stats?.affected_households)}</p>
                        </div>
                        <div className="bg-white rounded-lg shadow p-4">
                            <p className="text-xs text-gray-500">ประชาชนกระทบ</p>
                            <p className="text-2xl font-bold text-emerald-700">{formatNumber(flood_map?.stats?.affected_people)}</p>
                        </div>
                    </div>
                    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                        <div className="h-[560px] overflow-hidden rounded-lg border border-blue-100 bg-white shadow">
                            <PublicIncidentMap
                                disasterType="flood"
                                sessionId={session.id}
                                startDate={mapStartDate}
                                endDate={mapEndDate}
                                chrome="full"
                                heightClass="h-full"
                                layers={{
                                    floodAreas: true,
                                    district: true,
                                    tambon: false,
                                    village: false,
                                    labels: true,
                                    incidents: true,
                                    traffic: true,
                                    shelters: true,
                                    hospitals: true,
                                    waterways: true,
                                    hillshade: false
                                }}
                                baseMap="street"
                                includeAllShelters
                            />
                        </div>
                        <div className="bg-white rounded-lg shadow p-5">
                            <h4 className="font-semibold text-gray-800 mb-3">พื้นที่สำคัญจากบันทึกอุทกภัยน้ำท่วม</h4>
                            {flood_map?.events?.length > 0 ? (
                                <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                                    {flood_map.events.slice(0, 12).map((event) => (
                                        <div key={event.id} className="rounded-lg border border-gray-100 p-3">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="font-semibold text-gray-800">ต.{event.tambon || '-'} อ.{event.district || '-'}</p>
                                                <span className={`rounded-full px-2 py-1 text-xs font-semibold ${event.severity === 'severe' ? 'bg-red-100 text-red-700' : event.severity === 'moderate' ? 'bg-amber-100 text-amber-700' : 'bg-cyan-100 text-cyan-700'}`}>
                                                    {event.severity_label}
                                                </span>
                                            </div>
                                            <p className="mt-1 text-sm text-gray-600">{event.village || '-'}</p>
                                            <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-500">
                                                <span>{formatDateKey(event.recorded_day)}</span>
                                                <span>{formatNumber(event.affected_people)} คน</span>
                                                {event.water_depth_cm > 0 && <span>น้ำ {formatNumber(event.water_depth_cm)} ซม.</span>}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-sm text-gray-500">ยังไม่มีบันทึกอุทกภัยน้ำท่วมในช่วง session นี้</p>
                            )}
                        </div>
                    </div>
                </div>

                {isDailyMode && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="calendarDays" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เหตุการณ์ประจำวันที่ {effectiveDateLabel}</h3>
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                            <div className="bg-white rounded-lg shadow p-5">
                                <h4 className="font-semibold text-gray-800 mb-3">ผู้ได้รับผลกระทบ</h4>
                                {affected_areas.district_list?.length > 0 ? (
                                    <div className="space-y-2">
                                        {affected_areas.district_list.map((district, index) => (
                                            <div key={index} className="flex items-center justify-between border-b border-gray-100 pb-2 last:border-b-0">
                                                <span className="text-gray-700">{district.district}</span>
                                                <span className="font-semibold text-blue-700">{Number(district.total_casualties || 0).toLocaleString('th-TH')} คน</span>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">ไม่มีรายงานผู้ได้รับผลกระทบในวันนี้</p>
                                )}
                            </div>

                            <div className="bg-white rounded-lg shadow p-5">
                                <h4 className="font-semibold text-gray-800 mb-3">โรคที่รายงาน</h4>
                                {diseases.today?.length > 0 ? (
                                    <div className="space-y-2">
                                        {diseases.today.map((item, index) => (
                                            <div key={index} className="border-b border-gray-100 pb-2 last:border-b-0">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-700">{item.disease_name}</span>
                                                    <span className="font-semibold text-red-700">{Number(item.today_patients || 0).toLocaleString('th-TH')} คน</span>
                                                </div>
                                                <p className="text-xs text-gray-500">{item.district_name}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">ไม่มีรายงานโรคในวันนี้</p>
                                )}
                            </div>

                            <div className="bg-white rounded-lg shadow p-5">
                                <h4 className="font-semibold text-gray-800 mb-3">กิจกรรม/บันทึก</h4>
                                {dashboardData.recent_activities?.length > 0 ? (
                                    <div className="space-y-2">
                                        {dashboardData.recent_activities.map((activity, index) => (
                                            <div key={index} className="border-b border-gray-100 pb-2 last:border-b-0">
                                                <p className="text-sm font-medium text-gray-800">{activity.action}</p>
                                                <p className="text-sm text-gray-600">{activity.details}</p>
                                                <p className="text-xs text-gray-500">{new Date(activity.time).toLocaleTimeString('th-TH')}</p>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-sm">ไม่มีกิจกรรมที่บันทึกในวันนี้</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* IT Resources */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="monitor" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ทรัพยากร IT Support</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-700">Server</h4>
                                <div className="text-2xl"><AppIcon icon="monitor" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-green-600">● Online:</span>
                                    <span className="font-semibold">{resources.by_type.server.online}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-red-600">● Offline:</span>
                                    <span className="font-semibold">{resources.by_type.server.offline}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-yellow-600">● Maintenance:</span>
                                    <span className="font-semibold">{resources.by_type.server.maintenance}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-700">Internet</h4>
                                <div className="text-2xl"><AppIcon icon="earth" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-green-600">● Online:</span>
                                    <span className="font-semibold">{resources.by_type.internet.online}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-red-600">● Offline:</span>
                                    <span className="font-semibold">{resources.by_type.internet.offline}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-yellow-600">● Maintenance:</span>
                                    <span className="font-semibold">{resources.by_type.internet.maintenance}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-700">Network</h4>
                                <div className="text-2xl"><AppIcon icon="wifi" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-green-600">● Online:</span>
                                    <span className="font-semibold">{resources.by_type.network.online}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-red-600">● Offline:</span>
                                    <span className="font-semibold">{resources.by_type.network.offline}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-yellow-600">● Maintenance:</span>
                                    <span className="font-semibold">{resources.by_type.network.maintenance}</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-700">Hardware</h4>
                                <div className="text-2xl"><AppIcon icon="wrench" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                            <div className="space-y-1 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-green-600">● Online:</span>
                                    <span className="font-semibold">{resources.by_type.hardware.online}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-red-600">● Offline:</span>
                                    <span className="font-semibold">{resources.by_type.hardware.offline}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-yellow-600">● Maintenance:</span>
                                    <span className="font-semibold">{resources.by_type.hardware.maintenance}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* IT Resources Summary */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h4 className="font-semibold text-gray-800 mb-3">สรุปทรัพยากร IT:</h4>
                        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">ทั้งหมด</p>
                                <p className="text-2xl font-bold text-gray-800">{resources.summary.total_items}</p>
                            </div>
                            <div className="text-center p-3 bg-green-50 rounded-lg">
                                <p className="text-sm text-green-600">Online</p>
                                <p className="text-2xl font-bold text-green-600">{resources.summary.online_count}</p>
                            </div>
                            <div className="text-center p-3 bg-red-50 rounded-lg">
                                <p className="text-sm text-red-600">Offline</p>
                                <p className="text-2xl font-bold text-red-600">{resources.summary.offline_count}</p>
                            </div>
                            <div className="text-center p-3 bg-yellow-50 rounded-lg">
                                <p className="text-sm text-yellow-600">Maintenance</p>
                                <p className="text-2xl font-bold text-yellow-600">{resources.summary.maintenance_count}</p>
                            </div>
                            <div className="text-center p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-600">Unknown</p>
                                <p className="text-2xl font-bold text-gray-600">{resources.summary.unknown_count}</p>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Teams and Shelters */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                    {/* Teams */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ทีมปฏิบัติการ</h3>
                        {teams && teams.length > 0 ? (
                            <div className="space-y-3">
                                {teams.map((team, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <AppIcon icon={team.icon || "users"} className="h-7 w-7" />
                                            <div>
                                                <p className="font-semibold text-gray-800">{team.team_name_th}</p>
                                                <p className="text-sm text-gray-600">หัวหน้าทีม: {team.team_lead_name || '-'}</p>
                                            </div>
                                        </div>
                                        <div className="text-center">
                                            <p className="text-2xl font-bold text-blue-600">{team.member_count}</p>
                                            <p className="text-xs text-gray-500">สมาชิก</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-4">ยังไม่มีทีมปฏิบัติการ</p>
                        )}
                    </div>

                    {/* Shelters */}
                    <div className="bg-white rounded-lg shadow p-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="hospital" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ศูนย์พักพิง</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">ศูนย์พักพิงทั้งหมด</p>
                                    <p className="text-3xl font-bold text-blue-600">{shelters.total_shelters || 0}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="building" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">เปิดใน session นี้</p>
                                    <p className="text-3xl font-bold text-green-600">{formatNumber(shelters.session?.active_session_shelters || shelters.active_shelters)}</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-violet-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">ผู้พักพิงปัจจุบัน</p>
                                    <p className="text-3xl font-bold text-violet-600">{formatNumber(shelters.session?.session_occupancy || shelters.current_occupancy_total)}</p>
                                    <p className="text-xs text-gray-500">คน</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="personStanding" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-teal-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">ความจุรวม</p>
                                    <p className="text-3xl font-bold text-teal-600">{formatNumber(shelters.total_capacity)}</p>
                                    <p className="text-xs text-gray-500">คน</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disease Statistics Section */}
                {diseases && (
                    <>
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="biohazard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถิติโรคจากข้อมูลย้อนหลัง</h3>
                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-white rounded-lg shadow p-6 border border-blue-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">
                                                {isDailyMode ? `รายงานประจำวันที่ ${diseaseLatestDateLabel}` : `รายงานวันล่าสุด (${diseaseLatestDateLabel})`}
                                            </p>
                                            <p className="text-3xl font-bold text-blue-600">
                                                {diseases.today?.reduce((sum, d) => sum + parseInt(d.today_patients || 0), 0) || 0} คน
                                            </p>
                                        </div>
                                        <div className="text-4xl"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow p-6 border border-red-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">สะสมทั้งหมด</p>
                                            <p className="text-3xl font-bold text-red-600">
                                                {diseases.cumulative?.reduce((sum, d) => sum + parseInt(d.cumulative_patients || 0), 0) || 0} คน
                                            </p>
                                        </div>
                                        <div className="text-4xl"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow p-6 border border-green-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{isDailyMode ? 'โรคที่รายงานในวันนั้น' : 'โรคที่รายงาน'}</p>
                                            <p className="text-3xl font-bold text-green-600">{diseases.by_disease?.length || 0} โรค</p>
                                        </div>
                                        <div className="text-4xl"><AppIcon icon="biohazard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow p-6 border border-teal-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">หน่วยบริการ</p>
                                            <p className="text-3xl font-bold text-teal-600">{diseases.health_facilities || 0} แห่ง</p>
                                        </div>
                                        <div className="text-4xl"><AppIcon icon="hospital" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    </div>
                                </div>
                            </div>

                            {/* Disease Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Bar Chart by District */}
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h4 className="text-lg font-bold text-gray-800 mb-4"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถานการณ์แยกตามอำเภอ ({diseaseLatestDateLabel})</h4>
                                    {diseases.today && diseases.today.length > 0 ? (
                                        <Bar
                                            data={(() => {
                                                const districts = [...new Set(diseases.today.map(d => d.district_name))];
                                                const diseaseNames = [...new Set(diseases.today.map(d => d.disease_name))];
                                                const colors = [
                                                    'rgba(255, 99, 132, 0.8)',
                                                    'rgba(54, 162, 235, 0.8)',
                                                    'rgba(255, 206, 86, 0.8)',
                                                    'rgba(75, 192, 192, 0.8)',
                                                    'rgba(153, 102, 255, 0.8)',
                                                    'rgba(255, 159, 64, 0.8)'
                                                ];
                                                return {
                                                    labels: districts,
                                                    datasets: diseaseNames.map((disease, index) => ({
                                                        label: disease,
                                                        data: districts.map(district => {
                                                            const record = diseases.today.find(d => d.district_name === district && d.disease_name === disease);
                                                            return record ? parseInt(record.today_patients) : 0;
                                                        }),
                                                        backgroundColor: colors[index % colors.length]
                                                    }))
                                                };
                                            })()}
                                            options={{
                                                responsive: true,
                                                plugins: {
                                                    legend: { position: 'top' }
                                                },
                                                scales: {
                                                    y: { beginAtZero: true }
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">ยังไม่มีข้อมูลโรคย้อนหลังใน session นี้</div>
                                    )}
                                </div>

                                {/* Pie Chart by Disease */}
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h4 className="text-lg font-bold text-gray-800 mb-4"><AppIcon icon="pieChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สัดส่วนผู้ป่วยรายโรค ({isDailyMode ? effectiveDateLabel : 'สะสม'})</h4>
                                    {diseases.by_disease && diseases.by_disease.length > 0 ? (
                                        <Pie
                                            data={(() => {
                                                const colors = [
                                                    'rgba(255, 99, 132, 0.8)',
                                                    'rgba(54, 162, 235, 0.8)',
                                                    'rgba(255, 206, 86, 0.8)',
                                                    'rgba(75, 192, 192, 0.8)',
                                                    'rgba(153, 102, 255, 0.8)',
                                                    'rgba(255, 159, 64, 0.8)'
                                                ];
                                                return {
                                                    labels: diseases.by_disease.map(d => d.disease_name),
                                                    datasets: [{
                                                        data: diseases.by_disease.map(d => parseInt(d.cumulative_total)),
                                                        backgroundColor: colors,
                                                        borderWidth: 2,
                                                        borderColor: '#fff'
                                                    }]
                                                };
                                            })()}
                                            options={{
                                                responsive: true,
                                                plugins: {
                                                    legend: { position: 'right' }
                                                }
                                            }}
                                        />
                                    ) : (
                                        <div className="text-center py-8 text-gray-500">ยังไม่มีข้อมูล</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Shelter Disease Statistics */}
                {shelter_diseases && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">สถิติโรคในศูนย์พักพิง ({impactScopeLabel})</h3>
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                            <div className="bg-white rounded-lg shadow p-6 border border-blue-100">
                                <p className="text-sm text-gray-600">รายงานทั้งหมด</p>
                                <p className="text-3xl font-bold text-blue-700">{formatNumber(shelter_diseases.summary?.total_reports)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-red-100">
                                <p className="text-sm text-gray-600">ผู้ป่วยรายใหม่</p>
                                <p className="text-3xl font-bold text-red-700">{formatNumber(shelter_diseases.summary?.total_new_cases)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-amber-100">
                                <p className="text-sm text-gray-600">ส่งต่อ/นอน รพ.</p>
                                <p className="text-3xl font-bold text-amber-700">{formatNumber(shelter_diseases.summary?.total_hospitalized)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-violet-100">
                                <p className="text-sm text-gray-600">ศูนย์ที่มีรายงาน</p>
                                <p className="text-3xl font-bold text-violet-700">{formatNumber(shelter_diseases.summary?.shelters_with_reports)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-lg shadow p-6">
                                <h4 className="text-lg font-bold text-gray-800 mb-4">โรคที่พบในศูนย์พักพิง</h4>
                                {shelter_diseases.by_disease?.length > 0 ? (
                                    <Bar
                                        data={{
                                            labels: shelter_diseases.by_disease.map(item => item.disease_name),
                                            datasets: [
                                                {
                                                    label: 'รายใหม่',
                                                    data: shelter_diseases.by_disease.map(item => Number(item.new_cases || 0)),
                                                    backgroundColor: 'rgba(239, 68, 68, 0.75)'
                                                },
                                                {
                                                    label: 'ส่งต่อ/นอน รพ.',
                                                    data: shelter_diseases.by_disease.map(item => Number(item.hospitalized || 0)),
                                                    backgroundColor: 'rgba(245, 158, 11, 0.75)'
                                                }
                                            ]
                                        }}
                                        options={{
                                            responsive: true,
                                            plugins: { legend: { position: 'top' } },
                                            scales: { y: { beginAtZero: true } }
                                        }}
                                    />
                                ) : (
                                    <div className="text-center py-8 text-gray-500">ยังไม่มีรายงานโรคในศูนย์พักพิง</div>
                                )}
                            </div>
                            <div className="bg-white rounded-lg shadow p-6">
                                <h4 className="text-lg font-bold text-gray-800 mb-4">ศูนย์พักพิงที่ต้องติดตาม</h4>
                                {shelter_diseases.by_shelter?.length > 0 ? (
                                    <div className="space-y-3">
                                        {shelter_diseases.by_shelter.map((item, index) => (
                                            <div key={index} className="rounded-lg border border-gray-100 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-gray-800">{item.sheltername || 'ไม่ระบุศูนย์พักพิง'}</p>
                                                        <p className="text-xs text-gray-500">ต.{item.tambon || '-'} อ.{item.district_name || '-'}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-lg font-bold text-red-700">{formatNumber(item.new_cases)}</p>
                                                        <p className="text-xs text-gray-500">รายใหม่</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">ยังไม่มีศูนย์พักพิงที่มีรายงานโรค</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Vulnerable Groups Section */}
                {vulnerable_groups && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4"><AppIcon icon="accessibility" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> กลุ่มเปราะบาง</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                            <div className="bg-white rounded-lg shadow p-6 border border-red-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2"><AppIcon icon="user" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้สูงอายุ</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {parseInt(vulnerable_groups.summary?.total_elderly) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-blue-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2"><AppIcon icon="baby" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    <p className="text-sm text-gray-600 mb-1">เด็ก</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {parseInt(vulnerable_groups.summary?.total_children) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-yellow-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2"><AppIcon icon="accessibility" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    <p className="text-sm text-gray-600 mb-1">คนพิการ</p>
                                    <p className="text-2xl font-bold text-yellow-600">
                                        {parseInt(vulnerable_groups.summary?.total_disabled) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-pink-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2"><AppIcon icon="accessibility" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    <p className="text-sm text-gray-600 mb-1">หญิงตั้งครรภ์</p>
                                    <p className="text-2xl font-bold text-pink-600">
                                        {parseInt(vulnerable_groups.summary?.total_pregnant) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-teal-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2"><AppIcon icon="bed" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้ป่วยติดเตียง</p>
                                    <p className="text-2xl font-bold text-teal-600">
                                        {parseInt(vulnerable_groups.summary?.total_bedridden) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Vulnerable Groups Pie Chart */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h4 className="text-lg font-bold text-gray-800 mb-4"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สัดส่วนกลุ่มเปราะบาง</h4>
                            {vulnerable_groups.summary && (
                                <div className="max-w-md mx-auto">
                                    <Pie
                                        data={(() => {
                                            const data = [
                                                { label: 'ผู้สูงอายุ', value: parseInt(vulnerable_groups.summary.total_elderly) || 0, color: 'rgba(255, 99, 132, 0.8)' },
                                                { label: 'เด็ก', value: parseInt(vulnerable_groups.summary.total_children) || 0, color: 'rgba(54, 162, 235, 0.8)' },
                                                { label: 'คนพิการ', value: parseInt(vulnerable_groups.summary.total_disabled) || 0, color: 'rgba(255, 206, 86, 0.8)' },
                                                { label: 'หญิงตั้งครรภ์', value: parseInt(vulnerable_groups.summary.total_pregnant) || 0, color: 'rgba(255, 99, 255, 0.8)' },
                                                { label: 'ผู้ป่วยติดเตียง', value: parseInt(vulnerable_groups.summary.total_bedridden) || 0, color: 'rgba(153, 102, 255, 0.8)' }
                                            ];
                                            return {
                                                labels: data.map(d => d.label),
                                                datasets: [{
                                                    data: data.map(d => d.value),
                                                    backgroundColor: data.map(d => d.color),
                                                    borderWidth: 2,
                                                    borderColor: '#fff'
                                                }]
                                            };
                                        })()}
                                        options={{
                                            responsive: true,
                                            plugins: {
                                                legend: { position: 'right' }
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Medical Inventory */}
                {medical_inventory && (
                    <div className="mb-6">
                        <div className="flex flex-col gap-1 mb-4 md:flex-row md:items-end md:justify-between">
                            <div>
                                <h3 className="text-xl font-bold text-gray-800">ข้อมูลเวชภัณฑ์</h3>
                                <p className="text-sm text-gray-500">
                                    บันทึกในฐานข้อมูล{medical_inventory.event?.event_name ? `: ${medical_inventory.event.event_name}` : ''}
                                </p>
                            </div>
                            <span className="inline-flex w-fit rounded-full bg-emerald-50 px-3 py-1 text-sm font-semibold text-emerald-700">
                                source: {medical_inventory.source || 'database'}
                            </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 mb-6 lg:grid-cols-6">
                            <div className="bg-white rounded-lg shadow p-5">
                                <p className="text-xs text-gray-500">หน่วยบริการ</p>
                                <p className="text-2xl font-bold text-blue-700">{formatNumber(medical_inventory.summary?.agency_count)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5">
                                <p className="text-xs text-gray-500">ชนิดเวชภัณฑ์</p>
                                <p className="text-2xl font-bold text-emerald-700">{formatNumber(medical_inventory.summary?.item_types)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5">
                                <p className="text-xs text-gray-500">ยอดยกมา</p>
                                <p className="text-2xl font-bold text-slate-700">{formatNumber(medical_inventory.summary?.opening_qty)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5">
                                <p className="text-xs text-gray-500">รับเข้า</p>
                                <p className="text-2xl font-bold text-cyan-700">{formatNumber(medical_inventory.summary?.received_qty)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5">
                                <p className="text-xs text-gray-500">เบิกจ่าย</p>
                                <p className="text-2xl font-bold text-amber-700">{formatNumber(medical_inventory.summary?.issued_qty)}</p>
                            </div>
                            <div className="bg-white rounded-lg shadow p-5">
                                <p className="text-xs text-gray-500">คงเหลือ</p>
                                <p className="text-2xl font-bold text-green-700">{formatNumber(medical_inventory.summary?.balance_qty)}</p>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <div className="bg-white rounded-lg shadow p-6">
                                <h4 className="text-lg font-bold text-gray-800 mb-4">เวชภัณฑ์ที่มีการเบิก/คงเหลือสูง</h4>
                                {medical_inventory.top_items?.length > 0 ? (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full text-sm">
                                            <thead>
                                                <tr className="border-b text-left text-gray-500">
                                                    <th className="py-2 pr-3">รายการ</th>
                                                    <th className="py-2 pr-3 text-right">เบิกจ่าย</th>
                                                    <th className="py-2 text-right">คงเหลือ</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {medical_inventory.top_items.map((item) => (
                                                    <tr key={item.item_code} className="border-b last:border-b-0">
                                                        <td className="py-3 pr-3">
                                                            <p className="font-semibold text-gray-800">{item.item_name}</p>
                                                            <p className="text-xs text-gray-500">{item.item_code} • {item.unit || '-'}</p>
                                                        </td>
                                                        <td className="py-3 pr-3 text-right font-semibold text-amber-700">{formatNumber(item.issued_qty)}</td>
                                                        <td className="py-3 text-right font-semibold text-green-700">{formatNumber(item.balance_qty)}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">ยังไม่มีข้อมูลเวชภัณฑ์ในฐานข้อมูลสำหรับ session นี้</p>
                                )}
                            </div>
                            <div className="bg-white rounded-lg shadow p-6">
                                <h4 className="text-lg font-bold text-gray-800 mb-4">สรุปตามหน่วยบริการ</h4>
                                {medical_inventory.agency_summary?.length > 0 ? (
                                    <div className="space-y-3">
                                        {medical_inventory.agency_summary.map((agency) => (
                                            <div key={agency.agency_name} className="rounded-lg border border-gray-100 p-3">
                                                <div className="flex items-center justify-between gap-3">
                                                    <div>
                                                        <p className="font-semibold text-gray-800">{agency.agency_name}</p>
                                                        <p className="text-xs text-gray-500">{formatNumber(agency.item_types)} ชนิด • ยังไม่บันทึก {formatNumber(agency.not_recorded_rows)} รายการ</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="font-bold text-green-700">{formatNumber(agency.balance_qty)}</p>
                                                        <p className="text-xs text-gray-500">คงเหลือ</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <p className="text-sm text-gray-500">ยังไม่มีสรุปตามหน่วยบริการ</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-400 p-4 rounded-lg">
                    <div className="flex items-start">
                        <div className="text-2xl mr-3"><AppIcon icon="info" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                        <div>
                            <h4 className="font-semibold text-blue-800 mb-1">หมายเหตุ</h4>
                            <p className="text-sm text-blue-700">
                                Dashboard นี้แสดงข้อมูลภาพรวมสถานการณ์ EOC แบบเรียลไทม์
                                ข้อมูลจะอัปเดตอัตโนมัติตามการบันทึกของทีมปฏิบัติการ
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}
