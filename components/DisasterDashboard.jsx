"use client";
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { getDisasterConfig, getAllDisasterTypesSync } from '@/lib/disasterConfig';
import AppIcon from "@/components/icons/AppIcon";

export default function DisasterDashboard() {
    const [activeSessions, setActiveSessions] = useState({});
    const [loading, setLoading] = useState(true);
    const [disasterTypes, setDisasterTypes] = useState([]);

    const fetchAllActiveSessions = useCallback(async (types) => {
        setLoading(true);
        const sessionsData = {};

        await Promise.all(
            types.map(async (type) => {
                try {
                    const response = await fetch(`/stn-eoc/api/eoc/${type}/sessions-summary`);
                    const data = await response.json();
                    if (data.success && data.yearSummaries?.length > 0) {
                        const currentYear = data.yearSummaries[0];
                        sessionsData[type] = {
                            active: currentYear.active_sessions || 0,
                            total: currentYear.total_sessions || 0,
                            activities: currentYear.total_activities || 0
                        };
                    }
                } catch (error) {
                    console.error(`Error fetching ${type} sessions:`, error);
                }
            })
        );

        setActiveSessions(sessionsData);
        setLoading(false);
    }, []);

    const loadDisasterTypes = useCallback(async () => {
        try {
            // ดึงข้อมูล EOC Types จาก API
            const response = await fetch('/stn-eoc/api/admin/eoc-types?active=true');
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                const types = result.data.map(item => item.id);
                setDisasterTypes(types);
                // โหลด sessions หลังจากได้ types แล้ว
                await fetchAllActiveSessions(types);
            } else {
                // fallback ถ้าไม่มีข้อมูล
                const defaultTypes = getAllDisasterTypesSync();
                setDisasterTypes(defaultTypes);
                await fetchAllActiveSessions(defaultTypes);
            }
        } catch (error) {
            console.error('Error loading disaster types:', error);
            const defaultTypes = getAllDisasterTypesSync();
            setDisasterTypes(defaultTypes);
            await fetchAllActiveSessions(defaultTypes);
        }
    }, [fetchAllActiveSessions]);

    useEffect(() => {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        loadDisasterTypes();
    }, [loadDisasterTypes]);

    if (loading) {
        return (
            <div className="text-center py-8">
                <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-500 mx-auto mb-4"></div>
                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
            </div>
        );
    }

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
            {disasterTypes
                .filter((type) => {
                    const sessionData = activeSessions[type] || { active: 0, total: 0, activities: 0 };
                    return sessionData.active > 0; // แสดงเฉพาะ EOC ที่เปิดอยู่
                })
                .map((type) => {
                    const config = getDisasterConfig(type);
                    const sessionData = activeSessions[type] || { active: 0, total: 0, activities: 0 };
                    const isActive = sessionData.active > 0;

                    return (
                        <Link key={type} href={config.routes.main}>
                            <div className={`relative overflow-hidden rounded-lg shadow-lg hover:shadow-xl transition-all duration-300 transform hover:scale-105 cursor-pointer ${isActive ? 'ring-4 ring-red-500' : ''
                                }`}>
                                <div className={`bg-linear-to-br ${config.color.gradient} p-6 text-white`}>
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <AppIcon icon={config.icon} className="h-10 w-10" />
                                                {isActive && (
                                                    <span className="animate-pulse">
                                                        <span className="flex h-3 w-3 relative">
                                                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                                                            <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
                                                        </span>
                                                    </span>
                                                )}
                                            </div>
                                            <h3 className="text-2xl font-bold mb-1">{config.name}</h3>
                                            <p className="text-sm opacity-90">{config.nameEn}</p>
                                        </div>
                                        {isActive && (
                                            <div className="bg-red-500 text-white px-3 py-1 rounded-full text-xs font-semibold animate-pulse">
                                                ACTIVE
                                            </div>
                                        )}
                                    </div>

                                    <div className="space-y-2">
                                        <div className="flex items-center justify-between bg-white/10 rounded p-2 backdrop-blur-sm">
                                            <span className="text-sm">EOC เปิดอยู่</span>
                                            <span className="font-bold text-lg">{sessionData.active}</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-white/10 rounded p-2 backdrop-blur-sm">
                                            <span className="text-sm">Sessions ปีนี้</span>
                                            <span className="font-bold">{sessionData.total}</span>
                                        </div>
                                        <div className="flex items-center justify-between bg-white/10 rounded p-2 backdrop-blur-sm">
                                            <span className="text-sm">กิจกรรมทั้งหมด</span>
                                            <span className="font-bold">{sessionData.activities}</span>
                                        </div>
                                    </div>

                                    <div className="mt-4 pt-4 border-t border-white/20">
                                        <div className="flex items-center justify-between text-sm">
                                            <span>ดูรายละเอียด</span>
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                            </svg>
                                        </div>
                                    </div>
                                </div>

                                {isActive && (
                                    <div className="absolute top-0 right-0 w-32 h-32 -mt-16 -mr-16 bg-red-500 rounded-full opacity-20 animate-ping"></div>
                                )}
                            </div>
                        </Link>
                    );
                })}

            {/* แสดงข้อความถ้าไม่มี EOC ที่เปิดอยู่ */}
            {disasterTypes.filter((type) => {
                const sessionData = activeSessions[type] || { active: 0 };
                return sessionData.active > 0;
            }).length === 0 && (
                    <div className="col-span-full text-center py-12 bg-gray-50 rounded-lg">
                        <div className="text-6xl mb-4"><AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                        <h3 className="text-xl font-bold text-gray-700 mb-2">ไม่มี EOC ที่เปิดอยู่ในขณะนี้</h3>
                        <p className="text-gray-600">ขณะนี้ไม่มีสถานการณ์ภัยพิบัติที่ต้องเปิด EOC</p>
                    </div>
                )}
        </div>
    );
}
