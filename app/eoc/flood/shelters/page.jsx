"use client";
import EOCLayout from "@/components/layouts/EOCLayout";
import ShelterCenterMap from "@/components/ShelterCenterMap";
import { useEOC } from "@/context/EOCContext";
import { useEffect, useState } from "react";
import Link from "next/link";

import { useAuth } from "@/context/AuthContext";

export default function FloodSheltersPage() {
    const { eocStatus } = useEOC();
    const { user } = useAuth();
    const [sessionId, setSessionId] = useState(null);

    // ดึง session ID จาก EOC ที่เปิดอยู่
    useEffect(() => {
        const fetchActiveSession = async () => {
            try {
                const response = await fetch('/stn-eoc/api/eoc/flood/area-status');
                const result = await response.json();
                if (result.hasActiveSession && result.activeSession) {
                    setSessionId(result.activeSession.id);
                }
            } catch (error) {
                console.error('Error fetching active session:', error);
            }
        };
        fetchActiveSession();
    }, []);

    const floodEOC = eocStatus?.flood;
    const isActive = floodEOC?.is_active;
    const isAdmin = user?.role === 'admin';

    return (
        <EOCLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                                <span className="text-3xl">🏠</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">ศูนย์พักพิงชั่วคราว</h1>
                                <p className="text-gray-600">แผนที่และข้อมูลศูนย์พักพิงสำหรับผู้ประสบภัยน้ำท่วม</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            {isActive && isAdmin && (
                                <Link
                                    href="/eoc/flood/shelters/manage"
                                    className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                                >
                                    <span>✅</span>
                                    <span>เลือกศูนย์สำหรับ Session นี้</span>
                                </Link>
                            )}
                            {isAdmin && (
                                <Link
                                    href="/admin/shelter-center"
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                                >
                                    <span>⚙️</span>
                                    <span>จัดการข้อมูลหลัก</span>
                                </Link>
                            )}
                        </div>
                    </div>
                </div>

                {/* EOC Status Warning */}
                {!isActive && (
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                            <span className="text-2xl">⚠️</span>
                            <div>
                                <h3 className="font-bold text-yellow-800">EOC น้ำท่วมยังไม่ได้เปิด</h3>
                                <p className="text-yellow-700 text-sm">
                                    ข้อมูลที่แสดงเป็นข้อมูลศูนย์พักพิงทั้งหมดที่มีในระบบ
                                </p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Info Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl p-5 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-blue-100 text-sm">สถานะ EOC</p>
                                <p className="text-2xl font-bold mt-1">
                                    {isActive ? 'เปิดใช้งาน' : 'ปิด'}
                                </p>
                            </div>
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <span className="text-2xl">{isActive ? '🟢' : '⚪'}</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-xl p-5 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-green-100 text-sm">ประเภทศูนย์พักพิง</p>
                                <p className="text-2xl font-bold mt-1">น้ำท่วม</p>
                            </div>
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <span className="text-2xl">🌊</span>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl p-5 text-white">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-orange-100 text-sm">คำแนะนำ</p>
                                <p className="text-lg font-bold mt-1">คลิกจุดบนแผนที่</p>
                            </div>
                            <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center">
                                <span className="text-2xl">📍</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Shelter Map */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <ShelterCenterMap eocType="flood" sessionId={sessionId} />
                </div>
            </div>
        </EOCLayout>
    );
}
