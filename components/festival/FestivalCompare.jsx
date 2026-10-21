"use client";
import { useCallback, useEffect, useState } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';
import AppIcon from "@/components/icons/AppIcon";
import { PageHero } from "@/components/common/ThemePanels";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const COMPARE_COLORS = [
    { bg: 'rgba(59, 130, 246, 0.7)', border: 'rgba(59, 130, 246, 1)', label: 'blue' },
    { bg: 'rgba(245, 158, 11, 0.7)', border: 'rgba(245, 158, 11, 1)', label: 'orange' },
    { bg: 'rgba(16, 185, 129, 0.7)', border: 'rgba(16, 185, 129, 1)', label: 'green' },
    { bg: 'rgba(139, 92, 246, 0.7)', border: 'rgba(139, 92, 246, 1)', label: 'purple' },
    { bg: 'rgba(239, 68, 68, 0.7)', border: 'rgba(239, 68, 68, 1)', label: 'red' },
];

export default function FestivalCompare() {
    const [sessions, setSessions] = useState([]);
    const [selectedIds, setSelectedIds] = useState([]);
    const [comparisons, setComparisons] = useState([]);
    const [loading, setLoading] = useState(true);
    const [comparing, setComparing] = useState(false);

    const fetchComparison = useCallback(async (ids) => {
        if (ids.length === 0) { setComparisons([]); return; }
        setComparing(true);
        try {
            const res = await fetch(`/stn-eoc/api/eoc/festival-accidents/compare?session_ids=${ids.join(',')}`);
            const data = await res.json();
            if (data.success) {
                setComparisons(data.comparisons || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setComparing(false);
        }
    }, []);

    const fetchSessions = useCallback(async () => {
        try {
            const res = await fetch('/stn-eoc/api/eoc/festival-accidents/dashboard');
            const data = await res.json();
            if (data.success && data.sessions) {
                setSessions(data.sessions);
                // เลือก 2 sessions ล่าสุดอัตโนมัติ
                const defaultIds = data.sessions.slice(0, 2).map(s => s.id);
                setSelectedIds(defaultIds);
                if (defaultIds.length > 0) {
                    await fetchComparison(defaultIds);
                }
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }, [fetchComparison]);

    useEffect(() => {
        fetchSessions();
    }, [fetchSessions]);

    const toggleSession = (id) => {
        setSelectedIds(prev => {
            const newIds = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id];
            fetchComparison(newIds);
            return newIds;
        });
    };

    // Chart data
    const comparisonChartData = {
        labels: ['อุบัติเหตุ', 'เสียชีวิต', 'บาดเจ็บ', 'เมาแล้วขับ', 'ไม่สวมหมวก', 'ขับเร็ว'],
        datasets: comparisons.map((c, idx) => ({
            label: c.session.openReason || `ครั้งที่ ${c.session.sessionNumber}`,
            data: [
                c.stats.totalAccidents,
                c.stats.totalDeaths,
                c.stats.totalInjuries,
                c.stats.drunkCases,
                c.stats.noHelmetCases,
                c.stats.speedingCases,
            ],
            backgroundColor: COMPARE_COLORS[idx % COMPARE_COLORS.length].bg,
            borderColor: COMPARE_COLORS[idx % COMPARE_COLORS.length].border,
            borderWidth: 1,
            borderRadius: 6,
        }))
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                    <p className="text-slate-600 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <PageHero icon="barChart" eyebrow="อุบัติเหตุช่วงเทศกาล" title="เปรียบเทียบสถิติอุบัติเหตุช่วงเทศกาล" subtitle="เปรียบเทียบข้อมูลระหว่างเทศกาล ปีใหม่ vs สงกรานต์ หรือข้ามปี" />

            {/* Session Selector */}
            <div className="border border-slate-200 bg-white rounded-2xl p-6">
                <h3 className="font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    เลือก Session ที่ต้องการเปรียบเทียบ
                </h3>
                {sessions.length === 0 ? (
                    <p className="text-slate-500">ไม่พบเหตุการณ์สำหรับเปรียบเทียบ</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {sessions.map(s => (
                            <button
                                key={s.id}
                                onClick={() => toggleSession(s.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                                    selectedIds.includes(s.id)
                                        ? s.festival_type === 'newyear'
                                            ? 'bg-[#dbeaf7] border-[#0b4c86] text-[#0b4c86]'
                                            : s.festival_type === 'songkran'
                                                ? 'bg-orange-100 border-orange-500 text-orange-700'
                                                : 'bg-slate-100 border-slate-500 text-slate-700'
                                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-400'
                                }`}
                            >
                                <AppIcon icon={s.festival_type === 'newyear' ? "treePalm" : s.festival_type === 'songkran' ? "droplets" : "barChart"} className="inline-block h-5 w-5" />
                                {' '}{s.open_reason || `ครั้งที่ ${s.session_number}`}
                                {' '}(<AppIcon icon={s.status === 'active' ? "statusGreen" : "statusRed"} className="inline-block h-3 w-3" />)
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Comparing Indicator */}
            {comparing && (
                <div className="text-center py-4">
                    <div className="mx-auto mb-2 h-8 w-8 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                    <p className="text-slate-500 text-sm">กำลังเปรียบเทียบ...</p>
                </div>
            )}

            {/* Comparison Cards */}
            {comparisons.length > 0 && !comparing && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {comparisons.map((c, idx) => {
                            const colorSet = COMPARE_COLORS[idx % COMPARE_COLORS.length];
                            return (
                                <div key={c.session.id} className="border border-slate-200 bg-white rounded-2xl overflow-hidden border-t" 
                                     style={{ borderColor: colorSet.border }}>
                                    <div className="p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-semibold text-slate-900 text-sm">
                                                <AppIcon icon={c.session.festivalType === 'newyear' ? "treePalm" : "droplets"} className="inline-block h-5 w-5" />
                                                {' '}{c.session.openReason || c.session.festivalName}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                c.session.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-green-50 text-green-900'
                                            }`}>
                                                {c.session.status === 'active' ? 'เปิด' : 'ปิด'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-red-50 rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-red-600">{c.stats.totalAccidents}</div>
                                                <div className="text-xs text-red-500">อุบัติเหตุ</div>
                                            </div>
                                            <div className="bg-slate-100 rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-slate-800">{c.stats.totalDeaths}</div>
                                                <div className="text-xs text-slate-500">เสียชีวิต</div>
                                            </div>
                                            <div className="bg-amber-50 rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-amber-600">{c.stats.totalInjuries}</div>
                                                <div className="text-xs text-amber-500">บาดเจ็บ</div>
                                            </div>
                                            <div className="bg-[#edf5fc] rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-[#0b4c86]">{c.stats.drunkCases}</div>
                                                <div className="text-xs text-teal-500">เมาแล้วขับ</div>
                                            </div>
                                        </div>

                                        {/* Additional causes */}
                                        <div className="flex gap-2 mt-3 text-xs">
                                            <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg">ไม่สวมหมวก: {c.stats.noHelmetCases}</span>
                                            <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg">ขับเร็ว: {c.stats.speedingCases}</span>
                                        </div>

                                        {c.stats.checkpoints > 0 && (
                                            <div className="mt-3 text-xs text-slate-500">
                                                จุดตรวจ: {c.stats.checkpoints} จุด
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Comparison Bar Chart */}
                    <div className="border border-slate-200 bg-white rounded-2xl p-6">
                        <h3 className="text-lg font-semibold text-slate-900 mb-4 flex items-center gap-2">
                            กราฟเปรียบเทียบ
                        </h3>
                        <div className="h-80">
                            <Bar
                                data={comparisonChartData}
                                options={{
                                    responsive: true,
                                    maintainAspectRatio: false,
                                    plugins: {
                                        legend: { position: 'top' },
                                    },
                                    scales: {
                                        y: {
                                            beginAtZero: true,
                                            ticks: { precision: 0 }
                                        }
                                    }
                                }}
                            />
                        </div>
                    </div>
                </>
            )}

            {comparisons.length === 0 && !comparing && (
                <div className="bg-slate-50 rounded-xl p-12 text-center">
                    <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 text-slate-400 ring-1 ring-slate-200"><AppIcon icon="barChart" className="h-6 w-6" /></span>
                    <h3 className="text-xl font-bold text-slate-700 mb-2">เลือกเหตุการณ์เพื่อเปรียบเทียบ</h3>
                    <p className="text-slate-500">คลิกที่เหตุการณ์ด้านบนเพื่อเริ่มเปรียบเทียบข้อมูล</p>
                </div>
            )}
        </div>
    );
}
