"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import DailyVillageFloodTimeline from "@/components/DailyVillageFloodTimeline";
import FloodSessionSelector from "@/components/FloodSessionSelector";
import FloodAreaStatus from "@/components/FloodAreaStatus";
import PublicIncidentMap from "@/components/PublicIncidentMap";
import ShelterCenterMap from "@/components/ShelterCenterMap";
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
    const [expandedTeams, setExpandedTeams] = useState({}); // เก็บสถานะ expand ของแต่ละทีม
    const router = useRouter();
    const { user } = useAuth();

    // Toggle expand/collapse ของทีม
    const toggleTeamExpand = (teamId) => {
        setExpandedTeams(prev => ({
            ...prev,
            [teamId]: !prev[teamId]
        }));
    };

    // โหลดข้อมูล polygon
    useEffect(() => {
        fetch('/stn-eoc/api/common/village-polygons')
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
                const response = await fetch('/stn-eoc/api/eoc/flood/area-status');
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
            if (!activeSessionData?.id) return;

            setLoadingTeams(true);
            try {
                const response = await fetch(`/stn-eoc/api/eoc/sessions/${activeSessionData.id}/teams`);
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
        if (session?.id) {
            setLoadingTeams(true);
            try {
                const response = await fetch(`/stn-eoc/api/eoc/sessions/${session.id}/teams`);
                const data = await response.json();

                if (data.success && Array.isArray(data.teams)) {
                    setSessionTeams(data.teams);
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
                                {sessionTeams.map((team, index) => {
                                    const teamKey = `realtime-${team.session_team_id}-${team.team_id}-${index}`;
                                    const isExpanded = expandedTeams[teamKey];

                                    return (
                                        <div key={teamKey} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden">
                                            <div className="p-4">
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

                                                <div className="flex items-center justify-between mt-2">
                                                    <p className="text-sm text-blue-600 font-medium">
                                                        สมาชิก: {team.member_count || 0} คน
                                                    </p>

                                                    {team.members && team.members.length > 0 && (
                                                        <button
                                                            onClick={() => toggleTeamExpand(teamKey)}
                                                            className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1 transition-colors"
                                                        >
                                                            {isExpanded ? (
                                                                <>
                                                                    <span>ซ่อน</span>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                                    </svg>
                                                                </>
                                                            ) : (
                                                                <>
                                                                    <span>ดูสมาชิก</span>
                                                                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                    </svg>
                                                                </>
                                                            )}
                                                        </button>
                                                    )}
                                                </div>

                                                {team.description && (
                                                    <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                                        {team.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* แสดงรายชื่อสมาชิกเมื่อ expand */}
                                            {isExpanded && team.members && team.members.length > 0 && (
                                                <div className="border-t border-gray-100 bg-gray-50 p-3">
                                                    <p className="text-xs font-medium text-gray-600 mb-2">รายชื่อสมาชิก:</p>
                                                    <ul className="space-y-1">
                                                        {team.members.map((member, mIdx) => (
                                                            <li key={mIdx} className="text-sm text-gray-700 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 bg-blue-500 rounded-full"></span>
                                                                {member.given_name && member.family_name
                                                                    ? `${member.given_name} ${member.family_name}`
                                                                    : member.full_name || member.name || `สมาชิก ${mIdx + 1}`}
                                                                {member.role_in_team && (
                                                                    <span className="text-xs text-gray-500">({member.role_in_team})</span>
                                                                )}
                                                            </li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
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
                    <>
                        <FloodAreaStatus polygons={polygons} />

                        {/* แผนที่สถานการณ์น้ำท่วมรายวัน (Realtime) */}
                        {/* DailyVillageFloodTimeline ใช้ในโหมดข้อมูลย้อนหลังเท่านั้น 
                        {activeSessionData && (
                            <div className="mt-6">
                                <DailyVillageFloodTimeline
                                    session={activeSessionData}
                                    polygons={polygons}
                                />
                            </div>
                        )} */}

                        {/* Shelter Centers Map */}
                        {/* <div className="mt-6">
                            <ShelterCenterMap eocType="flood" sessionId={activeSessionData?.id} />
                        </div> */}

                        {/* Public Incident Reports Map */}
                        <div className="mt-6">
                            <div className="bg-white rounded-lg shadow-md p-6">
                                <h2 className=" text-center text-xl md:text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
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
                                        {sessionTeams.map((team, index) => {
                                            const teamKey = `historical-${team.session_team_id}-${team.team_id}-${index}`;
                                            const isExpanded = expandedTeams[teamKey];

                                            return (
                                                <div key={teamKey} className="bg-white rounded-lg shadow hover:shadow-md transition-shadow overflow-hidden">
                                                    <div className="p-4">
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

                                                        <div className="flex items-center justify-between mt-2">
                                                            <p className="text-sm text-amber-600 font-medium">
                                                                สมาชิก: {team.member_count || 0} คน
                                                            </p>

                                                            {team.members && team.members.length > 0 && (
                                                                <button
                                                                    onClick={() => toggleTeamExpand(teamKey)}
                                                                    className="text-xs text-amber-600 hover:text-amber-800 flex items-center gap-1 transition-colors"
                                                                >
                                                                    {isExpanded ? (
                                                                        <>
                                                                            <span>ซ่อน</span>
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                                                                            </svg>
                                                                        </>
                                                                    ) : (
                                                                        <>
                                                                            <span>ดูสมาชิก</span>
                                                                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                                                            </svg>
                                                                        </>
                                                                    )}
                                                                </button>
                                                            )}
                                                        </div>

                                                        {team.description && (
                                                            <p className="text-xs text-gray-500 mt-2 line-clamp-2">
                                                                {team.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* แสดงรายชื่อสมาชิกเมื่อ expand */}
                                                    {isExpanded && team.members && team.members.length > 0 && (
                                                        <div className="border-t border-gray-100 bg-gray-50 p-3">
                                                            <p className="text-xs font-medium text-gray-600 mb-2">รายชื่อสมาชิก:</p>
                                                            <ul className="space-y-1">
                                                                {team.members.map((member, mIdx) => (
                                                                    <li key={mIdx} className="text-sm text-gray-700 flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                                                        {member.given_name && member.family_name
                                                                            ? `${member.given_name} ${member.family_name}`
                                                                            : member.full_name || member.name || `สมาชิก ${mIdx + 1}`}
                                                                        {member.role_in_team && (
                                                                            <span className="text-xs text-gray-500">({member.role_in_team})</span>
                                                                        )}
                                                                    </li>
                                                                ))}
                                                            </ul>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
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

                        {/* Shelter Centers Map */}
                        {/* <div className="mt-6">
                            <ShelterCenterMap eocType="flood" sessionId={selectedSession?.id} />
                        </div> */}

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
