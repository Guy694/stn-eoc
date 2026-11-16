"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { EmptyPanel, PageHero, Panel, heroButtonClass, heroInputClass } from "@/components/common/ThemePanels";
import { MetricCard, MetricGrid } from "@/components/common/MetricCards";
import EOCLayout from "@/components/layouts/EOCLayout";
import { formatEocDisplayName } from "@/lib/eocDisplay";
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';
import AppIcon from "@/components/icons/AppIcon";

export default function DiseaseDailyRiskPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState('');
    const [availableDates, setAvailableDates] = useState([]);
    const [showAllDates, setShowAllDates] = useState(false);
    const [detailsPage, setDetailsPage] = useState(1);
    const [detailsPageSize, setDetailsPageSize] = useState(20);
    const activeDiseaseEocName = data?.activeSession
        ? formatEocDisplayName({ eoc_type: 'disease', ...data.activeSession })
        : 'โรคระบาด';

    const fetchRiskData = useCallback(async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            if (selectedDate) params.set('date', selectedDate);
            const response = await fetch(`/stn-eoc/api/eoc/disease/daily-risk?${params}`);
            const result = await response.json();
            if (result.success) {
                setData(result);
                const dates = result.available_dates || [];
                setAvailableDates(dates);
                if (!selectedDate && result.date) setSelectedDate(result.date);
            }
        } catch (error) {
            console.error('Error fetching risk data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchRiskData();
    }, [fetchRiskData]);

    useEffect(() => {
        setDetailsPage(1);
    }, [selectedDate]);

    const detailRows = useMemo(() => data?.details || [], [data?.details]);
    const paginatedDetails = useMemo(
        () => paginateRows(detailRows, detailsPage, detailsPageSize),
        [detailRows, detailsPage, detailsPageSize]
    );

    const getSeverityColor = (severity) => {
        const colors = {
            'high': 'bg-red-100 border-red-400 text-red-800',
            'medium': 'bg-yellow-100 border-yellow-400 text-yellow-800',
            'low': 'bg-green-100 border-green-400 text-green-800'
        };
        return colors[severity] || 'bg-slate-100 border-slate-400 text-slate-800';
    };

    const getSeverityIcon = (severity) => {
        const icons = {
            'high': "statusRed",
            'medium': "statusYellow",
            'low': "statusGreen"
        };
        return icons[severity] || "statusGray";
    };

    const getSeverityLabel = (severity) => {
        const labels = {
            'high': 'ระบาดหนัก',
            'medium': 'ระบาดปานกลาง',
            'low': 'เฝ้าระวัง'
        };
        return labels[severity] || severity;
    };

    if (loading) {
        return (
            <EOCLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                        <p className="text-slate-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!data) {
        return (
            <EOCLayout>
                <div className="w-full">
                    <PageHero icon="biohazard" eyebrow="โรคระบาด" title="สรุปสถานการณ์โรครายวัน" className="mb-6" />
                    <EmptyPanel icon="info" title="ไม่พบข้อมูล" />
                </div>
            </EOCLayout>
        );
    }

    if (!availableDates.length) {
        return (
            <EOCLayout>
                <div className="w-full">
                    <PageHero icon="biohazard" eyebrow="โรคระบาด" title="สรุปสถานการณ์โรครายวัน" className="mb-6" />
                    <EmptyPanel icon="calendar" title="ยังไม่มีรายงานโรคในเหตุการณ์นี้" text="ระบบจะแสดงเฉพาะวันที่ที่มีข้อมูลจากฐานข้อมูล" />
                </div>
            </EOCLayout>
        );
    }

    const stats = data.totalStats || {};
    const formatDate = selectedDate ? new Date(`${selectedDate}T00:00:00`).toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    }) : 'ยังไม่มีวันที่รายงาน';

    return (
        <EOCLayout>
            <div className="w-full">
                {/* Header: วันที่และข้อมูลเหตุการณ์อยู่บนหัวหน้า */}
                <PageHero
                    icon="biohazard"
                    eyebrow="โรคระบาด"
                    title="สรุปสถานการณ์โรครายวัน"
                    subtitle={<>แสดงข้อมูลวันที่: {formatDate}</>}
                    className="mb-6"
                    meta={data.activeSession ? (
                        <div className="space-y-0.5 text-sm">
                            <p className="font-semibold text-white">{activeDiseaseEocName} ครั้งที่ {data.activeSession.session_number}/2026 - กำลังดำเนินการ</p>
                            <p>
                                เปิดเมื่อ: {new Date(data.activeSession.opened_at).toLocaleDateString('th-TH', {
                                    year: 'numeric',
                                    month: 'long',
                                    day: 'numeric',
                                    hour: '2-digit',
                                    minute: '2-digit'
                                })}
                            </p>
                            <p>เหตุผล: {data.activeSession.open_reason}</p>
                        </div>
                    ) : null}
                    actions={(
                        <>
                            <label className="flex items-center gap-2 text-sm font-medium text-blue-100">
                                เลือกวันที่ต้องการดู:
                                <input
                                    type="date"
                                    value={selectedDate}
                                    onChange={(e) => setSelectedDate(e.target.value)}
                                    max={new Date().toISOString().split('T')[0]}
                                    className={heroInputClass}
                                />
                            </label>
                            <button type="button" onClick={() => setShowAllDates(!showAllDates)} aria-expanded={showAllDates} className={heroButtonClass}>
                                <AppIcon icon="calendarDays" className="h-4 w-4" />
                                {showAllDates ? "ซ่อนลิสวันที่" : "แสดงลิสวันที่ทั้งหมด"}
                            </button>
                        </>
                    )}
                    aside={data.activeSession ? (
                        <div className="grid grid-cols-3 gap-2 text-center">
                            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                                <p className="text-2xl font-bold tabular-nums">{data.activeSession.days_open}</p>
                                <p className="text-xs text-blue-100">วัน</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                                <p className="text-2xl font-bold tabular-nums">{data.activeSession.total_activities}</p>
                                <p className="text-xs text-blue-100">กิจกรรม</p>
                            </div>
                            <div className="rounded-xl bg-white/10 p-3 ring-1 ring-white/15">
                                <p className="text-2xl font-bold tabular-nums">{data.activeSession.total_data_entries}</p>
                                <p className="text-xs text-blue-100">บันทึก</p>
                            </div>
                        </div>
                    ) : null}
                />

                {/* Available Dates List */}
                {showAllDates && availableDates.length > 0 && (
                    <Panel icon="calendar" title={`วันที่มีข้อมูล (${availableDates.length} วัน)`} className="mb-6" bodyClassName="p-4">
                        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-2 max-h-96 overflow-y-auto">
                            {availableDates.map((date, index) => {
                                const dateObj = new Date(date);
                                const isSelected = date === selectedDate;
                                const thaiDate = dateObj.toLocaleDateString('th-TH', {
                                    weekday: 'short',
                                    day: 'numeric',
                                    month: 'short'
                                });

                                return (
                                    <button
                                        key={date}
                                        type="button"
                                        onClick={() => {
                                            setSelectedDate(date);
                                            setShowAllDates(false);
                                        }}
                                        aria-pressed={isSelected}
                                        className={`p-3 rounded-lg text-sm transition-all ${isSelected
                                            ? 'bg-[#0b4c86] text-white font-bold'
                                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                            }`}
                                    >
                                        <div className="font-medium">วันที่ {availableDates.length - index}</div>
                                        <div className="text-xs mt-1">{thaiDate}</div>
                                    </button>
                                );
                            })}
                        </div>
                    </Panel>
                )}

                {/* Total Statistics */}
                <MetricGrid className="mb-6">
                    <MetricCard icon="map" label="อำเภอ" value={stats.affected_districts || 0} tone="blue" />
                    <MetricCard icon="hospital" label="หน่วยบริการ" value={stats.affected_facilities || 0} tone="blue" />
                    <MetricCard icon="biohazard" label="ประเภทโรค" value={stats.diseases_count || 0} tone="green" />
                    <MetricCard icon="clipboard" label="รายงาน" value={stats.total_reports || 0} tone="amber" />
                    <MetricCard icon="users" label="ผู้ป่วย" value={(stats.total_patients || 0).toLocaleString()} tone="red" />
                </MetricGrid>

                {/* Disease Summary */}
                <Panel icon="biohazard" title="สรุปตามประเภทโรค" className="mb-6" bodyClassName="p-4 md:p-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {data.diseaseSummary?.map((item, index) => (
                            <div
                                key={index}
                                className={`${getSeverityColor(item.severity)} border-2 rounded-lg p-4`}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <AppIcon icon={getSeverityIcon(item.severity)} className="h-8 w-8" />
                                    <h3 className="font-bold text-lg">{item.disease_name}</h3>
                                </div>
                                <div className="space-y-1 text-sm">
                                    <p><strong>ผู้ป่วย:</strong> {(item.total_patients || 0).toLocaleString()} คน</p>
                                    <p><strong>รายงาน:</strong> {item.report_count} ฉบับ</p>
                                    <p><strong>หน่วยบริการ:</strong> {item.facilities_count} แห่ง</p>
                                    <p><strong>ระดับ:</strong> {getSeverityLabel(item.severity)}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </Panel>

                {/* District Summary */}
                <Panel icon="map" title="สรุปตามอำเภอ" className="mb-6" bodyClassName="p-4 md:p-5">
                    <div className="grid gap-2 md:hidden">
                        {data.districtSummary?.map((district, index) => (
                            <div key={index} className="rounded-2xl border border-slate-200 bg-white p-3">
                                <div className="font-bold text-slate-900">{district.district}</div>
                                <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                                    <div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">ประเภทโรค</div><div className="font-bold text-slate-800">{district.diseases_count}</div></div>
                                    <div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">หน่วยบริการ</div><div className="font-bold text-slate-800">{district.facilities_count}</div></div>
                                    <div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">ผู้ป่วย</div><div className="font-bold text-slate-800">{(district.total_patients || 0).toLocaleString()}</div></div>
                                    <div className="rounded bg-slate-50 p-2"><div className="text-xs text-slate-500">รายงาน</div><div className="font-bold text-slate-800">{district.report_count}</div></div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <div className="hidden overflow-x-auto md:block">
                        <table className="min-w-full divide-y divide-slate-200">
                            <thead className="bg-slate-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500">
                                        อำเภอ
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500">
                                        ประเภทโรค
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500">
                                        หน่วยบริการ
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500">
                                        ผู้ป่วย
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-semibold text-slate-500">
                                        รายงาน
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-slate-200">
                                {data.districtSummary?.map((district, index) => (
                                    <tr key={index} className="hover:bg-slate-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">
                                            {district.district}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 text-center">
                                            {district.diseases_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 text-center">
                                            {district.facilities_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 text-center">
                                            {(district.total_patients || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700 text-center">
                                            {district.report_count}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </Panel>

                {/* Detailed List */}
                <Panel icon="file" title="รายละเอียดรายงาน" bodyClassName="p-4 md:p-5">
                    <div className="space-y-3">
                        {paginatedDetails.map((item, index) => (
                            <div
                                key={index}
                                className="rounded-xl border border-slate-200 border-l-4 border-l-[#0b4c86] bg-slate-50 p-4"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg mb-1">
                                            {item.disease_name}
                                        </h3>
                                        <p className="text-sm text-slate-600 mb-2">
                                            {item.facility_name} | <AppIcon icon="mapPin" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> {item.district_name}
                                        </p>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-2 text-sm">
                                            <div>
                                                <strong>ผู้ป่วย:</strong> {item.patient_count} คน
                                            </div>
                                            <div>
                                                <strong>ประเภท:</strong> {item.facility_type || '-'}
                                            </div>
                                            {item.notes && (
                                                <div className="col-span-2 md:col-span-1">
                                                    <strong>หมายเหตุ:</strong> {item.notes}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ))}

                        {(!data.details || data.details.length === 0) && (
                            <EmptyPanel icon="file" title="ไม่มีรายงานในวันนี้" />
                        )}
                    </div>
                    <PaginationControls
                        page={detailsPage}
                        pageSize={detailsPageSize}
                        totalItems={detailRows.length}
                        onPageChange={setDetailsPage}
                        onPageSizeChange={setDetailsPageSize}
                        className="mt-4 rounded-xl border bg-slate-50"
                    />
                </Panel>
            </div>
        </EOCLayout>
    );
}
