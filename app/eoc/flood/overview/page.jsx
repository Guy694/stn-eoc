'use client';

import { useEffect, useState } from 'react';
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

    useEffect(() => {
        fetchSessions();
    }, []);

    useEffect(() => {
        if (selectedSession) {
            fetchDashboardData(selectedSession, viewMode, selectedDate);
        }
    }, [selectedDate, selectedSession, viewMode]);

    const fetchSessions = async () => {
        try {
            const response = await fetch('/stn-eoc/api/eoc/sessions?type=flood&limit=100');
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                setSessions(result.data);
                const activeSession = result.data.find(session => session.status === 'active') || result.data[0];
                setSelectedSession(activeSession.id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching active sessions:', error);
            setLoading(false);
        }
    };

    const fetchDashboardData = async (sessionId, mode, date) => {
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
    };

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
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">📊 ภาพรวม EOC</h1>
                    <div className="bg-yellow-50 border border-yellow-400 p-6 rounded-lg">
                        <div className="flex items-center">
                            <div className="text-4xl mr-4">⚠️</div>
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

    const { session, casualties, affected_areas, resources, teams, shelters, diseases, vulnerable_groups } = dashboardData;
    const isDailyMode = dashboardData.filters?.mode === 'daily';
    const effectiveDateLabel = dashboardData.filters?.effective_date
        ? new Date(`${dashboardData.filters.effective_date}T00:00:00`).toLocaleDateString('th-TH')
        : 'วันที่เลือก';
    const diseaseLatestDateLabel = diseases?.latest_report_date
        ? new Date(`${String(diseases.latest_report_date).split('T')[0]}T00:00:00`).toLocaleDateString('th-TH')
        : 'วันล่าสุด';
    const impactScopeLabel = isDailyMode ? `ประจำวันที่ ${effectiveDateLabel}` : 'สะสมทั้ง session';

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 ภาพรวม EOC</h1>
                    <p className="text-gray-600">ภาพรวมสถานการณ์ EOC ตามข้อมูลที่บันทึกและกรอกย้อนหลัง</p>
                </div>

                {/* Display Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 items-end">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                เลือก EOC Session:
                            </label>
                            <select
                                value={selectedSession}
                                onChange={(e) => setSelectedSession(parseInt(e.target.value))}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                {sessions.map(s => (
                                    <option key={s.id} value={s.id}>
                                        {s.eoc_type} - Session #{s.session_number} ({new Date(s.opened_at).toLocaleDateString('th-TH')}) {s.status === 'active' ? 'เปิดอยู่' : 'ปิดแล้ว'}
                                    </option>
                                ))}
                            </select>
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
                        </div>
                        <div className="text-5xl">🚨</div>
                    </div>
                </div>

                {/* Casualties Statistics */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📋 สถิติผู้ประสบภัย ({impactScopeLabel})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg shadow p-6 border border-red-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้เสียชีวิต</p>
                                    <p className="text-3xl font-bold text-red-600">{casualties.death}</p>
                                </div>
                                <div className="text-4xl">🪦</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border border-orange-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้สูญหาย</p>
                                    <p className="text-3xl font-bold text-orange-600">{casualties.missing}</p>
                                </div>
                                <div className="text-4xl">🔍</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้บาดเจ็บ</p>
                                    <p className="text-3xl font-bold text-yellow-600">{casualties.injured}</p>
                                </div>
                                <div className="text-4xl">🏥</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border border-teal-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">รวมทั้งหมด</p>
                                    <p className="text-3xl font-bold text-teal-600">{casualties.total}</p>
                                </div>
                                <div className="text-4xl">👥</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Affected Areas */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📍 พื้นที่ได้รับผลกระทบ ({impactScopeLabel})</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">จำนวนอำเภอ</p>
                                    <p className="text-3xl font-bold text-blue-600">{affected_areas.districts}</p>
                                </div>
                                <div className="text-4xl">🏛️</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">จำนวนตำบล</p>
                                    <p className="text-3xl font-bold text-green-600">{affected_areas.tambons}</p>
                                </div>
                                <div className="text-4xl">🏘️</div>
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

                {isDailyMode && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">🗓️ เหตุการณ์ประจำวันที่ {effectiveDateLabel}</h3>
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
                    <h3 className="text-xl font-bold text-gray-800 mb-4">💻 ทรัพยากร IT Support</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                        <div className="bg-white rounded-lg shadow p-6">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="font-semibold text-gray-700">Server</h4>
                                <div className="text-2xl">🖥️</div>
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
                                <div className="text-2xl">🌐</div>
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
                                <div className="text-2xl">📡</div>
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
                                <div className="text-2xl">🔧</div>
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
                        <h3 className="text-xl font-bold text-gray-800 mb-4">👥 ทีมปฏิบัติการ</h3>
                        {teams && teams.length > 0 ? (
                            <div className="space-y-3">
                                {teams.map((team, index) => (
                                    <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                                        <div className="flex items-center gap-3">
                                            <span className="text-2xl">{team.icon}</span>
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
                        <h3 className="text-xl font-bold text-gray-800 mb-4">🏥 ศูนย์พักพิง</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">ศูนย์พักพิงทั้งหมด</p>
                                    <p className="text-3xl font-bold text-blue-600">{shelters.total_shelters || 0}</p>
                                </div>
                                <div className="text-4xl">🏢</div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">เปิดให้บริการ</p>
                                    <p className="text-3xl font-bold text-green-600">{shelters.active_shelters || 0}</p>
                                </div>
                                <div className="text-4xl">✅</div>
                            </div>
                            <div className="flex items-center justify-between p-4 bg-teal-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">ความจุรวม</p>
                                    <p className="text-3xl font-bold text-teal-600">{shelters.total_capacity || 0}</p>
                                    <p className="text-xs text-gray-500">คน</p>
                                </div>
                                <div className="text-4xl">👥</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Disease Statistics Section */}
                {diseases && (
                    <>
                        <div className="mb-6">
                            <h3 className="text-xl font-bold text-gray-800 mb-4">🦠 สถิติโรคจากข้อมูลย้อนหลัง</h3>
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
                                        <div className="text-4xl">📊</div>
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
                                        <div className="text-4xl">📈</div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow p-6 border border-green-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">{isDailyMode ? 'โรคที่รายงานในวันนั้น' : 'โรคที่รายงาน'}</p>
                                            <p className="text-3xl font-bold text-green-600">{diseases.by_disease?.length || 0} โรค</p>
                                        </div>
                                        <div className="text-4xl">🦠</div>
                                    </div>
                                </div>
                                <div className="bg-white rounded-lg shadow p-6 border border-teal-500">
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <p className="text-sm text-gray-600 mb-1">หน่วยบริการ</p>
                                            <p className="text-3xl font-bold text-teal-600">{diseases.health_facilities || 0} แห่ง</p>
                                        </div>
                                        <div className="text-4xl">🏥</div>
                                    </div>
                                </div>
                            </div>

                            {/* Disease Charts */}
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                {/* Bar Chart by District */}
                                <div className="bg-white rounded-lg shadow p-6">
                                    <h4 className="text-lg font-bold text-gray-800 mb-4">📊 สถานการณ์แยกตามอำเภอ ({diseaseLatestDateLabel})</h4>
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
                                    <h4 className="text-lg font-bold text-gray-800 mb-4">🥧 สัดส่วนผู้ป่วยรายโรค ({isDailyMode ? effectiveDateLabel : 'สะสม'})</h4>
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

                {/* Vulnerable Groups Section */}
                {vulnerable_groups && (
                    <div className="mb-6">
                        <h3 className="text-xl font-bold text-gray-800 mb-4">🧑‍🦽 กลุ่มเปราะบาง</h3>
                        <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                            <div className="bg-white rounded-lg shadow p-6 border border-red-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2">👴</div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้สูงอายุ</p>
                                    <p className="text-2xl font-bold text-red-600">
                                        {parseInt(vulnerable_groups.summary?.total_elderly) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-blue-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2">👶</div>
                                    <p className="text-sm text-gray-600 mb-1">เด็ก</p>
                                    <p className="text-2xl font-bold text-blue-600">
                                        {parseInt(vulnerable_groups.summary?.total_children) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-yellow-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2">♿</div>
                                    <p className="text-sm text-gray-600 mb-1">คนพิการ</p>
                                    <p className="text-2xl font-bold text-yellow-600">
                                        {parseInt(vulnerable_groups.summary?.total_disabled) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-pink-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2">🤰</div>
                                    <p className="text-sm text-gray-600 mb-1">หญิงตั้งครรภ์</p>
                                    <p className="text-2xl font-bold text-pink-600">
                                        {parseInt(vulnerable_groups.summary?.total_pregnant) || 0}
                                    </p>
                                </div>
                            </div>
                            <div className="bg-white rounded-lg shadow p-6 border border-teal-500">
                                <div className="text-center">
                                    <div className="text-3xl mb-2">🛏️</div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้ป่วยติดเตียง</p>
                                    <p className="text-2xl font-bold text-teal-600">
                                        {parseInt(vulnerable_groups.summary?.total_bedridden) || 0}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Vulnerable Groups Pie Chart */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h4 className="text-lg font-bold text-gray-800 mb-4">📊 สัดส่วนกลุ่มเปราะบาง</h4>
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

                {/* Info Box */}
                <div className="bg-blue-50 border border-blue-400 p-4 rounded-lg">
                    <div className="flex items-start">
                        <div className="text-2xl mr-3">ℹ️</div>
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
