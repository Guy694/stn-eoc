"use client";
import { useCallback, useEffect, useMemo, useState } from 'react';
import EOCLayout from "@/components/layouts/EOCLayout";
import { formatEocDisplayName } from "@/lib/eocDisplay";
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';

export default function DiseaseDailyRiskPage() {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [availableDates, setAvailableDates] = useState([]);
    const [showAllDates, setShowAllDates] = useState(false);
    const [detailsPage, setDetailsPage] = useState(1);
    const [detailsPageSize, setDetailsPageSize] = useState(20);
    const activeDiseaseEocName = data?.activeSession
        ? formatEocDisplayName({ eoc_type: 'disease', ...data.activeSession })
        : 'โรคระบาด';

    const fetchAvailableDates = useCallback(async () => {
        try {
            // สมมติว่ามี active session เริ่มต้นที่ 2026-01-01
            const startDate = new Date('2026-01-01');
            const today = new Date();
            const dates = [];

            for (let d = new Date(startDate); d <= today; d.setDate(d.getDate() + 1)) {
                dates.push(new Date(d).toISOString().split('T')[0]);
            }

            setAvailableDates(dates.reverse()); // แสดงวันล่าสุดก่อน
        } catch (error) {
            console.error('Error fetching dates:', error);
        }
    }, []);

    const fetchRiskData = useCallback(async () => {
        setLoading(true);
        try {
            const response = await fetch(`/stn-eoc/api/eoc/disease/daily-risk?date=${selectedDate}`);
            const result = await response.json();
            if (result.success) {
                setData(result);
            }
        } catch (error) {
            console.error('Error fetching risk data:', error);
        } finally {
            setLoading(false);
        }
    }, [selectedDate]);

    useEffect(() => {
        fetchRiskData();
        fetchAvailableDates();
    }, [fetchAvailableDates, fetchRiskData]);

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
        return colors[severity] || 'bg-gray-100 border-gray-400 text-gray-800';
    };

    const getSeverityIcon = (severity) => {
        const icons = {
            'high': '🔴',
            'medium': '🟡',
            'low': '🟢'
        };
        return icons[severity] || '⚪';
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
                        <div className="animate-spin rounded-full h-16 w-16 border-b border-teal-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!data) {
        return (
            <EOCLayout>
                <div className="container mx-auto p-6">
                    <div className="text-center py-12">
                        <p className="text-gray-600">ไม่พบข้อมูล</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    const stats = data.totalStats || {};
    const formatDate = new Date(selectedDate).toLocaleDateString('th-TH', {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric'
    });

    return (
        <EOCLayout>
            <div className="container mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <span className="text-4xl">🦠</span>
                        สรุปสถานการณ์โรครายวัน
                    </h1>
                    <p className="text-gray-600">แสดงข้อมูลวันที่: {formatDate}</p>
                </div>

                {/* Date Selector */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    <div className="flex items-center justify-between mb-4">
                        <label className="block text-sm font-medium text-gray-700">
                            เลือกวันที่ต้องการดู:
                        </label>
                        <button
                            onClick={() => setShowAllDates(!showAllDates)}
                            className="px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700 transition-colors text-sm"
                        >
                            {showAllDates ? '🔼 ซ่อนลิสวันที่' : '📅 แสดงลิสวันที่ทั้งหมด'}
                        </button>
                    </div>
                    <input
                        type="date"
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        max={new Date().toISOString().split('T')[0]}
                        className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-teal-500 text-gray-700 w-full md:w-auto"
                    />

                    {/* Available Dates List */}
                    {showAllDates && availableDates.length > 0 && (
                        <div className="mt-4 border-t pt-4">
                            <h3 className="font-semibold text-gray-700 mb-3">📋 วันที่มีข้อมูล ({availableDates.length} วัน):</h3>
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
                                                ? 'bg-teal-600 text-white shadow-lg font-bold'
                                                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
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
                    <div className="bg-gradient-to-r from-teal-500 to-pink-500 text-white rounded-lg shadow-lg p-6 mb-6">
                        <div className="flex items-center justify-between flex-wrap gap-4">
                            <div>
                                <h3 className="text-xl font-bold mb-2">
                                    🚨 {activeDiseaseEocName} Session #{data.activeSession.session_number}/2026 - กำลังดำเนินการ
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
                            <div className="grid grid-cols-3 gap-3 text-center">
                                <div className="bg-white/20 rounded p-3 backdrop-blur-sm">
                                    <p className="text-2xl font-bold">{data.activeSession.days_open}</p>
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
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                    <StatCard
                        icon="🗺️"
                        label="อำเภอ"
                        value={stats.affected_districts || 0}
                        color="purple"
                    />
                    <StatCard
                        icon="🏥"
                        label="หน่วยบริการ"
                        value={stats.affected_facilities || 0}
                        color="blue"
                    />
                    <StatCard
                        icon="🦠"
                        label="ประเภทโรค"
                        value={stats.diseases_count || 0}
                        color="green"
                    />
                    <StatCard
                        icon="📋"
                        label="รายงาน"
                        value={stats.total_reports || 0}
                        color="orange"
                    />
                    <StatCard
                        icon="👥"
                        label="ผู้ป่วย"
                        value={(stats.total_patients || 0).toLocaleString()}
                        color="red"
                    />
                </div>

                {/* Disease Summary */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">สรุปตามประเภทโรค</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                        {data.diseaseSummary?.map((item, index) => (
                            <div
                                key={index}
                                className={`${getSeverityColor(item.severity)} border-2 rounded-lg p-4`}
                            >
                                <div className="flex items-center gap-2 mb-3">
                                    <span className="text-3xl">{getSeverityIcon(item.severity)}</span>
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
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">สรุปตามอำเภอ</h2>
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        อำเภอ
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ประเภทโรค
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        หน่วยบริการ
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        ผู้ป่วย
                                    </th>
                                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        รายงาน
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {data.districtSummary?.map((district, index) => (
                                    <tr key={index} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                            {district.district}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                                            {district.diseases_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                                            {district.facilities_count}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                                            {(district.total_patients || 0).toLocaleString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 text-center">
                                            {district.report_count}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Detailed List */}
                <div className="bg-white rounded-lg shadow-md p-6">
                    <h2 className="text-xl font-bold text-gray-800 mb-4">รายละเอียดรายงาน</h2>
                    <div className="space-y-3">
                        {paginatedDetails.map((item, index) => (
                            <div
                                key={index}
                                className="bg-gray-50 border border-teal-500 p-4 rounded-r-lg"
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <h3 className="font-bold text-lg mb-1">
                                            🦠 {item.disease_name}
                                        </h3>
                                        <p className="text-sm text-gray-600 mb-2">
                                            🏥 {item.facility_name} | 📍 {item.district_name}
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
                            <div className="text-center py-8 text-gray-500">
                                <p className="text-4xl mb-2">📭</p>
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
        purple: 'bg-teal-50 border-teal-200 text-teal-700',
        blue: 'bg-blue-50 border-blue-200 text-blue-700',
        green: 'bg-green-50 border-green-200 text-green-700',
        orange: 'bg-orange-50 border-orange-200 text-orange-700',
        red: 'bg-red-50 border-red-200 text-red-700'
    };

    return (
        <div className={`${colorClasses[color]} border-2 rounded-lg p-4 text-center`}>
            <div className="text-3xl mb-2">{icon}</div>
            <p className="text-2xl font-bold mb-1">{value}</p>
            <p className="text-sm opacity-80">{label}</p>
        </div>
    );
}
