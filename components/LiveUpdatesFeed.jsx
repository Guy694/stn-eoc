"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LiveUpdatesFeed() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchRecentReports();
        // Auto-refresh every 30 seconds
        const interval = setInterval(fetchRecentReports, 30000);
        return () => clearInterval(interval);
    }, []);

    const fetchRecentReports = async () => {
        try {
            const response = await fetch('/api/public/verified-incidents?limit=5');
            const result = await response.json();
            if (result.success) {
                setReports(result.data);
            }
        } catch (error) {
            console.error('Error fetching recent reports:', error);
        } finally {
            setLoading(false);
        }
    };

    const getIcon = (type) => {
        const icons = {
            help_request: '💧',
            traffic_report: '🚧',
            flood: '🌊',
            default: '📍'
        };
        return icons[type] || icons.default;
    };

    const getUrgencyColor = (urgency) => {
        const colors = {
            high: 'bg-red-100 text-red-800',
            medium: 'bg-yellow-100 text-yellow-800',
            low: 'bg-green-100 text-green-800'
        };
        return colors[urgency] || colors.medium;
    };

    const timeAgo = (date) => {
        const seconds = Math.floor((new Date() - new Date(date)) / 1000);
        if (seconds < 60) return 'เมื่อสักครู่';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes} นาทีที่แล้ว`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
        const days = Math.floor(hours / 24);
        return `${days} วันที่แล้ว`;
    };

    return (
        <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                    <span className="w-3 h-3 bg-red-600 rounded-full animate-pulse"></span>
                    รายงานล่าสุด
                </h3>
                <Link href="/public/disaster-map" className="text-blue-600 hover:text-blue-800 text-sm font-semibold">
                    ดูทั้งหมด →
                </Link>
            </div>

            {loading ? (
                <div className="space-y-3">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="animate-pulse flex gap-3 p-3">
                            <div className="w-12 h-12 bg-gray-200 rounded-lg"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-4 bg-gray-200 rounded w-3/4"></div>
                                <div className="h-3 bg-gray-200 rounded w-1/2"></div>
                            </div>
                        </div>
                    ))}
                </div>
            ) : reports.length === 0 ? (
                <p className="text-center text-gray-500 py-8">ไม่มีรายงานใหม่</p>
            ) : (
                <div className="space-y-3">
                    {reports.map((report) => (
                        <div
                            key={report.id}
                            className="flex items-start gap-3 p-3 hover:bg-gray-50 rounded-lg transition-colors border border-gray-100"
                        >
                            <span className="text-3xl flex-shrink-0">{getIcon(report.reportType)}</span>
                            <div className="flex-1 min-w-0">
                                <p className="font-semibold text-gray-800 truncate">
                                    {report.description || 'รายงานเหตุการณ์'}
                                </p>
                                <p className="text-sm text-gray-500 truncate">
                                    {report.subDistrict}, {report.district} • {timeAgo(report.createdAt)}
                                </p>
                            </div>
                            <span className={`px-2 py-1 rounded text-xs font-medium whitespace-nowrap ${getUrgencyColor(report.urgency)}`}>
                                {report.urgency === 'high' ? 'เร่งด่วน' : report.urgency === 'medium' ? 'ปานกลาง' : 'ต่ำ'}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
