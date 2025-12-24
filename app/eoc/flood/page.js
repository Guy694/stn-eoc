"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import EOCLayout from "@/components/layouts/EOCLayout";
import DailyVillageFloodTimeline from "@/components/DailyVillageFloodTimeline";
import FloodSessionSelector from "@/components/FloodSessionSelector";
import FloodAreaStatus from "@/components/FloodAreaStatus";
import { useAuth } from "@/context/AuthContext";

export default function FloodMapPage() {
    const [mode, setMode] = useState("historical"); // "realtime" หรือ "historical"
    const [polygons, setPolygons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedSession, setSelectedSession] = useState(null);
    const [selectedYear, setSelectedYear] = useState(null);
    const [hasActiveSession, setHasActiveSession] = useState(false);
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

    // Handle session change
    const handleSessionChange = (session, year) => {
        setSelectedSession(session);
        setSelectedYear(year);
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

                {/* Mode Switcher - แสดงเฉพาะเมื่อมี Active Session */}
                {hasActiveSession && (
                    <div className="mb-6 flex gap-2 flex-wrap">
                        <button
                            onClick={() => setMode("realtime")}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === "realtime"
                                ? "bg-blue-600 text-white shadow-lg"
                                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                                }`}
                        >
                            🔴 โหมด Realtime
                        </button>
                        <button
                            onClick={() => setMode("historical")}
                            className={`px-6 py-3 rounded-lg font-medium transition-all ${mode === "historical"
                                ? "bg-blue-600 text-white shadow-lg"
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

                        {/* Daily Village Flood Timeline */}
                        <div className="mt-6">
                            <DailyVillageFloodTimeline
                                session={selectedSession}
                                polygons={polygons}
                            />
                        </div>
                    </>
                )}
            </div>
        </EOCLayout>
    );
}
