'use client';
import { useState, useEffect } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import DisasterSessionSelector from "@/components/DisasterSessionSelector";
import DailyDiseaseChart from "@/components/DailyDiseaseChart";
import DiseaseSummaryCards from "@/components/DiseaseSummaryCards";
import { getDisasterConfig } from "@/lib/disasterConfig";

export default function DiseasePage() {
    const [selectedSession, setSelectedSession] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [viewMode, setViewMode] = useState('realtime');
    const [hasActiveSession, setHasActiveSession] = useState(false);
    const [activeSessionData, setActiveSessionData] = useState(null);
    const [sessionTeams, setSessionTeams] = useState([]);
    const [loadingTeams, setLoadingTeams] = useState(false);

    const config = getDisasterConfig('disease');

    // ตรวจสอบว่ามี Active EOC Session หรือไม่
    useEffect(() => {
        const checkActiveSession = async () => {
            try {
                const response = await fetch('/api/eoc/status?type=disease');
                const result = await response.json();

                if (result.success && result.data) {
                    // result.data เป็น array ของ EOC status
                    // หา disease EOC ที่เปิดอยู่
                    const diseaseStatus = Array.isArray(result.data)
                        ? result.data.find(s => s.eoc_type === 'disease' && s.is_active)
                        : (result.data.eoc_type === 'disease' && result.data.is_active ? result.data : null);

                    if (diseaseStatus) {
                        setHasActiveSession(true);
                        // ใช้ข้อมูลจาก session_id ที่ได้จาก API
                        setActiveSessionData({
                            id: diseaseStatus.session_id,
                            session_number: diseaseStatus.session_number,
                            eoc_type: diseaseStatus.eoc_type,
                            opened_at: diseaseStatus.activated_at,
                            status: 'active'
                        });
                        setViewMode('realtime');
                    } else {
                        setHasActiveSession(false);
                    }
                } else {
                    setHasActiveSession(false);
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
                const response = await fetch(`/api/eoc/sessions/${activeSessionData.id}/teams`);
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

    const handleSessionChange = async (session, year) => {
        setSelectedSession(session);
        setSelectedYear(year);

        // ดึงข้อมูลทีมสำหรับ session ที่เลือก
        if (session?.id) {
            setLoadingTeams(true);
            try {
                const response = await fetch(`/api/eoc/sessions/${session.id}/teams`);
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

    // กำหนด session ที่จะใช้แสดงข้อมูล
    const currentSession = viewMode === 'realtime' ? activeSessionData : selectedSession;

    return (
        <EOCLayout>
            <div className="container mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-4 flex items-center gap-3">
                        <span className="text-4xl">{config.icon}</span>
                        {viewMode === 'realtime'
                            ? 'สถานการณ์โรครายวัน'
                            : 'ข้อมูลสถานการณ์โรคย้อนหลัง'}
                    </h1>

                    <p className="text-gray-600">
                        {viewMode === 'realtime'
                            ? 'ติดตามสถานการณ์โรคระบาดแบบเรียลไทม์ตั้งแต่เปิด EOC'
                            : 'ดูข้อมูลสรุปและประวัติการระบาดย้อนหลัง'
                        }
                    </p>
                </div>

                {/* Mode Switcher - แสดงปุ่มข้อมูลย้อนหลังเสมอ */}
                <div className="mb-6 flex gap-2 flex-wrap">
                    {hasActiveSession && (
                        <button
                            onClick={() => setViewMode('realtime')}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${viewMode === 'realtime'
                                ? 'bg-red-500 text-white shadow-lg transform scale-105'
                                : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                                }`}
                        >
                            <span className="mr-2">🔴</span>
                            โหมดเรียลไทม์
                        </button>
                    )}
                    <button
                        onClick={() => setViewMode('historical')}
                        className={`px-6 py-3 rounded-lg font-medium transition-all ${viewMode === 'historical'
                            ? 'bg-purple-500 text-white shadow-lg transform scale-105'
                            : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                            }`}
                    >
                        <span className="mr-2">📊</span>
                        โหมดข้อมูลย้อนหลัง
                    </button>
                </div>

                {/* Quick Menu Links */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <a
                        href="/eoc/disease/daily-risk"
                        className="bg-white border-2 border-purple-200 rounded-lg p-4 hover:shadow-lg hover:border-purple-400 transition-all flex items-center gap-3"
                    >
                        <span className="text-3xl">📊</span>
                        <div>
                            <h3 className="font-bold text-gray-800">สรุปรายวัน</h3>
                            <p className="text-sm text-gray-600">ดูสถานการณ์โรคแยกตามวัน</p>
                        </div>
                    </a>
                    <a
                        href="/eoc/disease/records"
                        className="bg-white border-2 border-green-200 rounded-lg p-4 hover:shadow-lg hover:border-green-400 transition-all flex items-center gap-3"
                    >
                        <span className="text-3xl">📝</span>
                        <div>
                            <h3 className="font-bold text-gray-800">บันทึกข้อมูล</h3>
                            <p className="text-sm text-gray-600">เพิ่ม/แก้ไข รายงานโรค</p>
                        </div>
                    </a>
                    <a
                        href="/admin/disease-reports"
                        className="bg-white border-2 border-blue-200 rounded-lg p-4 hover:shadow-lg hover:border-blue-400 transition-all flex items-center gap-3"
                    >
                        <span className="text-3xl">📋</span>
                        <div>
                            <h3 className="font-bold text-gray-800">จัดการรายงาน</h3>
                            <p className="text-sm text-gray-600">ดูรายงานทั้งหมด</p>
                        </div>
                    </a>
                </div>

                {/* แสดงทีมงาน EOC ที่เปิดใช้งาน - Realtime Mode */}
                {viewMode === 'realtime' && hasActiveSession && activeSessionData && sessionTeams.length > 0 && (
                    <div className="mb-6 bg-red-50 border-l-4 border-red-500 rounded-lg p-6 shadow-sm">
                        <h2 className="text-xl font-bold text-red-900 mb-4 flex items-center gap-2">
                            <span className="text-2xl">👥</span>
                            ทีมงาน EOC ที่ปฏิบัติงาน
                            <span className="text-sm font-normal text-red-700 ml-2">
                                (Session #{activeSessionData.session_number})
                            </span>
                        </h2>

                        {loadingTeams ? (
                            <div className="flex items-center gap-2 text-red-700">
                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                                <span>กำลังโหลดข้อมูลทีม...</span>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {sessionTeams.map((team, index) => (
                                    <div key={`realtime-${team.session_team_id}-${team.team_id}-${index}`} className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
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

                                        <p className="text-sm text-red-600 font-medium">
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

                {/* Session Selector สำหรับ Historical Mode */}
                {(!hasActiveSession || viewMode === 'historical') && (
                    <>
                        <DisasterSessionSelector
                            disasterType="disease"
                            currentMode={viewMode}
                            onSessionChange={handleSessionChange}
                        />

                        {/* แสดงทีมงานของ session ที่เลือก */}
                        {selectedSession && sessionTeams.length > 0 && (
                            <div className="mt-6 mb-6 bg-purple-50 border-l-4 border-purple-500 rounded-lg p-6 shadow-sm">
                                <h2 className="text-xl font-bold text-purple-900 mb-4 flex items-center gap-2">
                                    <span className="text-2xl">👥</span>
                                    ทีมงาน EOC ในช่วงเวลานี้
                                    <span className="text-sm font-normal text-purple-700 ml-2">
                                        (Session #{selectedSession.session_number})
                                    </span>
                                </h2>

                                {loadingTeams ? (
                                    <div className="flex items-center gap-2 text-purple-700">
                                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-purple-500"></div>
                                        <span>กำลังโหลดข้อมูลทีม...</span>
                                    </div>
                                ) : (
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        {sessionTeams.map((team, index) => (
                                            <div key={`historical-${team.session_team_id}-${team.team_id}-${index}`} className="bg-white rounded-lg p-4 shadow hover:shadow-md transition-shadow">
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

                                                <p className="text-sm text-purple-600 font-medium">
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
                    </>
                )}

                {/* แสดงข้อมูลเมื่อมี session */}
                {currentSession && (
                    <>
                        {/* Summary Cards */}
                        <DiseaseSummaryCards sessionId={currentSession.id} />

                        {/* Daily Chart */}
                        <DailyDiseaseChart sessionId={currentSession.id} />
                    </>
                )}

                {/* Empty State - ไม่มี session */}
                {!currentSession && (
                    <div className="bg-white rounded-lg shadow-md p-8 text-center mt-6">
                        <div className="text-6xl mb-4">{config.icon}</div>
                        <h2 className="text-2xl font-bold text-gray-800 mb-2">
                            {viewMode === 'realtime'
                                ? 'ไม่มี EOC Session ที่เปิดอยู่'
                                : 'กรุณาเลือก Session ที่ต้องการดู'}
                        </h2>
                        <p className="text-gray-600 mb-4">
                            {viewMode === 'realtime'
                                ? 'เมื่อมีการเปิด EOC Session สำหรับติดตามโรคระบาด ข้อมูลจะแสดงที่นี่'
                                : 'เลือก Session จากรายการด้านบนเพื่อดูข้อมูลย้อนหลัง'}
                        </p>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}
