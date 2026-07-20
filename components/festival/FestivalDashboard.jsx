"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';
import dynamic from 'next/dynamic';
import { downloadCsv } from '@/lib/exportCsv';
import AppIcon from "@/components/icons/AppIcon";

const FestivalMap = dynamic(() => import('./FestivalMap'), {
    ssr: false,
    loading: () => <div className="h-[500px] flex items-center justify-center bg-gray-50 rounded-xl border border-gray-200 text-gray-400">กำลังโหลดแผนที่...</div>
});

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement, PointElement, LineElement);

const FESTIVAL_TABS = [
    { key: 'all', label: 'ทั้งหมด', icon: "barChart", color: 'gray' },
    { key: 'newyear', label: 'ปีใหม่', icon: "treePalm", color: 'blue' },
    { key: 'songkran', label: 'สงกรานต์', icon: "droplets", color: 'orange' },
];

export default function FestivalDashboard() {
    const searchParams = useSearchParams();
    const [festivalType, setFestivalType] = useState(() => {
        const type = searchParams.get('festival_type');
        return FESTIVAL_TABS.some(t => t.key === type) ? type : 'all';
    });
    const [selectedSession, setSelectedSession] = useState('');
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [exporting, setExporting] = useState(false);

    const fetchDashboard = useCallback(async () => {
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
    }, [festivalType, selectedSession]);

    useEffect(() => {
        fetchDashboard();
    }, [fetchDashboard]);

    const handleExportExcel = async () => {
        if (!data?.activeSession) return;
        setExporting(true);
        try {
            const rows = [
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

            if (data.dailySummary?.length > 0) {
                rows.push(
                    [''],
                    ['สถิติรายวัน'],
                    ['วันที่', 'อุบัติเหตุ', 'เสียชีวิต', 'บาดเจ็บ', 'เมาแล้วขับ'],
                    ...data.dailySummary.map(d => [d.date, d.accidents, d.deaths, d.injuries, d.drunk])
                );
            }

            if (data.districtBreakdown?.length > 0) {
                rows.push(
                    [''],
                    ['สถิติตามอำเภอ'],
                    ['อำเภอ', 'อุบัติเหตุ', 'เสียชีวิต', 'บาดเจ็บ'],
                    ...data.districtBreakdown.map(d => [d.district, d.accidents, d.deaths, d.injuries])
                );
            }

            const festivalLabel = festivalType === 'newyear' ? 'ปีใหม่' : festivalType === 'songkran' ? 'สงกรานต์' : 'เทศกาล';
            downloadCsv(rows, `อุบัติเหตุ_${festivalLabel}_${new Date().toISOString().split('T')[0]}.csv`);
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
                            <AppIcon icon="car" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> อุบัติเหตุช่วงเทศกาล{data?.activeSession?.festival_type === 'newyear' ? 'ปีใหม่' : data?.activeSession?.festival_type === 'songkran' ? 'สงกรานต์' : ''}
                        </h1>
                        <p className="text-red-100 mt-1">
                            {data?.activeSession?.open_reason
                                ? data.activeSession.open_reason
                                : '7 วันอันตราย — ระบบติดตามอุบัติเหตุทางถนนจังหวัดสตูล'}
                        </p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={handleExportExcel}
                            disabled={exporting || !data?.activeSession}
                            className="px-4 py-2 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 backdrop-blur-sm"
                        >
                            {exporting ? "กำลังส่งออก..." : "ส่งออก Excel"}
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
                                onClick={() => {
                                    setFestivalType(tab.key);
                                    setSelectedSession('');
                                    // Optionally update URL to reflect active tab
                                    window.history.replaceState({}, '', `?festival_type=${tab.key}`);
                                }}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${festivalType === tab.key
                                    ? tab.key === 'newyear' ? 'bg-blue-600 text-white shadow-md'
                                        : tab.key === 'songkran' ? 'bg-orange-500 text-white shadow-md'
                                            : 'bg-gray-700 text-white shadow-md'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                    }`}
                            >
                                <AppIcon icon={tab.icon} className="inline-block h-5 w-5" /> {tab.label}
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
                                    #{s.session_number} - {s.open_reason || 'ไม่ระบุ'} ({s.status === 'active' ? "เปิด" : "ปิด"})
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            </div>

            {/* No Active Session */}
            {!data?.hasActiveSession && (
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
                    <div className="text-6xl mb-4"><AppIcon icon="file" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                    <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มีข้อมูลเทศกาล</h3>
                    <p className="text-gray-600">ยังไม่มี EOC Session สำหรับอุบัติเหตุช่วงเทศกาลที่เปิดอยู่</p>
                    <p className="text-gray-500 text-sm mt-1">กรุณาเปิด EOC Session ประเภท &quot;festival-accidents&quot; จากหน้าจัดการ EOC</p>
                </div>
            )}

            {data?.hasActiveSession && (
                <>
                    {/* Active Session Banner */}
                    <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-xl border border-gray-200 px-5 py-3 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className={`px-3 py-1 rounded-full text-xs font-bold ${data.activeSession?.status === 'active'
                                ? 'bg-green-100 text-green-700 animate-pulse'
                                : 'bg-gray-200 text-gray-600'
                                }`}>
                                {data.activeSession?.status === 'active' ? "กำลังดำเนินการ" : "ปิดแล้ว"}
                            </span>
                            <span className="text-gray-700 font-medium">
                                {data.activeSession?.open_reason || `Session #${data.activeSession?.session_number}`}
                            </span>
                        </div>
                        <span className="text-gray-500 text-sm">
                            {data.activeSession?.festival_type === 'newyear' ? "ปีใหม่" :
                                data.activeSession?.festival_type === 'songkran' ? "สงกรานต์" : ''}
                        </span>
                    </div>

                    {/* Summary Stats */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                        <StatCard
                            icon="car"
                            label="อุบัติเหตุ"
                            value={data.stats?.totalAccidents || 0}
                            color="red"
                            unit="ครั้ง"
                        />
                        <StatCard
                            icon="skull"
                            label="เสียชีวิต"
                            value={data.stats?.totalDeaths || 0}
                            color="gray"
                            unit="ราย"
                        />
                        <StatCard
                            icon="stethoscope"
                            label="บาดเจ็บ"
                            value={data.stats?.totalInjuries || 0}
                            color="yellow"
                            unit="ราย"
                        />
                        <StatCard
                            icon="beer"
                            label="เมาแล้วขับ"
                            value={data.stats?.drunkCases || 0}
                            color="purple"
                            unit="ราย"
                        />
                        <StatCard
                            icon="route"
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
                                <AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถิติรายวัน (7 วันอันตราย)
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
                                        <div className="text-4xl mb-2"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                        <p>ยังไม่มีข้อมูล</p>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Accident Type Doughnut */}
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <AppIcon icon="refresh" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ประเภทอุบัติเหตุ
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
                                        <div className="text-4xl mb-2"><AppIcon icon="refresh" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                        <p>ยังไม่มีข้อมูล</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Cause Analysis */}
                    <div className="bg-white rounded-xl shadow-md p-6">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                            <AppIcon icon="alert" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ปัจจัยเสี่ยง / สาเหตุ
                        </h3>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            {data?.causeAnalysis?.map(c => (
                                <div key={c.cause} className="bg-gray-50 rounded-xl p-4 text-center hover:shadow-md transition-shadow">
                                    <AppIcon icon={c.icon} className="mx-auto mb-2 h-8 w-8" />
                                    <div className="text-2xl font-bold text-gray-800">{c.count}</div>
                                    <div className="text-sm text-gray-600 mt-1">{c.cause}</div>
                                    {data.stats?.totalAccidents > 0 && (
                                        <div className="mt-2 w-full bg-gray-200 rounded-full h-2">
                                            <div
                                                className={`h-2 rounded-full transition-all duration-500 ${c.color === 'purple' ? 'bg-teal-500' :
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
                                    <AppIcon icon="map" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถิติแยกตามอำเภอ
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
                                    <div className="text-4xl mb-2"><AppIcon icon="map" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    <p>ยังไม่มีข้อมูล</p>
                                </div>
                            )}
                        </div>

                        {/* Recent Accidents */}
                        <div className="bg-white rounded-xl shadow-md overflow-hidden">
                            <div className="px-6 py-4 bg-gray-50 border-b">
                                <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                    <AppIcon icon="clock" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เหตุการณ์ล่าสุด
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
                                                        <AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> {a.location_name || 'ไม่ระบุสถานที่'}
                                                    </p>
                                                    <p className="text-xs text-gray-500">
                                                        อ.{a.district || '-'} ต.{a.tambon || '-'}
                                                    </p>
                                                </div>
                                                <div className="flex gap-2 text-xs">
                                                    {a.deaths > 0 && <span className="px-2 py-1 bg-gray-800 text-white rounded"><AppIcon icon="skull" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> {a.deaths}</span>}
                                                    {a.injuries > 0 && <span className="px-2 py-1 bg-yellow-100 text-yellow-700 rounded"><AppIcon icon="stethoscope" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> {a.injuries}</span>}
                                                </div>
                                            </div>
                                            <div className="flex gap-1 mt-2">
                                                {a.drunk_driving ? <span className="px-1.5 py-0.5 bg-teal-100 text-teal-700 rounded text-xs"><AppIcon icon="beer" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เมา</span> : null}
                                                {a.no_helmet ? <span className="px-1.5 py-0.5 bg-orange-100 text-orange-700 rounded text-xs"><AppIcon icon="shield" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ไม่สวมหมวก</span> : null}
                                                {a.speeding ? <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs"><AppIcon icon="rocket" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เร็ว</span> : null}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="p-8 text-center text-gray-400">
                                    <div className="text-4xl mb-2"><AppIcon icon="file" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                                    <p>ยังไม่มีรายงาน</p>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Map Section */}
                    {data?.mapData && (
                        <div className="bg-white rounded-xl shadow-md p-6">
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                <AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> แผนที่แสดงจุดเกิดเหตุและจุดบริการ (Session: {data.activeSession?.session_number || ''})
                            </h3>
                            <div className="mb-4 flex gap-4 text-sm">
                                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600 block"></span> จุดเกิดอุบัติเหตุ</div>
                                <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500 block"></span> จุดบริการประชาชน / ด่านตรวจ</div>
                            </div>
                            <FestivalMap
                                accidents={data.mapData.accidents || []}
                                servicePoints={data.mapData.servicePoints || []}
                            />
                        </div>
                    )}
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
        purple: 'from-teal-500 to-teal-600 border-teal-300',
        green: 'from-emerald-500 to-emerald-600 border-emerald-300',
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} rounded-xl p-5 text-white shadow-lg hover:shadow-xl transition-shadow`}>
            <div className="flex items-center justify-between mb-2">
                <AppIcon icon={icon} className="h-7 w-7" />
                <span className="text-xs font-medium opacity-80">{unit}</span>
            </div>
            <div className="text-3xl font-bold">{value.toLocaleString()}</div>
            <div className="text-sm opacity-90 mt-1">{label}</div>
        </div>
    );
}
