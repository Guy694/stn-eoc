"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHero } from "@/components/common/ThemePanels";
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
                    <div className="text-center py-12">
                        <p className="text-slate-600">ไม่พบข้อมูล</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!availableDates.length) {
        return (
            <EOCLayout>
                <div className="w-full">
                    <div className="border border-dashed border-slate-300 bg-white py-12 text-center shadow-sm">
                        <AppIcon icon="calendar" className="mx-auto h-10 w-10 text-slate-400" />
                        <h1 className="mt-3 text-xl font-black text-slate-800">ยังไม่มีรายงานโรคในเหตุการณ์นี้</h1>
                        <p className="mt-2 text-sm text-slate-500">ระบบจะแสดงเฉพาะวันที่ที่มีข้อมูลจากฐานข้อมูล</p>
                    </div>
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
                {/* Header */}
                <PageHero icon="biohazard" title="สรุปสถานการณ์โรครายวัน" subtitle={<>แสดงข้อมูลวันที่: {formatDate}</>} className="mb-6" />

                {/* Date Selector */}
                <div className="border border-slate-200 bg-white rounded-2xl p-4 mb-6">
                    <div className="flex flex-col gap-3 mb-4 sm:flex-row sm:items-center sm:justify-between">
                        <label className="block text-sm font-medium text-slate-700">
                            เลือกวันที่ต้องการดู:
                        </label>
                        <button
                            onClick={() => setShowAllDates(!showAllDates)}
                            className="px-4 py-2 bg-[#0b4c86] text-white rounded-lg hover:bg-[#083865] transition-colors text-sm"
                        >
                            {showAllDates ? "ซ่อนลิสวันที่" : "แสดงลิสวันที่ทั้งหมด"}
                        </button>
                    </div>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-[#0b4c86]/40 text-slate-700 w-full md:w-auto"
                    />

                    {/* Available Dates List */}
                    {showAllDates && availableDates.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="font-semibold text-slate-700 mb-3">วันที่มีข้อมูล ({availableDates.length} วัน):</h3>
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
                                            onClick={() => {
                                                setSelectedDate(date);
                                                setShowAllDates(false);
                                            }}
                                            className={`p-3 rounded-lg text-sm transition-all ${isSelected
                                                ? 'bg-[#0b4c86] text-white shadow-lg font-bold'
                                                : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                }`}
                                        >
                                            <div className="font-medium">วันที่ {availableDates.length - index}</div>
                                            <div className="text-xs mt-1">{thaiDate}</div>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>

                {/* Active EOC Session Info */}
                {data.activeSession && (
                    <div className="relative overflow-hidden rounded-2xl bg-[#0b4c86] text-white shadow-[0_18px_36px_-24px_rgba(11,76,134,.9)] p-4 mb-6 md:p-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div className="min-w-0">
                                <h3 className="text-lg font-bold mb-2 md:text-xl">
                                    {activeDiseaseEocName} ครั้งที่ {data.activeSession.session_number}/2026 - กำลังดำเนินการ
                                </h3>
                                <p className="opacity-90 mb-1">
                                    เปิดเมื่อ: {new Date(data.activeSession.opened_at).toLocaleDateString('th-TH', {
                                        year: 'numeric',
                                        month: 'long',
                                        day: 'numeric',
                                        hour: '2-digit',
                                        minute: '2-digit'
                                    })}
                                </p>
                                <p className="opacity-90">
                                    เหตุผล: {data.activeSession.open_reason}
                                </p>
                            </div>
                            <div className="grid w-full grid-cols-3 gap-2 text-center sm:w-auto sm:gap-3">
                                <div className="bg-white/20 rounded p-3 backdrop-blur-sm">
                                    <p className="text-xl font-bold md:text-2xl">{data.activeSession.days_open}</p>
                                    <p className="text-sm">วัน</p>
                                </div>
                                <div className="bg-white/20 rounded p-3 backdrop-blur-sm">
                                    <p className="text-2xl font-bold">{data.activeSession.total_activities}</p>
                                    <p className="text-sm">กิจกรรม</p>
                                </div>
                                <div className="bg-white/20 rounded p-3 backdrop-blur-sm">
                                    <p className="text-2xl font-bold">{data.activeSession.total_data_entries}</p>
                                    <p className="text-sm">บันทึก</p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Total Statistics */}
                <div className="grid grid-cols-2 gap-3 mb-6 md:grid-cols-5 md:gap-4">
                    <StatCard
                        icon="map"
                        label="อำเภอ"
                        value={stats.affected_districts || 0}
                        color="purple"
                    />
                    <StatCard
                        icon="hospital"
                        label="หน่วยบริการ"
                        value={stats.affected_facilities || 0}
                        color="blue"
                    />
                    <StatCard
                        icon="biohazard"
                        label="ประเภทโรค"
                        value={stats.diseases_count || 0}
                        color="green"
                    />
                    <StatCard
                        icon="clipboard"
                        label="รายงาน"
                        value={stats.total_reports || 0}
                        color="orange"
                    />
                    <StatCard
                        icon="users"
                        label="ผู้ป่วย"
                        value={(stats.total_patients || 0).toLocaleString()}
                        color="red"
                    />
                </div>

                {/* Disease Summary */}
                <div className="border border-slate-200 bg-white rounded-2xl p-4 mb-6 md:p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">สรุปตามประเภทโรค</h2>
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
                </div>

                {/* District Summary */}
                <div className="border border-slate-200 bg-white rounded-2xl p-4 mb-6 md:p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">สรุปตามอำเภอ</h2>
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
                </div>

                {/* Detailed List */}
                <div className="border border-slate-200 bg-white rounded-2xl p-4 md:p-6">
                    <h2 className="text-lg font-semibold text-slate-900 mb-4">รายละเอียดรายงาน</h2>
                    <div className="space-y-3">
                        {paginatedDetails.map((item, index) => (
                            <div
                                key={index}
                                className="bg-slate-50 border border-[#0b4c86] p-4 rounded-r-lg"
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
                            <div className="text-center py-8 text-slate-500">
                                <p className="text-4xl mb-2"><AppIcon icon="file" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /></p>
                                <p>ไม่มีรายงานในวันนี้</p>
                            </div>
                        )}
                    </div>
                    <PaginationControls
                        page={detailsPage}
                        pageSize={detailsPageSize}
                        totalItems={detailRows.length}
                        onPageChange={setDetailsPage}
                        onPageSizeChange={setDetailsPageSize}
                    />
                </div>
            </div>
        </EOCLayout>
    );
}

function StatCard({ icon, label, value, color }) {
    const colorClasses = {
        purple: 'bg-[#edf5fc] border-[#c9dcee] text-[#0b4c86]',
        blue: 'bg-[#edf5fc] border-[#c9dcee] text-[#0b4c86]',
        green: 'bg-green-50 border-green-200 text-green-700',
        orange: 'bg-orange-50 border-orange-200 text-orange-700',
        red: 'bg-red-50 border-red-200 text-red-700'
    };

    return (
        <div className={`${colorClasses[color]} border-2 rounded-lg p-4 text-center`}>
            <AppIcon icon={icon} className="mx-auto mb-2 h-8 w-8" />
            <p className="text-2xl font-bold mb-1">{value}</p>
            <p className="text-sm opacity-80">{label}</p>
        </div>
    );
}
