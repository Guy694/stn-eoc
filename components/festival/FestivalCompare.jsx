"use client";
import { useState, useEffect } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import { Bar } from 'react-chartjs-2';

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

    useEffect(() => {
        fetchSessions();
    }, []);

    const fetchSessions = async () => {
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
    };

    const fetchComparison = async (ids) => {
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
    };

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
            label: c.session.openReason || `Session #${c.session.sessionNumber}`,
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
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-blue-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-blue-600 via-indigo-500 to-purple-500 rounded-2xl p-6 text-white shadow-xl">
                <h1 className="text-3xl font-bold flex items-center gap-3">
                    📊 เปรียบเทียบสถิติอุบัติเหตุช่วงเทศกาล
                </h1>
                <p className="text-blue-100 mt-1">เปรียบเทียบข้อมูลระหว่างเทศกาล ปีใหม่ vs สงกรานต์ หรือข้ามปี</p>
            </div>

            {/* Session Selector */}
            <div className="bg-white rounded-xl shadow-md p-6">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    📋 เลือก Session ที่ต้องการเปรียบเทียบ
                </h3>
                {sessions.length === 0 ? (
                    <p className="text-gray-500">ไม่พบ session สำหรับเปรียบเทียบ</p>
                ) : (
                    <div className="flex flex-wrap gap-2">
                        {sessions.map(s => (
                            <button
                                key={s.id}
                                onClick={() => toggleSession(s.id)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all border-2 ${
                                    selectedIds.includes(s.id)
                                        ? s.festival_type === 'newyear'
                                            ? 'bg-blue-100 border-blue-500 text-blue-700'
                                            : s.festival_type === 'songkran'
                                                ? 'bg-orange-100 border-orange-500 text-orange-700'
                                                : 'bg-gray-100 border-gray-500 text-gray-700'
                                        : 'bg-gray-50 border-gray-200 text-gray-600 hover:border-gray-400'
                                }`}
                            >
                                {s.festival_type === 'newyear' ? '🎄' : s.festival_type === 'songkran' ? '💦' : '📊'}
                                {' '}{s.open_reason || `Session #${s.session_number}`}
                                {' '}({s.status === 'active' ? '🟢' : '🔴'})
                            </button>
                        ))}
                    </div>
                )}
            </div>

            {/* Comparing Indicator */}
            {comparing && (
                <div className="text-center py-4">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                    <p className="text-gray-500 text-sm">กำลังเปรียบเทียบ...</p>
                </div>
            )}

            {/* Comparison Cards */}
            {comparisons.length > 0 && !comparing && (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {comparisons.map((c, idx) => {
                            const colorSet = COMPARE_COLORS[idx % COMPARE_COLORS.length];
                            return (
                                <div key={c.session.id} className="bg-white rounded-xl shadow-lg overflow-hidden border-t-4" 
                                     style={{ borderColor: colorSet.border }}>
                                    <div className="p-5">
                                        <div className="flex items-center justify-between mb-4">
                                            <h3 className="font-bold text-gray-800 text-sm">
                                                {c.session.festivalType === 'newyear' ? '🎄' : '💦'}
                                                {' '}{c.session.openReason || c.session.festivalName}
                                            </h3>
                                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                                                c.session.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                            }`}>
                                                {c.session.status === 'active' ? 'เปิด' : 'ปิด'}
                                            </span>
                                        </div>

                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-red-50 rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-red-600">{c.stats.totalAccidents}</div>
                                                <div className="text-xs text-red-500">🚗 อุบัติเหตุ</div>
                                            </div>
                                            <div className="bg-gray-100 rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-gray-800">{c.stats.totalDeaths}</div>
                                                <div className="text-xs text-gray-500">💀 เสียชีวิต</div>
                                            </div>
                                            <div className="bg-amber-50 rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-amber-600">{c.stats.totalInjuries}</div>
                                                <div className="text-xs text-amber-500">🤕 บาดเจ็บ</div>
                                            </div>
                                            <div className="bg-purple-50 rounded-lg p-3 text-center">
                                                <div className="text-2xl font-bold text-purple-600">{c.stats.drunkCases}</div>
                                                <div className="text-xs text-purple-500">🍺 เมาแล้วขับ</div>
                                            </div>
                                        </div>

                                        {/* Additional causes */}
                                        <div className="flex gap-2 mt-3 text-xs">
                                            <span className="px-2 py-1 bg-orange-50 text-orange-600 rounded-lg">⛑ ไม่สวมหมวก: {c.stats.noHelmetCases}</span>
                                            <span className="px-2 py-1 bg-red-50 text-red-600 rounded-lg">🚀 ขับเร็ว: {c.stats.speedingCases}</span>
                                        </div>

                                        {c.stats.checkpoints > 0 && (
                                            <div className="mt-3 text-xs text-gray-500">
                                                🚧 จุดตรวจ: {c.stats.checkpoints} จุด
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {/* Comparison Bar Chart */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            📊 กราฟเปรียบเทียบ
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
                <div className="bg-gray-50 rounded-xl p-12 text-center">
                    <div className="text-6xl mb-4">📊</div>
                    <h3 className="text-xl font-bold text-gray-700 mb-2">เลือก Session เพื่อเปรียบเทียบ</h3>
                    <p className="text-gray-500">คลิกที่ Session ด้านบนเพื่อเริ่มเปรียบเทียบข้อมูล</p>
                </div>
            )}
        </div>
    );
}
