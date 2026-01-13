"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import AccidentMap from "@/components/AccidentMap";
import { useAuth } from "@/context/AuthContext";

export default function AccidentEOCPage() {
    const [mode, setMode] = useState("historical");
    const [loading, setLoading] = useState(true);
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [activeSession, setActiveSession] = useState(null);
    const [accidents, setAccidents] = useState([]);
    const [servicePoints, setServicePoints] = useState([]);
    const [healthFacilities, setHealthFacilities] = useState([]);
    const [stats, setStats] = useState({});
    const [sessionTeams, setSessionTeams] = useState([]);
    const router = useRouter();
    const { user } = useAuth();

    // ดึงข้อมูลเริ่มต้น
    useEffect(() => {
        const fetchData = async () => {
            try {
                setLoading(true);
                const response = await fetch('/api/eoc/accident/area-status');
                const result = await response.json();

                setHasActiveSession(result.hasActiveSession || false);
                setActiveSession(result.activeSession || null);
                setAccidents(result.accidents || []);
                setServicePoints(result.servicePoints || []);
                setHealthFacilities(result.healthFacilities || []);
                setStats(result.stats || {});

                if (result.hasActiveSession) {
                    setMode("realtime");
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, []);

    // ดึงข้อมูลทีมงาน
    useEffect(() => {
        const fetchTeams = async () => {
            if (!activeSession?.id) return;

            try {
                const response = await fetch(`/api/eoc/sessions/${activeSession.id}/teams`);
                const result = await response.json();
                if (result.success) {
                    setSessionTeams(result.teams || []);
                }
            } catch (error) {
                console.error('Error fetching teams:', error);
            }
        };

        fetchTeams();
    }, [activeSession]);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-orange-500 mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <EOCLayout>
            <div className="container mx-auto p-6">
                {/* Page Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <span className="text-4xl">🚗</span>
                        {hasActiveSession ? "ศูนย์ปฏิบัติการช่วง 7 วันอันตราย" : "EOC อุบัติเหตุ/ความปลอดภัย"}
                    </h1>
                    {activeSession && (
                        <p className="text-gray-600">
                            📅 Session #{activeSession.session_number} - {activeSession.open_reason || 'เทศกาล 7 วันอันตราย'}
                        </p>
                    )}
                </div>

                {/* Stats Summary */}
                {hasActiveSession && (
                    <div className="grid grid-cols-2 md:grid-cols-6 gap-4 mb-6">
                        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-red-500">
                            <div className="text-3xl font-bold text-red-600">{stats.total_accidents || 0}</div>
                            <div className="text-sm text-gray-600">อุบัติเหตุ</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-gray-800">
                            <div className="text-3xl font-bold text-gray-800">{stats.total_deaths || 0}</div>
                            <div className="text-sm text-gray-600">💀 เสียชีวิต</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-yellow-500">
                            <div className="text-3xl font-bold text-yellow-600">{stats.total_injuries || 0}</div>
                            <div className="text-sm text-gray-600">🤕 บาดเจ็บ</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-purple-500">
                            <div className="text-3xl font-bold text-purple-600">{stats.drunk_driving_cases || 0}</div>
                            <div className="text-sm text-gray-600">🍺 เมาแล้วขับ</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-orange-500">
                            <div className="text-3xl font-bold text-orange-600">{stats.total_service_points || 0}</div>
                            <div className="text-sm text-gray-600">🚧 จุดบริการ</div>
                        </div>
                        <div className="bg-white rounded-lg p-4 shadow border-l-4 border-blue-500">
                            <div className="text-3xl font-bold text-blue-600">{stats.total_health_facilities || 0}</div>
                            <div className="text-sm text-gray-600">🏥 หน่วยบริการ</div>
                        </div>
                    </div>
                )}

                {/* ทีมงาน EOC */}
                {hasActiveSession && sessionTeams.length > 0 && (
                    <div className="mb-6 bg-orange-50 border-l-4 border-orange-500 rounded-lg p-6">
                        <h2 className="text-xl font-bold text-orange-900 mb-4 flex items-center gap-2">
                            <span className="text-2xl">👥</span>
                            ทีมงาน EOC ที่ปฏิบัติงาน
                        </h2>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                            {sessionTeams.map((team, idx) => (
                                <div key={idx} className="bg-white rounded-lg p-4 shadow">
                                    <h3 className="font-bold text-gray-900">{team.team_name_th || team.team_name_en}</h3>
                                    {team.team_lead_name && (
                                        <p className="text-sm text-gray-600">หัวหน้า: {team.team_lead_name}</p>
                                    )}
                                    <p className="text-sm text-orange-600 font-medium">
                                        สมาชิก: {team.member_count || 0} คน
                                    </p>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {/* Mode Switcher & Quick Actions */}
                <div className="mb-6 flex gap-2 flex-wrap">
                    {hasActiveSession && (
                        <>
                            <button
                                onClick={() => setMode("realtime")}
                                className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === "realtime"
                                    ? "bg-orange-600 text-white shadow-lg"
                                    : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                                    }`}
                            >
                                🔴 โหมด Realtime
                            </button>
                        </>
                    )}
                    <button
                        onClick={() => setMode("historical")}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === "historical"
                            ? "bg-orange-600 text-white shadow-lg"
                            : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                            }`}
                    >
                        📅 โหมดข้อมูลย้อนหลัง
                    </button>

                    {user && hasActiveSession && (
                        <>
                            <button
                                onClick={() => router.push('/eoc/accident/records')}
                                className="px-6 py-3 rounded-lg font-medium bg-red-600 text-white hover:bg-red-700 transition-all"
                            >
                                🚗 บันทึกอุบัติเหตุ
                            </button>
                            <button
                                onClick={() => router.push('/eoc/accident/service-points')}
                                className="px-6 py-3 rounded-lg font-medium bg-blue-600 text-white hover:bg-blue-700 transition-all"
                            >
                                🚧 จัดการจุดบริการ
                            </button>
                        </>
                    )}
                </div>

                {/* แผนที่ */}
                <div className="mb-6">
                    <AccidentMap
                        accidents={accidents}
                        servicePoints={servicePoints}
                        healthFacilities={healthFacilities}
                    />
                </div>

                {/* ไม่มี Active Session */}
                {!hasActiveSession && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มี EOC Session ที่เปิดอยู่</h3>
                        <p className="text-gray-600 mb-4">
                            กรุณาเปิด EOC Session ก่อนบันทึกข้อมูลอุบัติเหตุ
                        </p>
                        {user && (
                            <button
                                onClick={() => router.push('/admin/eoc-control')}
                                className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700"
                            >
                                ไปหน้าจัดการ EOC
                            </button>
                        )}
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}
