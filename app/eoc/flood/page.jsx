"use client";
import { useCallback, useState, useEffect } from "react";
import { PageHero, heroPrimaryButtonClass } from "@/components/common/ThemePanels";
import { useRouter } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import DailyVillageFloodTimeline from "@/components/DailyVillageFloodTimeline";
import VulnerableGroupsVillageMap from "@/components/VulnerableGroupsVillageMap";
import FloodSessionSelector from "@/components/FloodSessionSelector";
import FloodAreaStatus from "@/components/FloodAreaStatus";
import PublicIncidentMap from "@/components/PublicIncidentMap";
import ShelterCenterMap from "@/components/ShelterCenterMap";
import { useAuth } from "@/context/AuthContext";
import AppIcon from "@/components/icons/AppIcon";

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
    const handleSessionChange = useCallback(async (session, year) => {
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
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-screen bg-slate-50">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                    <p className="text-slate-600 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <EOCLayout>
            <div className="w-full">
                {/* Page Header */}
                <PageHero icon="droplet" title={<>{mode === "realtime" ? "สถานการณ์อุทกภัยน้ำท่วมปัจจุบัน" : "แผนที่สถานการณ์อุทกภัยน้ำท่วมรายวัน"}</>} subtitle={<>{mode === "realtime" ? "ติดตามสถานการณ์อุทกภัยน้ำท่วมแบบเรียลไทม์" : "ดูข้อมูลสรุปและประวัติการเกิดอุทกภัยน้ำท่วมย้อนหลัง"}</>} actions={<>{user && (
                            <button
                                onClick={() => router.push('/eoc/flood/records')}
                                className={heroPrimaryButtonClass}
                            >
                                <AppIcon icon="save" className="h-4 w-4" /> บันทึก/แก้ไขพื้นที่อุทกภัยน้ำท่วม
                            </button>
                        )}</>} className="mb-6" />


                {/* แสดงทีมงาน EOC ที่เปิดใช้งาน - Realtime Mode */}
                {mode === "realtime" && hasActiveSession && activeSessionData && sessionTeams.length > 0 && (
                    <div className="mb-6 rounded-2xl border border-sky-200 bg-sky-50/60 p-5">
                        <h2 className="text-lg font-semibold text-[#083865] mb-4 flex items-center gap-2">
                            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><AppIcon icon="users" className="h-4 w-4" /></span>
                            ทีมงาน EOC ที่ปฏิบัติงาน
                            <span className="text-sm font-normal text-[#0b4c86] ml-2">
                                (ครั้งที่ {activeSessionData.session_number})
                            </span>
                        </h2>

                        {loadingTeams ? (
                            <div className="flex items-center gap-2 text-[#0b4c86]">
                                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                                <span>กำลังโหลดข้อมูลทีม...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {sessionTeams.map((team, index) => {
                                    const teamKey = `realtime-${team.session_team_id}-${team.team_id}-${index}`;
                                    const isExpanded = expandedTeams[teamKey];

                                    return (
                                        <div key={teamKey} className="border border-slate-200 bg-white rounded-2xl hover:shadow-md transition-shadow overflow-hidden">
                                            <div className="p-4">
                                                <div className="mb-2">
                                                    <h3 className="font-bold text-slate-900 text-lg">
                                                        {team.team_name_th || team.team_name_en}
                                                    </h3>
                                                </div>

                                                {team.team_lead_name && (
                                                    <p className="text-sm text-slate-700 mb-1">
                                                        <span className="font-medium">หัวหน้าทีม:</span> {team.team_lead_name}
                                                    </p>
                                                )}

                                                <div className="flex items-center justify-between mt-2">
                                                    <p className="text-sm text-[#0b4c86] font-medium">
                                                        สมาชิก: {team.member_count || 0} คน
                                                    </p>

                                                    {team.members && team.members.length > 0 && (
                                                        <button
                                                            onClick={() => toggleTeamExpand(teamKey)}
                                                            className="text-xs text-[#0b4c86] hover:text-[#083865] flex items-center gap-1 transition-colors"
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
                                                    <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                                        {team.description}
                                                    </p>
                                                )}
                                            </div>

                                            {/* แสดงรายชื่อสมาชิกเมื่อ expand */}
                                            {isExpanded && team.members && team.members.length > 0 && (
                                                <div className="border-t border-slate-100 bg-slate-50 p-3">
                                                    <p className="text-xs font-medium text-slate-600 mb-2">รายชื่อสมาชิก:</p>
                                                    <ul className="space-y-1">
                                                        {team.members.map((member, mIdx) => (
                                                            <li key={mIdx} className="text-sm text-slate-700 flex items-center gap-2">
                                                                <span className="w-1.5 h-1.5 bg-[#0b4c86] rounded-full"></span>
                                                                {member.given_name && member.family_name
                                                                    ? `${member.given_name} ${member.family_name}`
                                                                    : member.full_name || member.name || `สมาชิก ${mIdx + 1}`}
                                                                {member.role_in_team && (
                                                                    <span className="text-xs text-slate-500">({member.role_in_team})</span>
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
                                ? "bg-[#0b4c86] text-white shadow-lg"
                                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                }`}
                        >
                            <AppIcon icon="statusRed" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> โหมด Realtime
                        </button>
                        <button
                            onClick={() => setMode("historical")}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === "historical"
                                ? "bg-[#0b4c86] text-white shadow-lg"
                                : "bg-white text-slate-600 hover:bg-slate-50 border border-slate-200"
                                }`}
                        >
                            <AppIcon icon="calendar" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> โหมดข้อมูลย้อนหลัง
                        </button>
                    </div>
                )}


                {/* Realtime Mode - แสดงเฉพาะเมื่อมี Active Session */}
                {hasActiveSession && mode === "realtime" && (
                    <>
                        <FloodAreaStatus polygons={polygons} />

                        {/* แผนที่สถานการณ์อุทกภัยน้ำท่วมรายวัน (Realtime) */}
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
                            <div className="border border-slate-200 bg-white rounded-2xl p-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><AppIcon icon="mapPin" className="h-4 w-4" /></span>
                                    รายงานเหตุการณ์จากประชาชน (ข้อมูลที่ยืนยันแล้ว)
                                </h2>
                                <p className="text-slate-600 mb-4">
                                    แสดงจุดที่มีการรายงานเหตุการณ์อุทกภัยน้ำท่วมจากประชาชนที่ได้รับการยืนยันแล้ว
                                </p>
                                <PublicIncidentMap
                                    disasterType="flood"
                                    sessionId={activeSessionData?.id || null}
                                />
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
                            <div className="mt-6 mb-6 rounded-2xl border border-amber-200 bg-amber-50/70 p-5">
                                <h2 className="text-lg font-semibold text-amber-900 mb-4 flex items-center gap-2">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><AppIcon icon="users" className="h-4 w-4" /></span>
                                    ทีมงาน EOC ในช่วงเวลานี้
                                    <span className="text-sm font-normal text-amber-700 ml-2">
                                        (ครั้งที่ {selectedSession.session_number})
                                    </span>
                                </h2>

                                {loadingTeams ? (
                                    <div className="flex items-center gap-2 text-amber-700">
                                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                                        <span>กำลังโหลดข้อมูลทีม...</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {sessionTeams.map((team, index) => {
                                            const teamKey = `historical-${team.session_team_id}-${team.team_id}-${index}`;
                                            const isExpanded = expandedTeams[teamKey];

                                            return (
                                                <div key={teamKey} className="border border-slate-200 bg-white rounded-2xl hover:shadow-md transition-shadow overflow-hidden">
                                                    <div className="p-4">
                                                        <div className="mb-2">
                                                            <h3 className="font-bold text-slate-900 text-lg">
                                                                {team.team_name_th || team.team_name_en}
                                                            </h3>
                                                        </div>

                                                        {team.team_lead_name && (
                                                            <p className="text-sm text-slate-700 mb-1">
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
                                                            <p className="text-xs text-slate-500 mt-2 line-clamp-2">
                                                                {team.description}
                                                            </p>
                                                        )}
                                                    </div>

                                                    {/* แสดงรายชื่อสมาชิกเมื่อ expand */}
                                                    {isExpanded && team.members && team.members.length > 0 && (
                                                        <div className="border-t border-slate-100 bg-slate-50 p-3">
                                                            <p className="text-xs font-medium text-slate-600 mb-2">รายชื่อสมาชิก:</p>
                                                            <ul className="space-y-1">
                                                                {team.members.map((member, mIdx) => (
                                                                    <li key={mIdx} className="text-sm text-slate-700 flex items-center gap-2">
                                                                        <span className="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                                                                        {member.given_name && member.family_name
                                                                            ? `${member.given_name} ${member.family_name}`
                                                                            : member.full_name || member.name || `สมาชิก ${mIdx + 1}`}
                                                                        {member.role_in_team && (
                                                                            <span className="text-xs text-slate-500">({member.role_in_team})</span>
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

                        <div className="mt-6">
                            <VulnerableGroupsVillageMap
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
                            <div className="border border-slate-200 bg-white rounded-2xl p-6">
                                <h2 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sky-50 text-[#0b4c86] ring-1 ring-sky-100"><AppIcon icon="mapPin" className="h-4 w-4" /></span>
                                    รายงานเหตุการณ์จากประชาชน (ข้อมูลที่ยืนยันแล้ว)
                                </h2>
                                <p className="text-slate-600 mb-4">
                                    แสดงจุดที่มีการรายงานเหตุการณ์อุทกภัยน้ำท่วมจากประชาชนที่ได้รับการยืนยันแล้ว
                                </p>
                                <PublicIncidentMap
                                    disasterType="flood"
                                    sessionId={selectedSession?.id || null}
                                    startDate={selectedSession?.latest_flood_record_date || null}
                                    endDate={selectedSession?.latest_flood_record_date || null}
                                />
                            </div>
                        </div>
                    </>
                )}
            </div>
        </EOCLayout>
    );
}
