"use client";
import { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";

const FestivalMap = dynamic(() => import("./FestivalMap"), {
    ssr: false,
    loading: () => (
        <div className="h-72 flex items-center justify-center rounded-xl border border-gray-200 bg-white text-gray-600">
            <div className="text-center">
                <div className="animate-spin h-6 w-6 border-2 border-red-500 border-t-transparent rounded-full mx-auto mb-2"></div>
                <p className="text-sm">กำลังโหลดแผนที่...</p>
            </div>
        </div>
    )
});

export default function FestivalPublicDashboard({ festivalSession }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (festivalSession && !festivalSession.is_active) {
            setLoading(false);
            return;
        }
        const fetchData = async () => {
            try {
                setLoading(true);
                const params = new URLSearchParams();
                if (festivalSession.session_id) params.append('session_id', festivalSession.session_id);
                if (festivalSession.festival_type) params.append('festival_type', festivalSession.festival_type);
                const res = await fetch(`/stn-eoc/api/eoc/festival-accidents/dashboard?${params}`);
                const result = await res.json();
                if (result.success) setData(result);
            } catch (e) {
                console.error('Error fetching festival dashboard:', e);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        const interval = setInterval(fetchData, 60000);
        return () => clearInterval(interval);
    }, [festivalSession]);

    if (festivalSession && !festivalSession.is_active) return null;

    const ft = festivalSession?.festival_type || data?.activeSession?.festival_type;
    const festivalLabel = ft === 'newyear' ? 'ปีใหม่' : ft === 'songkran' ? 'สงกรานต์' : 'เทศกาล';
    const festivalIcon = ft === 'newyear' ? '🎄' : ft === 'songkran' ? '💦' : '🚗';
    const accentColor = ft === 'newyear' ? 'blue' : ft === 'songkran' ? 'orange' : 'red';
    const accentMap = {
        blue: { bar: 'bg-blue-500', gradient: 'from-blue-600 to-blue-700', text: 'text-blue-600', badge: 'bg-blue-100 text-blue-700' },
        orange: { bar: 'bg-orange-500', gradient: 'from-orange-500 to-orange-600', text: 'text-orange-500', badge: 'bg-orange-100 text-orange-700' },
        red: { bar: 'bg-red-500', gradient: 'from-red-600 to-red-700', text: 'text-red-600', badge: 'bg-red-100 text-red-700' },
    };
    const ac = accentMap[accentColor];

    return (
        <section className="mb-6 md:mb-8">
            {/* Section Header */}
            <div className="flex items-center gap-3 mb-3">
                <div className={`w-1.5 h-6 ${ac.bar} rounded-full`}></div>
                <h2 className="text-lg md:text-xl font-bold text-gray-800">
                    {festivalIcon} สถิติอุบัติเหตุ{festivalLabel}
                </h2>
                <Link
                    href="/public/festival-accidents"
                    className={`ml-auto text-xs px-3 py-1.5 bg-gradient-to-r ${ac.gradient} text-white rounded-lg hover:opacity-90 transition font-medium shadow-sm`}
                >
                    ดูรายละเอียด →
                </Link>
            </div>

            {loading ? (
                <div className="bg-white rounded-xl shadow-md p-8 text-center">
                    <div className="animate-spin h-8 w-8 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-3"></div>
                    <p className="text-gray-500 text-sm">กำลังโหลดข้อมูล...</p>
                </div>
            ) : !data?.hasActiveSession ? (
                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-6 text-center text-yellow-900 text-sm">
                    <div className="text-3xl mb-2">📭</div>
                    <p>ยังไม่มีข้อมูลในช่วงเทศกาล</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Stat Cards */}
                    <div className="grid grid-cols-3 gap-3">
                        <div className="eoc-bg-red-700 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow text-center">
                            <div className="text-xl mb-0.5">🚗</div>
                            <div className="text-2xl md:text-3xl font-bold">{(data.stats?.totalAccidents || 0).toLocaleString()}</div>
                            <div className="text-red-100 text-xs">อุบัติเหตุ (ครั้ง)</div>
                        </div>
                        <div className="eoc-bg-gray-900 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow text-center">
                            <div className="text-xl mb-0.5">💀</div>
                            <div className="text-2xl md:text-3xl font-bold">{(data.stats?.totalDeaths || 0).toLocaleString()}</div>
                            <div className="text-gray-300 text-xs">เสียชีวิต (ราย)</div>
                        </div>
                        <div className="eoc-bg-amber-700 text-white rounded-xl p-4 shadow-md hover:shadow-lg transition-shadow text-center">
                            <div className="text-xl mb-0.5">🤕</div>
                            <div className="text-2xl md:text-3xl font-bold">{(data.stats?.totalInjuries || 0).toLocaleString()}</div>
                            <div className="text-amber-100 text-xs">บาดเจ็บ (ราย)</div>
                        </div>
                    </div>

                    {/* Map */}
                    <div className="bg-white rounded-xl shadow-md p-4">
                        <div className="flex items-center justify-between mb-3">
                            <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
                                📍 แผนที่จุดเกิดเหตุ &amp; จุดบริการ
                            </h3>
                            <div className="flex items-center gap-3 text-xs text-gray-600">
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-red-600 inline-block"></span> จุดเกิดเหตุ
                                </span>
                                <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full bg-green-500 inline-block"></span> จุดบริการ
                                </span>
                            </div>
                        </div>
                        <div className="h-72">
                            <FestivalMap
                                accidents={data.mapData?.accidents || []}
                                servicePoints={data.mapData?.servicePoints || []}
                            />
                        </div>
                    </div>
                </div>
            )}
        </section>
    );
}
