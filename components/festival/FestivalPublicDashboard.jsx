"use client";
import { useState, useEffect } from "react";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement } from 'chart.js';
import { Bar, Doughnut } from 'react-chartjs-2';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend, ArcElement);

export default function FestivalPublicDashboard() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchData();
    }, []);

    const fetchData = async () => {
        try {
            const res = await fetch('/stn-eoc/api/eoc/festival-accidents/dashboard');
            const result = await res.json();
            if (result.success) {
                setData(result);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const dailyChartData = {
        labels: data?.dailySummary?.map(d => {
            const date = new Date(d.date);
            return `${date.getDate()}/${date.getMonth() + 1}`;
        }) || [],
        datasets: [
            {
                label: 'อุบัติเหตุ',
                data: data?.dailySummary?.map(d => d.accidents) || [],
                backgroundColor: 'rgba(239, 68, 68, 0.8)',
                borderRadius: 8,
            },
            {
                label: 'บาดเจ็บ',
                data: data?.dailySummary?.map(d => d.injuries) || [],
                backgroundColor: 'rgba(245, 158, 11, 0.8)',
                borderRadius: 8,
            },
            {
                label: 'เสียชีวิต',
                data: data?.dailySummary?.map(d => d.deaths) || [],
                backgroundColor: 'rgba(55, 65, 81, 0.8)',
                borderRadius: 8,
            },
        ]
    };

    const typeChartData = {
        labels: data?.accidentTypeBreakdown?.map(t => t.type) || [],
        datasets: [{
            data: data?.accidentTypeBreakdown?.map(t => t.count) || [],
            backgroundColor: [
                'rgba(239, 68, 68, 0.85)',
                'rgba(245, 158, 11, 0.85)',
                'rgba(59, 130, 246, 0.85)',
                'rgba(16, 185, 129, 0.85)',
                'rgba(139, 92, 246, 0.85)',
            ],
            borderWidth: 3,
            borderColor: '#fff',
        }]
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-red-900 via-red-700 to-orange-600 flex items-center justify-center">
                <div className="text-center text-white">
                    <div className="animate-spin rounded-full h-16 w-16 border-4 border-white border-t-transparent mx-auto mb-4"></div>
                    <p className="text-xl">กำลังโหลดข้อมูล...</p>
                </div>
            </div>
        );
    }

    const festivalIcon = data?.activeSession?.festival_type === 'songkran' ? '💦' : '🎄';
    const festivalName = data?.activeSession?.festival_type === 'songkran' ? 'สงกรานต์' : 'ปีใหม่';

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-gray-900 to-red-950">
            {/* Hero Header */}
            <div className="relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-r from-red-600/20 via-orange-500/10 to-yellow-500/20"></div>
                <div className="max-w-5xl mx-auto px-4 py-12 relative">
                    <div className="text-center">
                        <div className="text-6xl mb-4">{festivalIcon}</div>
                        <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-3">
                            สถิติอุบัติเหตุ 7 วันอันตราย
                        </h1>
                        <p className="text-xl text-gray-300">
                            {data?.activeSession?.open_reason || `ช่วงเทศกาล${festivalName}`}
                        </p>
                        <p className="text-gray-400 mt-2 text-sm">
                            จังหวัดสตูล — ศูนย์ปฏิบัติการฉุกเฉิน (EOC)
                        </p>
                        {data?.activeSession?.status === 'active' && (
                            <span className="inline-block mt-4 px-4 py-1.5 bg-green-500/20 text-green-400 rounded-full text-sm font-medium animate-pulse border border-green-500/30">
                                🟢 กำลังดำเนินการ
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-4 pb-12 space-y-8">
                {!data?.hasActiveSession ? (
                    <div className="bg-white/10 backdrop-blur-sm rounded-2xl p-12 text-center">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-2xl font-bold text-white mb-2">ไม่มีข้อมูลเทศกาล</h3>
                        <p className="text-gray-400">ยังไม่มีการเปิดช่วงเทศกาลในขณะนี้</p>
                    </div>
                ) : (
                    <>
                        {/* Big Stats */}
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                            <PublicStatCard
                                icon="🚗"
                                value={data.stats?.totalAccidents || 0}
                                label="อุบัติเหตุ"
                                unit="ครั้ง"
                                gradient="from-red-500/20 to-red-600/20"
                                textColor="text-red-400"
                            />
                            <PublicStatCard
                                icon="💀"
                                value={data.stats?.totalDeaths || 0}
                                label="เสียชีวิต"
                                unit="ราย"
                                gradient="from-gray-500/20 to-gray-600/20"
                                textColor="text-gray-300"
                            />
                            <PublicStatCard
                                icon="🤕"
                                value={data.stats?.totalInjuries || 0}
                                label="บาดเจ็บ"
                                unit="ราย"
                                gradient="from-amber-500/20 to-amber-600/20"
                                textColor="text-amber-400"
                            />
                            <PublicStatCard
                                icon="🍺"
                                value={data.stats?.drunkCases || 0}
                                label="เมาแล้วขับ"
                                unit="ราย"
                                gradient="from-purple-500/20 to-purple-600/20"
                                textColor="text-purple-400"
                            />
                        </div>

                        {/* Charts */}
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                            <div className="lg:col-span-2 bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                                <h3 className="text-lg font-bold text-white mb-4">📈 สถิติรายวัน</h3>
                                {data?.dailySummary?.length > 0 ? (
                                    <div className="h-72">
                                        <Bar
                                            data={dailyChartData}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { position: 'top', labels: { color: '#9ca3af', font: { size: 12 } } }
                                                },
                                                scales: {
                                                    y: { beginAtZero: true, ticks: { color: '#9ca3af', precision: 0 }, grid: { color: 'rgba(255,255,255,0.05)' } },
                                                    x: { ticks: { color: '#9ca3af' }, grid: { color: 'rgba(255,255,255,0.05)' } }
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-72 flex items-center justify-center text-gray-500">
                                        <p>ยังไม่มีข้อมูล</p>
                                    </div>
                                )}
                            </div>

                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                                <h3 className="text-lg font-bold text-white mb-4">🔄 ประเภทอุบัติเหตุ</h3>
                                {data?.accidentTypeBreakdown?.length > 0 ? (
                                    <div className="h-72 flex items-center justify-center">
                                        <Doughnut
                                            data={typeChartData}
                                            options={{
                                                responsive: true,
                                                maintainAspectRatio: false,
                                                plugins: {
                                                    legend: { position: 'bottom', labels: { color: '#9ca3af', font: { size: 11 } } }
                                                }
                                            }}
                                        />
                                    </div>
                                ) : (
                                    <div className="h-72 flex items-center justify-center text-gray-500">
                                        <p>ยังไม่มีข้อมูล</p>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Cause Analysis */}
                        {data?.causeAnalysis && (
                            <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
                                <h3 className="text-lg font-bold text-white mb-4">⚠️ ปัจจัยเสี่ยง</h3>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    {data.causeAnalysis.map(c => (
                                        <div key={c.cause} className="bg-white/5 rounded-xl p-4 text-center">
                                            <div className="text-3xl mb-2">{c.icon}</div>
                                            <div className="text-2xl font-bold text-white">{c.count}</div>
                                            <div className="text-sm text-gray-400 mt-1">{c.cause}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Safety Tips */}
                        <div className="bg-gradient-to-r from-yellow-500/10 to-orange-500/10 backdrop-blur-sm rounded-2xl p-6 border border-yellow-500/20">
                            <h3 className="text-lg font-bold text-yellow-400 mb-4">💡 ข้อแนะนำเพื่อความปลอดภัย</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[
                                    { icon: '🚫', text: 'ดื่มไม่ขับ — ใช้บริการรถสาธารณะแทน' },
                                    { icon: '⛑', text: 'สวมหมวกกันน็อคทุกครั้งที่ขับขี่รถจักรยานยนต์' },
                                    { icon: '🪢', text: 'คาดเข็มขัดนิรภัยทุกที่นั่ง' },
                                    { icon: '🐌', text: 'ลดความเร็ว — อย่าประมาท พักเมื่อง่วง' },
                                    { icon: '📱', text: 'ไม่ใช้โทรศัพท์ขณะขับรถ' },
                                    { icon: '🚗', text: 'ตรวจสภาพรถก่อนออกเดินทาง' },
                                ].map((tip, idx) => (
                                    <div key={idx} className="flex items-center gap-3 text-gray-300 text-sm">
                                        <span className="text-xl">{tip.icon}</span>
                                        <span>{tip.text}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="text-center text-gray-500 text-sm pt-4">
                            <p>ข้อมูลจากศูนย์ปฏิบัติการฉุกเฉิน (EOC) จังหวัดสตูล</p>
                            <p className="mt-1">อัปเดตอัตโนมัติ — {new Date().toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}</p>
                        </div>
                    </>
                )}
            </div>
        </div>
    );
}

function PublicStatCard({ icon, value, label, unit, gradient, textColor }) {
    return (
        <div className={`bg-gradient-to-br ${gradient} backdrop-blur-sm rounded-2xl p-5 border border-white/10 text-center hover:scale-105 transition-transform`}>
            <div className="text-3xl mb-2">{icon}</div>
            <div className={`text-4xl font-extrabold ${textColor}`}>{value.toLocaleString()}</div>
            <div className="text-gray-400 text-sm mt-1">{label}</div>
            <div className="text-gray-500 text-xs">{unit}</div>
        </div>
    );
}
