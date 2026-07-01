"use client";
import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/context/AuthContext';

export default function CitizenDashboard() {
    const { user } = useAuth();
    const [activeEOCs, setActiveEOCs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [myReports, setMyReports] = useState([]);
    const [reportsLoading, setReportsLoading] = useState(true);

    const [timeElapsed, setTimeElapsed] = useState({});

    // Fetch active EOCs
    useEffect(() => {
        fetchActiveEOCs();
        const interval = setInterval(fetchActiveEOCs, 30000); // Refresh every 30s
        return () => clearInterval(interval);
    }, []);

    // Fetch citizen's reports
    useEffect(() => {
        if (user?.id) {
            fetchMyReports();
        }
    }, [user]);

    // Calculate time elapsed for each EOC
    useEffect(() => {
        const calculateTimeElapsed = () => {
            const elapsed = {};
            activeEOCs.forEach(eoc => {
                if (eoc.activated_at) {
                    const opened = new Date(eoc.activated_at);
                    const now = new Date();
                    const diff = now - opened;

                    elapsed[eoc.id] = {
                        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
                        hours: Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)),
                        minutes: Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
                    };
                }
            });
            setTimeElapsed(elapsed);
        };

        calculateTimeElapsed();
        const interval = setInterval(calculateTimeElapsed, 60000); // Update every minute
        return () => clearInterval(interval);
    }, [activeEOCs]);

    const fetchActiveEOCs = async () => {
        try {
            const response = await fetch('/stn-eoc/api/eoc/status');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    const active = result.data.filter(eoc => eoc.is_active);
                    setActiveEOCs(active);
                }
            }
        } catch (error) {
            console.error('Error fetching EOC status:', error);
        } finally {
            setLoading(false);
        }
    };

    const fetchMyReports = async () => {
        try {
            setReportsLoading(true);
            const response = await fetch('/stn-eoc/api/citizen/my-reports');
            if (response.ok) {
                const result = await response.json();
                if (result.success) {
                    setMyReports(result.reports || []);
                }
            }
        } catch (error) {
            console.error('Error fetching my reports:', error);
        } finally {
            setReportsLoading(false);
        }
    };

    const getEOCTypeName = (type) => {
        const names = {
            flood: 'น้ำท่วม',
            disease: 'โรคระบาด',
            accident: 'อุบัติเหตุ',
            drought: 'ภัยแล้ง',
            tsunami: 'คลื่นสึนามิ',
            earthquake: 'แผ่นดินไหว'
        };
        return names[type] || type;
    };

    const getEOCTypeIcon = (type) => {
        const icons = {
            flood: '💧',
            disease: '🦠',
            accident: '🚗',
            drought: '🌵',
            tsunami: '🌊',
            earthquake: '🏚️'
        };
        return icons[type] || '⚠️';
    };

    const getEOCTypeColor = (type) => {
        const colors = {
            flood: 'blue',
            disease: 'purple',
            accident: 'orange',
            drought: 'yellow',
            tsunami: 'cyan',
            earthquake: 'red'
        };
        return colors[type] || 'gray';
    };

    const formatDate = (dateString) => {
        if (!dateString) return '-';
        return new Date(dateString).toLocaleString('th-TH', {
            year: 'numeric',
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const getStatusBadge = (status) => {
        const badges = {
            pending: { text: 'รอตรวจสอบ', color: 'yellow' },
            verified: { text: 'ยืนยันแล้ว', color: 'green' },
            rejected: { text: 'ปฏิเสธ', color: 'red' },
            investigating: { text: 'กำลังตรวจสอบ', color: 'blue' }
        };
        return badges[status] || { text: status, color: 'gray' };
    };

    return (
        <div className="space-y-6">
            {/* Welcome Section */}
            <div className="bg-gradient-to-r from-green-600 to-blue-600 text-white rounded-xl p-6 shadow-lg">
                <h2 className="text-2xl font-bold mb-2">
                    สวัสดี, {user?.title} {user?.givenName} {user?.familyName}
                </h2>
                <p className="text-green-100">ยินดีต้อนรับสู่ระบบ EOC จังหวัดสตูล</p>
            </div>

            {/* EOC Status Section */}
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">🚨 สถานะ EOC</h3>

                {loading ? (
                    <div className="bg-white rounded-xl shadow-md p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดข้อมูล EOC...</p>
                    </div>
                ) : activeEOCs.length > 0 ? (
                    <div className="space-y-4">
                        {activeEOCs.map((eoc) => {
                            const color = getEOCTypeColor(eoc.eoc_type);
                            const elapsed = timeElapsed[eoc.id] || { days: 0, hours: 0, minutes: 0 };

                            return (
                                <div
                                    key={eoc.id}
                                    className={`bg-gradient-to-r from-${color}-600 to-${color}-700 text-white rounded-xl shadow-xl p-6 relative overflow-hidden`}
                                >
                                    {/* Animated background */}
                                    <div className="absolute inset-0 overflow-hidden">
                                        <div className="absolute w-64 h-64 bg-white opacity-10 rounded-full -top-32 -right-32 animate-pulse"></div>
                                    </div>

                                    <div className="relative z-10">
                                        <div className="flex items-center gap-4 mb-4">
                                            <div className="w-16 h-16 rounded-2xl bg-white/20 flex items-center justify-center shadow-lg animate-pulse">
                                                <span className="text-4xl">{getEOCTypeIcon(eoc.eoc_type)}</span>
                                            </div>
                                            <div>
                                                <h4 className="text-2xl font-bold mb-1">
                                                    EOC {getEOCTypeName(eoc.eoc_type)} เปิดใช้งาน
                                                </h4>
                                                <p className="text-sm opacity-90">
                                                    {eoc.description || 'ไม่มีรายละเอียดเพิ่มเติม'}
                                                </p>
                                            </div>
                                        </div>

                                        <div className="bg-white/10 rounded-xl p-4 backdrop-blur-sm mb-4">
                                            <p className="text-sm mb-3">เปิด EOC เมื่อ: {formatDate(eoc.activated_at)}</p>
                                            <div className="grid grid-cols-3 gap-4">
                                                <div className="text-center bg-white/10 rounded-lg p-3">
                                                    <div className="text-3xl font-bold">{elapsed.days}</div>
                                                    <div className="text-sm opacity-80">วัน</div>
                                                </div>
                                                <div className="text-center bg-white/10 rounded-lg p-3">
                                                    <div className="text-3xl font-bold">{elapsed.hours}</div>
                                                    <div className="text-sm opacity-80">ชั่วโมง</div>
                                                </div>
                                                <div className="text-center bg-white/10 rounded-lg p-3">
                                                    <div className="text-3xl font-bold">{elapsed.minutes}</div>
                                                    <div className="text-sm opacity-80">นาที</div>
                                                </div>
                                            </div>
                                        </div>

                                        <Link
                                            href="/public/report-incident"
                                            className="block w-full bg-white text-center font-bold py-3 rounded-xl shadow-lg hover:shadow-xl transition-all hover:scale-105"
                                            style={{ color: `rgb(var(--color-${color}-600))` }}
                                        >
                                            ⚡ แจ้งเหตุ{getEOCTypeName(eoc.eoc_type)}
                                        </Link>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="bg-gradient-to-r from-gray-400 to-gray-500 text-white rounded-xl shadow-md p-8 text-center">
                        <div className="text-6xl mb-4">✅</div>
                        <h4 className="text-2xl font-bold mb-2">ไม่มี EOC ที่เปิดอยู่</h4>
                        <p className="opacity-90">ขณะนี้ไม่มีสถานการณ์ฉุกเฉิน</p>
                    </div>
                )}
            </div>

            {/* Quick Actions */}
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">🚀 เมนูด่วน</h3>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <Link
                        href="/public/report-incident"
                        className="bg-gradient-to-br from-red-50 to-red-100 border-2 border-red-200 hover:border-red-300 rounded-xl shadow-md p-6 text-center transition-all hover:shadow-xl hover:scale-105 group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🚨</div>
                        <h4 className="font-bold text-lg text-gray-800">แจ้งเหตุภัยพิบัติ</h4>
                        <p className="text-sm text-gray-600 mt-2">รายงานเหตุการณ์ที่พบเจอ</p>
                    </Link>

                    <Link
                        href="/public/disaster-map"
                        className="bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 hover:border-blue-300 rounded-xl shadow-md p-6 text-center transition-all hover:shadow-xl hover:scale-105 group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">🗺️</div>
                        <h4 className="font-bold text-lg text-gray-800">แผนที่ภัยพิบัติ</h4>
                        <p className="text-sm text-gray-600 mt-2">ดูสถานการณ์ทั้งหมด</p>
                    </Link>

                    <Link
                        href="/"
                        className="bg-gradient-to-br from-green-50 to-green-100 border-2 border-green-200 hover:border-green-300 rounded-xl shadow-md p-6 text-center transition-all hover:shadow-xl hover:scale-105 group"
                    >
                        <div className="text-5xl mb-4 group-hover:scale-110 transition-transform">ℹ️</div>
                        <h4 className="font-bold text-lg text-gray-800">ข้อมูลและคำแนะนำ</h4>
                        <p className="text-sm text-gray-600 mt-2">คำแนะนำป้องกันภัย</p>
                    </Link>
                </div>
            </div>

            {/* My Reports History */}
            <div>
                <h3 className="text-2xl font-bold text-gray-800 mb-4">📋 ประวัติการแจ้งเหตุของคุณ</h3>

                {reportsLoading ? (
                    <div className="bg-white rounded-xl shadow-md p-8 text-center">
                        <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลดประวัติ...</p>
                    </div>
                ) : myReports.length > 0 ? (
                    <div className="bg-white rounded-xl shadow-md overflow-hidden">
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            วันที่แจ้ง
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ประเภท
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            สถานที่
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            สถานะ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {myReports.map((report) => {
                                        const badge = getStatusBadge(report.status);
                                        return (
                                            <tr key={report.id} className="hover:bg-gray-50">
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {formatDate(report.created_at)}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    {report.disaster_type || report.report_type}
                                                </td>
                                                <td className="px-6 py-4 text-sm text-gray-900">
                                                    {report.village && `ม.${report.village} `}
                                                    {report.sub_district && `ต.${report.sub_district} `}
                                                    {report.district && `อ.${report.district}`}
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap">
                                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-${badge.color}-100 text-${badge.color}-800`}>
                                                        {badge.text}
                                                    </span>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-xl shadow-md p-8 text-center">
                        <div className="text-6xl mb-4">📝</div>
                        <h4 className="text-xl font-bold text-gray-800 mb-2">ยังไม่มีประวัติการแจ้งเหตุ</h4>
                        <p className="text-gray-600 mb-4">คุณยังไม่เคยแจ้งเหตุภัยพิบัติ</p>
                        <Link
                            href="/public/report-incident"
                            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-6 rounded-xl shadow-md transition-all"
                        >
                            แจ้งเหตุเลย
                        </Link>
                    </div>
                )}
            </div>
        </div>
    );
}
