"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import EOCLayout from "@/components/layouts/EOCLayout";
import { formatEocDisplayName } from "@/lib/eocDisplay";
import { satunDistricts } from "@/data/satunData";

function formatDateTime(value) {
    if (!value) return "-";
    return new Date(value).toLocaleString("th-TH", {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
    });
}

function getTodayDateKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export default function SATReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [filters, setFilters] = useState({
        district: "",
        dateFrom: "",
        dateTo: "",
        reportType: ""
    });

    const fetchReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const queryParams = new URLSearchParams();
            if (filters.district) queryParams.append("district", filters.district);
            if (filters.dateFrom) queryParams.append("dateFrom", filters.dateFrom);
            if (filters.dateTo) queryParams.append("dateTo", filters.dateTo);
            if (filters.reportType) queryParams.append("reportType", filters.reportType);

            const response = await fetch(`/stn-eoc/api/eoc/disease/sat/reports?${queryParams.toString()}`);
            const result = await response.json();

            if (result.success) {
                setReports(result.data || []);
            } else {
                setError(result.message || "เกิดข้อผิดพลาดในการโหลดข้อมูล");
                setReports([]);
            }
        } catch (err) {
            console.error("Error fetching SAT reports:", err);
            setError("เกิดข้อผิดพลาดในการเชื่อมต่อกับเซิร์ฟเวอร์");
            setReports([]);
        } finally {
            setLoading(false);
        }
    }, [filters]);

    useEffect(() => {
        fetchReports();
    }, [fetchReports]);

    const handleFilterChange = (e) => {
        const { name, value } = e.target;
        setFilters(prev => ({
            ...prev,
            [name]: value
        }));
    };

    const resetFilters = () => {
        setFilters({
            district: "",
            dateFrom: "",
            dateTo: "",
            reportType: ""
        });
    };

    return (
        <EOCLayout>
            <div className="min-h-screen bg-gray-50">
                {/* Header */}
                <div className="bg-white shadow-sm border-b">
                    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                        <h1 className="text-2xl font-bold text-gray-900">
                            รายงานผล SAT (หน่วยงานสาธารณสุขอำเภอ)
                        </h1>
                        <p className="mt-1 text-sm text-gray-600">
                            รายงานการปฏิบัติงานและสถานการณ์โรคระบาดของหน่วยงานสาธารณสุขอำเภอ
                        </p>
                    </div>
                </div>

                {/* Main Content */}
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
                    {/* Filters */}
                    <div className="bg-white rounded-lg shadow border p-6 mb-6">
                        <h2 className="text-lg font-medium text-gray-900 mb-4">ตัวกรองการค้นหา</h2>
                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">อำเภอ</label>
                                <select
                                    name="district"
                                    value={filters.district}
                                    onChange={handleFilterChange}
                                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="">ทั้งหมด</option>
                                    {satunDistricts.map(district => (
                                        <option key={district} value={district}>
                                            {district}
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">วันที่เริ่มต้น</label>
                                <input
                                    type="date"
                                    name="dateFrom"
                                    value={filters.dateFrom}
                                    onChange={handleFilterChange}
                                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">วันที่สิ้นสุด</label>
                                <input
                                    type="date"
                                    name="dateTo"
                                    value={filters.dateTo}
                                    onChange={handleFilterChange}
                                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-2">ประเภทรายงาน</label>
                                <select
                                    name="reportType"
                                    value={filters.reportType}
                                    onChange={handleFilterChange}
                                    className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                                >
                                    <option value="">ทั้งหมด</option>
                                    <option value="daily">รายงานประจำวัน</option>
                                    <option value="weekly">รายงานประจำสัปดาห์</option>
                                    <option value="monthly">รายงานประจำเดือน</option>
                                    <option value="outbreak">รายงานการระบาด</option>
                                </select>
                            </div>
                        </div>
                        <div className="flex justify-end mt-4">
                            <button
                                onClick={fetchReports}
                                className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                ค้นหา
                            </button>
                            <button
                                onClick={resetFilters}
                                type="button"
                                className="ml-3 inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                            >
                                รีเซ็ต
                            </button>
                        </div>
                    </div>

                    {/* Loading State */}
                    {loading && (
                        <div className="text-center py-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-4"></div>
                            <p className="text-sm text-gray-500">กำลังโหลดข้อมูล...</p>
                        </div>
                    )}

                    {/* Error State */}
                    {!loading && error && (
                        <div className="text-center py-12">
                            <p className="text-red-500">{error}</p>
                        </div>
                    )}

                    {/* Reports Table */}
                    {!loading && !error && (
                        <div className="bg-white rounded-lg shadow border">
                            <div className="px-4 py-5 sm:p-6">
                                <div className="flex justify-between items-center mb-4">
                                    <h2 className="text-lg font-medium text-gray-900">
                                        รายการรายงาน
                                    </h2>
                                    <Link
                                        href="/eoc/disease/sat/report/create"
                                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                                    >
                                        สร้างรายงานใหม่
                                    </Link>
                                </div>

                                {reports.length === 0 ? (
                                    <div className="text-center py-12">
                                        <p className="text-gray-500">ไม่พบรายงานที่ตรงกับเงื่อนไขการค้นหา</p>
                                    </div>
                                ) : (
                                    <div className="overflow-x-auto">
                                        <table className="min-w-full divide-y divide-gray-200">
                                            <thead className="bg-gray-50">
                                                <tr>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        วันที่
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        อำเภอ
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        ประเภทรายงาน
                                                    </th>
                                                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                                        สถานะ
                                                    </th>
                                                    <th scope="col" className="relative px-6 py-3">
                                                        <span className="sr-only">แก้ไข</span>
                                                    </th>
                                                </tr>
                                            </thead>
                                            <tbody className="bg-white divide-y divide-gray-200">
                                                {reports.map((report, index) => (
                                                    <tr key={report.id} className={index % 2 === 1 ? "bg-gray-50" : ""}>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {formatDateTime(report.date)}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {report.district || "-"}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                            {report.reportType || "-"}
                                                        </td>
                                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                            <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${report.status === "approved"
                                                                ? "bg-green-100 text-green-800"
                                                                : report.status === "pending"
                                                                    ? "bg-yellow-100 text-yellow-800"
                                                                    : "bg-red-100 text-red-800"
                                                            }`}>
                                                                {report.status === "approved" ? "อนุมัติ" : report.status === "pending" ? "รออนุมัติ" : "ไม่อนุมัติ"}
                                                            </span>
                                                        </td>
                                                        <td className="relative px-6 py-4">
                                                            <div className="flex items-center space-x-2">
                                                                <Link
                                                                    href={`/eoc/disease/sat/report/${report.id}`}
                                                                    className="text-indigo-600 hover:text-indigo-900"
                                                                    title="ดูรายละเอียด"
                                                                >
                                                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M10.293 3.293a1 1 0 011.414 0l6 6a1 1 0 010 1.414l-6 6a1 1 0 01-1.414-1.414L14.586 11H3a1 1 0 01-1-1v-2a1 1 0 011-1h11.586l-4.293-4.293a1 1 0 010-1.414z" clipRule="evenodd" />
                                                                    </svg>
                                                                </Link>
                                                                <button
                                                                    onClick={() => console.log("Edit report", report.id)}
                                                                    className="text-yellow-600 hover:text-yellow-900"
                                                                    title="แก้ไข"
                                                                >
                                                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                                <button
                                                                    onClick={() => console.log("Delete report", report.id)}
                                                                    className="text-red-600 hover:text-red-900"
                                                                    title="ลบ"
                                                                >
                                                                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                                                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h10a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 01-2 0V8zm5-1a1 1 0 000 2v6a1 1 0 000 2h2a1 1 0 100-4v-2h-2V9a1 1 0 00-1-1z" clipRule="evenodd" />
                                                                    </svg>
                                                                </button>
                                                            </div>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </EOCLayout>
    );
}