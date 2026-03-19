"use client";
import { useState, useEffect, useRef } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const FESTIVAL_TABS = [
    { key: 'all', label: 'ทั้งหมด', icon: '📊', color: 'gray' },
    { key: 'newyear', label: 'ปีใหม่', icon: '🎄', color: 'blue' },
    { key: 'songkran', label: 'สงกรานต์', icon: '💦', color: 'orange' },
];

export default function FestivalDashboard() {
    const [festivalType, setFestivalType] = useState('all');
    const [selectedSession, setSelectedSession] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    useEffect(() => {
        fetchDashboard();
    }, [festivalType, selectedSession]);

    const fetchDashboard = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (festivalType !== 'all') params.append('festival_type', festivalType);
            if (selectedSession) params.append('session_id', selectedSession);

            const res = await fetch(`/stn-eoc/api/eoc/festival-accidents/dashboard?${params}`);
            const result = await res.json();
            if (result.success) {
                setData(result);
            }
        } catch (error) {
            console.error('Error fetching dashboard:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleExportExcel = async () => {
        if (!data?.activeSession) return;
        setExporting(true);
        try {
            const XLSX = (await import('xlsx')).default;
            const wb = XLSX.utils.book_new();

            // Sheet 1: สรุปสถิติ
            const summaryData = [
                ['สถิติอุบัติเหตุช่วงเทศกาล - สรุปข้อมูล'],
                ['Session', data.activeSession.open_reason || `Session #${data.activeSession.session_number}`],
                [''],
                ['รายการ', 'จำนวน'],
                ['อุบัติเหตุทั้งหมด', data.stats?.totalAccidents || 0],
                ['ผู้เสียชีวิต', data.stats?.totalDeaths || 0],
                ['ผู้บาดเจ็บ', data.stats?.totalInjuries || 0],
                ['เมาแล้วขับ', data.stats?.drunkCases || 0],
                ['จุดตรวจ', data.stats?.checkpoints || 0],
            ];
            const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
            XLSX.utils.book_append_sheet(wb, ws1, 'สรุปสถิติ');

            // Sheet 2: สถิติรายวัน
            if (data.dailySummary?.length > 0) {
                const dailyRows = [
                    ['วันที่', 'อุบัติเหตุ', 'เสียชีวิต', 'บาดเจ็บ', 'เมาแล้วขับ'],
                    ...data.dailySummary.map(d => [d.date, d.accidents, d.deaths, d.injuries, d.drunk])
                ];
                const ws2 = XLSX.utils.aoa_to_sheet(dailyRows);
                XLSX.utils.book_append_sheet(wb, ws2, 'สถิติรายวัน');
            }

            // Sheet 3: สถิติตามอำเภอ
            if (data.districtBreakdown?.length > 0) {
                const distRows = [
                    ['อำเภอ', 'อุบัติเหตุ', 'เสียชีวิต', 'บาดเจ็บ'],
                    ...data.districtBreakdown.map(d => [d.district, d.accidents, d.deaths, d.injuries])
                ];
                const ws3 = XLSX.utils.aoa_to_sheet(distRows);
                XLSX.utils.book_append_sheet(wb, ws3, 'ตามอำเภอ');
            }

            const festivalLabel = festivalType === 'newyear' ? 'ปีใหม่' : festivalType === 'songkran' ? 'สงกรานต์' : 'เทศกาล';
            XLSX.writeFile(wb, `อุบัติเหตุ_${festivalLabel}_${new Date().toISOString().split('T')[0]}.xlsx`);
        } catch (error) {
            console.error('Export error:', error);
        } finally {
            setExporting(false);
        }
    };

    // Chart data
    const dailyChartData = {
        labels: data?.dailySummary?.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        }) || [],
        datasets: [
            {
                label: 'อุบัติเหตุ',
                data: data?.dailySummary?.map(d => d.accidents) || [],
                backgroundColor: 'rgba(239, 68, 68, 0.7)',
                borderColor: 'rgba(239, 68, 68, 1)',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'บาดเจ็บ',
                data: data?.dailySummary?.map(d => d.injuries) || [],
                backgroundColor: 'rgba(245, 158, 11, 0.7)',
                borderColor: 'rgba(245, 158, 11, 1)',
                borderWidth: 1,
                borderRadius: 6,
            },
            {
                label: 'เสียชีวิต',
                data: data?.dailySummary?.map(d => d.deaths) || [],
                backgroundColor: 'rgba(55, 65, 81, 0.7)',
                borderColor: 'rgba(55, 65, 81, 1)',
                borderWidth: 1,
                borderRadius: 6,
            },
        ]
    };

    const typeChartData = {
        labels: data?.accidentTypeBreakdown?.map(t => t.type) || [],
        datasets: [{
            data: data?.accidentTypeBreakdown?.map(t => t.count) || [],
            backgroundColor: [
                'rgba(239, 68, 68, 0.8)',
                'rgba(245, 158, 11, 0.8)',
                'rgba(59, 130, 246, 0.8)',
                'rgba(16, 185, 129, 0.8)',
                'rgba(139, 92, 246, 0.8)',
            ],
            borderWidth: 2,
            borderColor: '#fff',
        }]
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-red-500 border-t-transparent mx-auto mb-4"></div>
                    <p className="text-gray-600 text-lg">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="bg-gradient-to-r from-red-600 via-orange-500 to-yellow-500 rounded-2xl p-6 text-white shadow-xl">
                <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div>
                        <h1 className="text-3xl font-bold flex items-center gap-3">
                            🚗 อุบัติเหตุช่วงเทศกาล
                        </h1>
                        <p className="text-red-100 mt-1">7 วันอันตราย — ระบบติดตามอุบัติเหตุทางถนนจังหวัดสตูล</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={exporting || !data?.activeSession}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 backdrop-blur-sm"
                        >
                            {exporting ? '⏳ กำลังส่งออก...' : '📥 ส่งออก Excel'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Festival Tabs & Session Selector */}
            <div className="bg-white rounded-xl shadow-md p-4">
                <div className="flex flex-col md:flex-row md:items-center gap-4">
                    {/* Festival Tabs */}
                    <div className="flex gap-2">
                        {FESTIVAL_TABS.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => { setFestivalType(tab.key); setSelectedSession(''); }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                                    festivalType === tab.key
                                        ? tab.key === 'newyear' ? 'bg-blue-600 text-white shadow-md'
                                            : tab.key === 'songkran' ? 'bg-orange-500 text-white shadow-md'
                                                : 'bg-gray-700 text-white shadow-md'
                                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }`}
                            >
                                {tab.icon} {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Session Selector */}
                    {data?.sessions?.length > 0 && (
                        <select
                            value={selectedSession}
                            onChange={(e) => setSelectedSession(e.target.value)}
                            className="text-gray-700 px-4 py-2 border border-gray-300 rounded-lg text-sm flex-1 max-w-xs"
                        >
                            <option value="">-- Session ล่าสุด --</option>
                            {data.sessions.map(s => (
                                <option key={s.id} value={s.id}>
                                    #{s.session_number} - {s.open_reason || 'ไม่ระบุ'} ({s.status === 'active' ? '🟢 เปิด' : '🔴 ปิด'})
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* No Active Session */}
            {!data?.hasActiveSession && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4">📭</div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มีข้อมูลเทศกาล</h3>
                    <p className="text-gray-600">ยังไม่มี EOC Session สำหรับอุบัติเหตุช่วงเทศกาลที่เปิดอยู่</p>
                    <p className="text-gray-500 text-sm mt-1">กรุณาเปิด EOC Session ประเภท "festival-accidents" จากหน้าจัดการ EOC</p>
                </div>
            )}

            {data?.hasActiveSession && (
                <>
                    {/* Active Session Banner */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                                data.activeSession?.status === 'active' 
                                    ? 'bg-green-100 text-green-700 animate-pulse' 
                                    : 'bg-gray-200 text-gray-600'
                            }`}>
                                {data.activeSession?.status === 'active' ? '🟢 กำลังดำเนินการ' : '🔴 ปิดแล้ว'}
                            </span>
                            <span className="text-gray-700 font-medium">
                                {data.activeSession?.open_reason || `Session #${data.activeSession?.session_number}`}
                            </span>
                        </div>
                        <span className="text-gray-500 text-sm">
                            {data.activeSession?.festival_type === 'newyear' ? '🎄 ปีใหม่' :
                                data.activeSession?.festival_type === 'songkran' ? '💦 สงกรานต์' : ''}
                        </span>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <StatCard
                            icon="🚗"
                            label="อุบัติเหตุ"
                            value={data.stats?.totalAccidents || 0}
                            color="red"
                            unit="ครั้ง"
                        />
                        <StatCard
                            icon="💀"
                            label="เสียชีวิต"
                            value={data.stats?.totalDeaths || 0}
                            color="gray"
                            unit="ราย"
                        />
                        <StatCard
                            icon="🤕"
                            label="บาดเจ็บ"
                            value={data.stats?.totalInjuries || 0}
                            color="yellow"
                            unit="ราย"
                        />
                        <StatCard
                            icon="🍺"
                            label="เมาแล้วขับ"
                            value={data.stats?.drunkCases || 0}
                            color="purple"
                            unit="ราย"
                        />
                        <StatCard
                            icon="🚧"
                            label="จุดตรวจ"
                            value={data.stats?.checkpoints || 0}
                            color="green"
                            unit="จุด"
                        />
                    </div>

                    {/* Charts Row */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Daily Trend Chart */}
                        <div className="lg:col-span-2 bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                📈 สถิติรายวัน (7 วันอันตราย)
                            </h3>
                            {data?.dailySummary?.length > 0 ? (
                                <div className="h-72">
                                    <Bar
                                        data={dailyChartData}
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
                            ) : (
                                <div className="h-72 flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">📊</div>
                                        <p>ยังไม่มีข้อมูล</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Accident Type Doughnut */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                🔄 ประเภทอุบัติเหตุ
                            </h3>
                            {data?.accidentTypeBreakdown?.length > 0 ? (
                                <div className="h-72 flex items-center justify-center">
                                    <Doughnut
                                        data={typeChartData}
                                        options={{
                                            responsive: true,
                                            maintainAspectRatio: false,
                                            plugins: {
                                                legend: { position: 'bottom', labels: { font: { size: 11 } } }
                                            }
                                        }}
                                    />
                                </div>
                            ) : (
                                <div className="h-72 flex items-center justify-center text-gray-400">
                                    <div className="text-center">
                                        <div className="text-4xl mb-2">🔄</div>
                                        <p>ยังไม่มีข้อมูล</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cause Analysis */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            ⚠️ ปัจจัยเสี่ยง / สาเหตุ
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {data?.causeAnalysis?.map(c => (
                                <div key={c.cause} className="bg-gray-50 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                                    <div className="text-3xl mb-2">{c.icon}</div>
                                    <div className="text-2xl font-bold text-gray-800">{c.count}</div>
                                    <div className="text-sm text-gray-600 mt-1">{c.cause}</div>
                                    {data.stats?.totalAccidents > 0 && (
                                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-500 ${
                                                    c.color === 'purple' ? 'bg-purple-500' :
                                                    c.color === 'orange' ? 'bg-orange-500' :
                                                    c.color === 'yellow' ? 'bg-yellow-500' :
                                                    'bg-red-500'
                                                }`}
                                                style={{ width: `${Math.min(100, (c.count / data.stats.totalAccidents) * 100)}%` }}
                                            />
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* District Breakdown & Recent */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* District Heatmap Table */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="px-6 py-4 bg-gray-50 border-b">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    🗺️ สถิติแยกตามอำเภอ
                                </h3>
                            </div>
                            {data?.districtBreakdown?.length > 0 ? (
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ</th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">อุบัติเหตุ</th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">เสียชีวิต</th>
                                                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">บาดเจ็บ</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-gray-200">
                                            {data.districtBreakdown.map((d, idx) => {
                                                const maxAcc = Math.max(...data.districtBreakdown.map(x => x.accidents));
                                                const intensity = maxAcc > 0 ? (d.accidents / maxAcc) : 0;
                                                return (
                                                    <tr key={d.district} className="hover:bg-gray-50">
                                                        <td className="px-4 py-3 font-medium text-gray-900 text-sm">
                                                            <span 
                                                                className="inline-block w-3 h-3 rounded-full mr-2" 
                                                                style={{ backgroundColor: `rgba(239, 68, 68, ${0.2 + intensity * 0.8})` }}
                                                            />
                                                            {d.district}
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="px-2 py-1 bg-red-100 text-red-700 rounded-full text-sm font-bold">{d.accidents}</span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className={`px-2 py-1 rounded-full text-sm font-bold ${d.deaths > 0 ? 'bg-gray-800 text-white' : 'bg-gray-100 text-gray-500'}`}>
                                                                {d.deaths}
                                                            </span>
                                                        </td>
                                                        <td className="px-4 py-3 text-center">
                                                            <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-bold">{d.injuries}</span>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    <div className="text-4xl mb-2">🗺️</div>
                                    <p>ยังไม่มีข้อมูล</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Accidents */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="px-6 py-4 bg-gray-50 border-b">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    🕐 เหตุการณ์ล่าสุด
                                </h3>
                            </div>
                            {data?.recentAccidents?.length > 0 ? (
                                <div className="divide-y divide-gray-100">
                                    {data.recentAccidents.map((a, idx) => (
                                        <div key={a.id || idx} className="p-4 hover:bg-gray-50 transition-colors">
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-2 mb-1">
                                                        <span className="px-2 py-0.5 bg-red-100 text-red-700 rounded-full text-xs font-medium">
                                                            {a.accident_type}
                                                        </span>
                                                        <span className="text-xs text-gray-500">
                                                            {a.report_date ? new Date(a.report_date).toLocaleDateString('th-TH') : ''} {a.report_time || ''}
                                                        </span>
                                                    </div>
                                                    <p className="text-sm text-gray-800 font-medium">
                                                        📍 {a.location_name || 'ไม่ระบุสถานที่'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        อ.{a.district || '-'} ต.{a.tambon || '-'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 text-xs">
                                                    {a.deaths > 0 && <span className="px-2 py-1 bg-gray-800 text-white rounded">💀 {a.deaths}</span>}
                                                    {a.injuries > 0 && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded">🤕 {a.injuries}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 mt-2">
                                                {a.drunk_driving ? <span className="px-1.5 py-0.5 bg-purple-100 text-purple-700 rounded text-xs">🍺 เมา</span> : null}
                                                {a.no_helmet ? <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs">⛑ ไม่สวมหมวก</span> : null}
                                                {a.speeding ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">🚀 เร็ว</span> : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    <div className="text-4xl mb-2">📭</div>
                                    <p>ยังไม่มีรายงาน</p>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}

// Stat Card Component
function StatCard({ icon, label, value, color, unit }) {
    const colorClasses = {
        red: 'from-red-500 to-red-600 border-red-300',
        gray: 'from-gray-700 to-gray-800 border-gray-400',
        yellow: 'from-amber-500 to-amber-600 border-amber-300',
        purple: 'from-purple-500 to-purple-600 border-purple-300',
        green: 'from-emerald-500 to-emerald-600 border-emerald-300',
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
            <div className="flex items-center justify-between mb-2">
                <span className="text-2xl">{icon}</span>
                <span className="text-xs font-medium opacity-80">{unit}</span>
            </div>
            <div className="text-3xl font-bold">{value.toLocaleString()}</div>
            <div className="text-sm opacity-90 mt-1">{label}</div>
        </div>
    );
}
