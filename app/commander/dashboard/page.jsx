'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import EOCLayout from '@/components/layouts/EOCLayout';

export default function CommanderDashboard() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const [loading, setLoading] = useState(true);
    const [dashboardData, setDashboardData] = useState(null);
    const [activeSessions, setActiveSessions] = useState([]);
    const [selectedSession, setSelectedSession] = useState(null);

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'commander')) {
            router.push('/dashboard');
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        fetchActiveSessions();
    }, []);

    useEffect(() => {
        if (selectedSession) {
            fetchDashboardData(selectedSession);
        }
    }, [selectedSession]);

    const fetchActiveSessions = async () => {
        try {
            const response = await fetch('/api/eoc/sessions?status=active');
            const result = await response.json();
            if (result.success && result.data.length > 0) {
                setActiveSessions(result.data);
                setSelectedSession(result.data[0].id);
            } else {
                setLoading(false);
            }
        } catch (error) {
            console.error('Error fetching active sessions:', error);
            setLoading(false);
        }
    };

    const fetchDashboardData = async (sessionId) => {
        try {
            setLoading(true);
            const response = await fetch(`/api/commander/dashboard?session_id=${sessionId}`);
            const result = await response.json();

            if (result.success) {
                setDashboardData(result.data);
            } else {
                console.error('Error:', result.error);
            }
        } catch (error) {
            console.error('Error fetching dashboard data:', error);
        } finally {
            setLoading(false);
        }
    };

    if (authLoading || loading) {
        return (
            <EOCLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!user || user.role !== 'commander') return null;

    if (activeSessions.length === 0) {
        return (
            <EOCLayout>
                <div className="max-w-7xl mx-auto p-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-6">📊 Dashboard ผู้บัญชาการ</h1>
                    <div className="bg-yellow-50 border-l-4 border-yellow-400 p-6 rounded-lg">
                        <div className="flex items-center">
                            <div className="text-4xl mr-4">⚠️</div>
                            <div>
                                <h3 className="text-lg font-semibold text-yellow-800">ไม่มี EOC Session ที่เปิดอยู่</h3>
                                <p className="text-yellow-700">กรุณารอให้ Admin เปิด EOC Session หรือติดต่อผู้ดูแลระบบ</p>
                            </div>
                        </div>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!dashboardData) return null;

    const { session, casualties, affected_areas, resources, teams, shelters } = dashboardData;

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 Dashboard ผู้บัญชาการ</h1>
                    <p className="text-gray-600">ภาพรวมสถานการณ์ EOC แบบเรียลไทม์</p>
                </div>

                {/* Session Selector */}
                {activeSessions.length > 1 && (
                    <div className="bg-white rounded-lg shadow p-4 mb-6">
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            เลือก EOC Session:
                        </label>
                        <select
                            value={selectedSession}
                            onChange={(e) => setSelectedSession(parseInt(e.target.value))}
                            className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {activeSessions.map(s => (
                                <option key={s.id} value={s.id}>
                                    {s.eoc_type_name} - Session #{s.session_number} ({new Date(s.open_time).toLocaleDateString('th-TH')})
                                </option>
                            ))}
                        </select>
                    </div>
                )}

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
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📋 สถิติผู้ประสบภัย</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-red-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้เสียชีวิต</p>
                                    <p className="text-3xl font-bold text-red-600">{casualties.death}</p>
                                </div>
                                <div className="text-4xl">🪦</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-orange-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้สูญหาย</p>
                                    <p className="text-3xl font-bold text-orange-600">{casualties.missing}</p>
                                </div>
                                <div className="text-4xl">🔍</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-yellow-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">ผู้บาดเจ็บ</p>
                                    <p className="text-3xl font-bold text-yellow-600">{casualties.injured}</p>
                                </div>
                                <div className="text-4xl">🏥</div>
                            </div>
                        </div>

                        <div className="bg-white rounded-lg shadow p-6 border-l-4 border-purple-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">รวมทั้งหมด</p>
                                    <p className="text-3xl font-bold text-purple-600">{casualties.total}</p>
                                </div>
                                <div className="text-4xl">👥</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Affected Areas */}
                <div className="mb-6">
                    <h3 className="text-xl font-bold text-gray-800 mb-4">📍 พื้นที่ได้รับผลกระทบ</h3>
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
                                        <span className="text-sm text-gray-500">({district.total_casualties} คน)</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

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
                            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
                                <div>
                                    <p className="text-sm text-gray-600">ความจุรวม</p>
                                    <p className="text-3xl font-bold text-purple-600">{shelters.total_capacity || 0}</p>
                                    <p className="text-xs text-gray-500">คน</p>
                                </div>
                                <div className="text-4xl">👥</div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Info Box */}
                <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded-lg">
                    <div className="flex items-start">
                        <div className="text-2xl mr-3">ℹ️</div>
                        <div>
                            <h4 className="font-semibold text-blue-800 mb-1">หมายเหตุ</h4>
                            <p className="text-sm text-blue-700">
                                Dashboard นี้แสดงข้อมูลแบบ Read-only สำหรับผู้บัญชาการ
                                ข้อมูลจะอัปเดตอัตโนมัติตามการบันทึกของทีมปฏิบัติการ
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </EOCLayout>
    );
}
