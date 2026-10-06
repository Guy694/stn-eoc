"use client";

import Link from "next/link";
import AppIcon from "@/components/icons/AppIcon";
import { Bar, Pie } from 'react-chartjs-2';
import './chartSetup';

// ส่วนหนึ่งของหน้าภาพรวม EOC อุทกภัย (แยกจาก app/eoc/flood/overview/page.jsx)
export default function HealthSection({ diseases, shelter_diseases, isDailyMode, formatNumber, effectiveDateLabel, diseaseLatestDateLabel, impactScopeLabel }) {
    return (
        <>
        {/* Disease Statistics Section */}
        {diseases && (
            <>
                <div id="sec-health" className="scroll-mt-20 mb-6">
                    <h3 className="text-lg font-black text-slate-900 mb-3"><AppIcon icon="biohazard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> โรคในชุมชน / พื้นที่</h3>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                        <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-[#0b4c86]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">
                                        {isDailyMode ? `รายงานประจำวันที่ ${diseaseLatestDateLabel}` : `รายงานวันล่าสุด (${diseaseLatestDateLabel})`}
                                    </p>
                                    <p className="text-3xl font-bold text-[#0b4c86]">
                                        {diseases.today?.reduce((sum, d) => sum + parseInt(d.today_patients || 0), 0) || 0} คน
                                    </p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-red-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">สะสมทั้งหมด</p>
                                    <p className="text-3xl font-bold text-red-600">
                                        {diseases.cumulative?.reduce((sum, d) => sum + parseInt(d.cumulative_patients || 0), 0) || 0} คน
                                    </p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-green-500">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">{isDailyMode ? 'โรคที่รายงานในวันนั้น' : 'โรคที่รายงาน'}</p>
                                    <p className="text-3xl font-bold text-green-600">{diseases.by_disease?.length || 0} โรค</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="biohazard" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>
                        <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-[#0b4c86]">
                            <div className="flex items-center justify-between">
                                <div>
                                    <p className="text-sm text-gray-600 mb-1">หน่วยบริการ</p>
                                    <p className="text-3xl font-bold text-[#0b4c86]">{diseases.health_facilities || 0} แห่ง</p>
                                </div>
                                <div className="text-4xl"><AppIcon icon="hospital" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></div>
                            </div>
                        </div>
                    </div>

                    {/* Disease Charts */}
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Bar Chart by District */}
                        <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                            <h4 className="text-lg font-bold text-gray-800 mb-4"><AppIcon icon="barChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สถานการณ์แยกตามอำเภอ ({diseaseLatestDateLabel})</h4>
                            {diseases.today && diseases.today.length > 0 ? (
                                <Bar
                                    data={(() => {
                                        const districts = [...new Set(diseases.today.map(d => d.district_name))];
                                        const diseaseNames = [...new Set(diseases.today.map(d => d.disease_name))];
                                        const colors = [
                                            'rgba(255, 99, 132, 0.8)',
                                            'rgba(54, 162, 235, 0.8)',
                                            'rgba(255, 206, 86, 0.8)',
                                            'rgba(75, 192, 192, 0.8)',
                                            'rgba(153, 102, 255, 0.8)',
                                            'rgba(255, 159, 64, 0.8)'
                                        ];
                                        return {
                                            labels: districts,
                                            datasets: diseaseNames.map((disease, index) => ({
                                                label: disease,
                                                data: districts.map(district => {
                                                    const record = diseases.today.find(d => d.district_name === district && d.disease_name === disease);
                                                    return record ? parseInt(record.today_patients) : 0;
                                                }),
                                                backgroundColor: colors[index % colors.length]
                                            }))
                                        };
                                    })()}
                                    options={{
                                        responsive: true,
                                        plugins: {
                                            legend: { position: 'top' }
                                        },
                                        scales: {
                                            y: { beginAtZero: true }
                                        }
                                    }}
                                />
                            ) : (
                                <div className="py-8 text-center text-gray-500">ยังไม่มีรายงานผู้ป่วยในชุมชนสำหรับเหตุการณ์นี้ <Link href="/eoc/flood/health?tab=community" className="font-bold text-[#0b4c86] hover:underline">บันทึกรายงาน</Link></div>
                            )}
                        </div>

                        {/* Pie Chart by Disease */}
                        <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                            <h4 className="text-lg font-bold text-gray-800 mb-4"><AppIcon icon="pieChart" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> สัดส่วนผู้ป่วยรายโรค ({isDailyMode ? effectiveDateLabel : 'สะสม'})</h4>
                            {diseases.by_disease && diseases.by_disease.length > 0 ? (
                                <Pie
                                    data={(() => {
                                        const colors = [
                                            'rgba(255, 99, 132, 0.8)',
                                            'rgba(54, 162, 235, 0.8)',
                                            'rgba(255, 206, 86, 0.8)',
                                            'rgba(75, 192, 192, 0.8)',
                                            'rgba(153, 102, 255, 0.8)',
                                            'rgba(255, 159, 64, 0.8)'
                                        ];
                                        return {
                                            labels: diseases.by_disease.map(d => d.disease_name),
                                            datasets: [{
                                                data: diseases.by_disease.map(d => parseInt(d.cumulative_total)),
                                                backgroundColor: colors,
                                                borderWidth: 2,
                                                borderColor: '#fff'
                                            }]
                                        };
                                    })()}
                                    options={{
                                        responsive: true,
                                        plugins: {
                                            legend: { position: 'right' }
                                        }
                                    }}
                                />
                            ) : (
                                <div className="text-center py-8 text-gray-500">ยังไม่มีข้อมูล</div>
                            )}
                        </div>
                    </div>
                </div>
            </>
        )}

        {/* Shelter Disease Statistics */}
        {shelter_diseases && (
            <div className="mb-6">
                <h3 className="text-lg font-black text-slate-900 mb-3">สถิติโรคในศูนย์พักพิง ({impactScopeLabel})</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-[#c9dcee]">
                        <p className="text-sm text-gray-600">รายงานทั้งหมด</p>
                        <p className="text-3xl font-bold text-[#0b4c86]">{formatNumber(shelter_diseases.summary?.total_reports)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-red-100">
                        <p className="text-sm text-gray-600">ผู้ป่วยรายใหม่</p>
                        <p className="text-3xl font-bold text-red-700">{formatNumber(shelter_diseases.summary?.total_new_cases)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-amber-100">
                        <p className="text-sm text-gray-600">ส่งต่อ/นอน รพ.</p>
                        <p className="text-3xl font-bold text-amber-700">{formatNumber(shelter_diseases.summary?.total_hospitalized)}</p>
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5 border border-violet-100">
                        <p className="text-sm text-gray-600">ศูนย์ที่มีรายงาน</p>
                        <p className="text-3xl font-bold text-violet-700">{formatNumber(shelter_diseases.summary?.shelters_with_reports)}</p>
                    </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">โรคที่พบในศูนย์พักพิง</h4>
                        {shelter_diseases.by_disease?.length > 0 ? (
                            <Bar
                                data={{
                                    labels: shelter_diseases.by_disease.map(item => item.disease_name),
                                    datasets: [
                                        {
                                            label: 'รายใหม่',
                                            data: shelter_diseases.by_disease.map(item => Number(item.new_cases || 0)),
                                            backgroundColor: 'rgba(239, 68, 68, 0.75)'
                                        },
                                        {
                                            label: 'ส่งต่อ/นอน รพ.',
                                            data: shelter_diseases.by_disease.map(item => Number(item.hospitalized || 0)),
                                            backgroundColor: 'rgba(245, 158, 11, 0.75)'
                                        }
                                    ]
                                }}
                                options={{
                                    responsive: true,
                                    plugins: { legend: { position: 'top' } },
                                    scales: { y: { beginAtZero: true } }
                                }}
                            />
                        ) : (
                            <div className="text-center py-8 text-gray-500">ยังไม่มีรายงานโรคในศูนย์พักพิง</div>
                        )}
                    </div>
                    <div className="bg-white rounded-xl border border-[#c9dcee] shadow-sm p-5">
                        <h4 className="text-lg font-bold text-gray-800 mb-4">ศูนย์พักพิงที่ต้องติดตาม</h4>
                        {shelter_diseases.by_shelter?.length > 0 ? (
                            <div className="space-y-3">
                                {shelter_diseases.by_shelter.map((item, index) => (
                                    <div key={index} className="rounded-lg border border-gray-100 p-3">
                                        <div className="flex items-center justify-between gap-3">
                                            <div>
                                                <p className="font-semibold text-gray-800">{item.sheltername || 'ไม่ระบุศูนย์พักพิง'}</p>
                                                <p className="text-xs text-gray-500">ต.{item.tambon || '-'} อ.{item.district_name || '-'}</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-lg font-bold text-red-700">{formatNumber(item.new_cases)}</p>
                                                <p className="text-xs text-gray-500">รายใหม่</p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-sm text-gray-500">ยังไม่มีศูนย์พักพิงที่มีรายงานโรค</p>
                        )}
                    </div>
                </div>
            </div>
        )}
        </>
    );
}
