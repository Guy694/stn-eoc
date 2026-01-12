"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import DailyVillageFloodTimeline from "@/components/DailyVillageFloodTimeline";
import FloodSessionSelector from "@/components/FloodSessionSelector";
import FloodAreaStatus from "@/components/FloodAreaStatus";
import PublicIncidentMap from "@/components/PublicIncidentMap";
import { useAuth } from "@/context/AuthContext";

export default function FloodMapPage() {
    const [mode, setMode] = useState("historical"); // "realtime" หรือ "historical"
    const [polygons, setPolygons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [activeSessionData, setActiveSessionData] = useState(null);
    const [sessionTeams, setSessionTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(false);
    const router = useRouter();
    const { user } = useAuth();

    // โหลดข้อมูล polygon
    useEffect(() => {
        fetch('/api/common/village-polygons')
            .then(res => {
                if (!res.ok) {
                    throw new Error(`HTTP error! status: ${res.status}`);
                }
                const contentType = res.headers.get('content-type');
                if (!contentType || !contentType.includes('application/json')) {
                    throw new Error('Response is not JSON');
                }
                return res.json();
            })
            .then(data => {
                setPolygons(data);
                setLoading(false);
            })
            .catch(err => {
                console.error('Error loading polygons:', err);
                setPolygons([]);
                setLoading(false);
            });
    }, []);

    // ตรวจสอบว่ามี Active EOC Session หรือไม่
    useEffect(() => {
        const checkActiveSession = async () => {
            try {
                const response = await fetch('/api/eoc/flood/area-status');
                const result = await response.json();
                setHasActiveSession(result.hasActiveSession || false);

                // บันทึกข้อมูล session เพื่อดึง teams
                if (result.hasActiveSession && result.activeSession) {
                    setActiveSessionData(result.activeSession);
                }

                // ถ้ามี active session ให้เปลี่ยนเป็นโหมด realtime
                if (result.hasActiveSession) {
                    setMode("realtime");
                }
            } catch (error) {
                console.error('Error checking active session:', error);
                setHasActiveSession(false);
            }
        };

        checkActiveSession();
    }, []);

    // ดึงข้อมูลทีมงาน EOC เมื่อมี Active Session
    useEffect(() => {
        const fetchSessionTeams = async () => {
            if (!activeSessionData?.session_id) return;

            setLoadingTeams(true);
            try {
                const response = await fetch(`/api/eoc/sessions/${activeSessionData.session_id}/teams`);
                const result = await response.json();

                if (result.success && Array.isArray(result.teams)) {
                    setSessionTeams(result.teams);
                } else {
                    setSessionTeams([]);
                }
            } catch (error) {
                console.error('Error fetching session teams:', error);
                setSessionTeams([]);
            } finally {
                setLoadingTeams(false);
            }
        };

        fetchSessionTeams();
    }, [activeSessionData]);

    // Handle session change
    const handleSessionChange = async (session, year) => {
        setSelectedSession(session);
        setSelectedYear(year);

        // ดึงข้อมูลทีมสำหรับ session ที่เลือก
        if (session?.session_id) {
            setLoadingTeams(true);
            try {
                const response = await fetch(`/api/admin/eoc-sessions/${session.session_id}/teams`);
                const data = await response.json();

                if (Array.isArray(data)) {
                    setSessionTeams(data);
                } else {
                    setSessionTeams([]);
                }
            } catch (error) {
                console.error('Error fetching session teams:', error);
                setSessionTeams([]);
            } finally {
                setLoadingTeams(false);
            }
        } else {
            setSessionTeams([]);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-gray-50">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mx-auto mb-4"></div>
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
                    <h1 className="text-3xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                        <span className="text-4xl">💧</span>
                        {mode === "realtime" ? "สถานการณ์น้ำท่วมปัจจุบัน" : "แผนที่สถานการณ์น้ำท่วมรายวัน"}
                    </h1>
                    <p className="text-gray-600">
                        {mode === "realtime"
                            ? "ติดตามสถานการณ์น้ำท่วมแบบเรียลไทม์"
                            : "ดูข้อมูลสรุปและประวัติการเกิดน้ำท่วมย้อนหลัง"}
                    </p>
                </div>


                {/* แสดงทีมงาน EOC ที่เปิดใช้งาน - Realtime Mode */}
                {mode === "realtime" && hasActiveSession && activeSessionData && sessionTeams.length > 0 && (
                    <div className="mb-6 bg-blue-50 border-l-4 border-blue-500 rounded-lg p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-blue-900 mb-4 flex items-center gap-2">
                            <span className="text-2xl">👥</span>
                            ทีมงาน EOC ที่ปฏิบัติงาน
                            <span className="text-sm font-normal text-blue-700 ml-2">
                                (Session #{activeSessionData.session_number})
                            </span>
                        </h2>

                        {loadingTeams ? (
                            <div className="flex items-center gap-2 text-blue-700">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500"></div>
                                <span>กำลังโหลดข้อมูลทีม...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {sessionTeams.map((team) => (
                                    <div key={team.session_team_id} className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
                                        <div className="mb-2">
                                            <h3 className="font-bold text-gray-900 text-lg">
                                                {team.team_name_th || team.team_name_en}
                                            </h3>
                                        </div>

                                        {team.team_lead_name && (
                                            <p className="text-sm text-gray-700 mb-1">
                                                <span className="font-medium">หัวหน้าทีม:</span> {team.team_lead_name}
                                            </p>
                                        )}

                                        <p className="text-sm text-blue-600 font-medium">
                                            สมาชิก: {team.member_count || 0} คน
                                        </p>

                                        {team.description && (
                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                                {team.description}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        )}

                    </div>

                )}


                {/* Mode Switcher - แสดงเฉพาะเมื่อมี Active Session */}
                {hasActiveSession && (
                    <div className="mb-6 flex gap-2 flex-wrap">
                        <button
                            onClick={() => setMode("realtime")}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === "realtime"
                                ? "bg-green-600 text-white shadow-lg"
                                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                                }`}
                        >
                            🔴 โหมด Realtime
                        </button>
                        <button
                            onClick={() => setMode("historical")}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === "historical"
                                ? "bg-green-600 text-white shadow-lg"
                                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                                }`}
                        >
                            📅 โหมดข้อมูลย้อนหลัง
                        </button>
                        {user && (
                            <button
                                onClick={() => router.push('/eoc/flood/records')}
                                className="px-6 py-3 rounded-lg font-medium transition-all bg-green-600 text-white hover:bg-green-700"
                            >
                                💾 บันทึกพื้นที่น้ำท่วม
                            </button>
                        )}
                    </div>
                )}


                {/* Realtime Mode - แสดงเฉพาะเมื่อมี Active Session */}
                {hasActiveSession && mode === "realtime" && (
                    <FloodAreaStatus polygons={polygons} />
                    
                    

                    
                )}

                {/* Historical Mode */}
                {(!hasActiveSession || mode === "historical") && (
                    <>
                        {/* Session Selector */}
                        <FloodSessionSelector
                            currentMode="historical"
                            onSessionChange={handleSessionChange}
                        />

                        {/* แสดงทีมงานของ session ที่เลือก */}
                        {selectedSession && sessionTeams.length > 0 && (
                            <div className="mt-6 mb-6 bg-amber-50 border-l-4 border-amber-500 rounded-lg p-6 shadow-sm">
                                <h2 className="text-xl font-bold text-amber-900 mb-4 flex items-center gap-2">
                                    <span className="text-2xl">👥</span>
                                    ทีมงาน EOC ในช่วงเวลานี้
                                    <span className="text-sm font-normal text-amber-700 ml-2">
                                        (Session #{selectedSession.session_number})
                                    </span>
                                </h2>

                                {loadingTeams ? (
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-amber-500"></div>
                                        <span>กำลังโหลดข้อมูลทีม...</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {sessionTeams.map((team) => (
                                            <div key={team.session_team_id} className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
                                                <div className="mb-2">
                                                    <h3 className="font-bold text-gray-900 text-lg">
                                                        {team.team_name_th || team.team_name_en}
                                                    </h3>
                                                </div>

                                                {team.team_lead_name && (
                                                    <p className="text-sm text-gray-700 mb-1">
                                                        <span className="font-medium">หัวหน้าทีม:</span> {team.team_lead_name}
                                                    </p>
                                                )}

                                                <p className="text-sm text-amber-600 font-medium">
                                                    สมาชิก: {team.member_count || 0} คน
                                                </p>

                                                {team.description && (
                                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                                        {team.description}
                                                    </p>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}


                        {/* Daily Village Flood Timeline */}
                        <div className="mt-6">
                            <DailyVillageFloodTimeline
                                session={selectedSession}
                                polygons={polygons}
                            />
                        </div>

                        {/* Public Incident Reports Map */}
                        <div className="mt-6">
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="text-3xl">📍</span>
                                    รายงานเหตุการณ์จากประชาชน (ข้อมูลที่ยืนยันแล้ว)
                                </h2>
                                <p className="text-gray-600 mb-4">
                                    แสดงจุดที่มีการรายงานเหตุการณ์น้ำท่วมจากประชาชนที่ได้รับการยืนยันแล้ว
                                </p>
                                <PublicIncidentMap />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </EOCLayout>
    );
}
