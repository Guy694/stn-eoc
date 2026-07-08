'use client';

import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import EOCLayout from '@/components/layouts/EOCLayout';
import { formatEocDisplayName } from '@/lib/eocDisplay';

function getFileUrl(filePath) {
    if (!filePath) return '';
    return filePath.startsWith('/stn-eoc') ? filePath : `/stn-eoc${filePath}`;
}

export default function EOCSessionsPage() {
    const { user } = useAuth();
    const router = useRouter();
    const [sessions, setSessions] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [selectedSession, setSelectedSession] = useState(null);
    const [sessionDetail, setSessionDetail] = useState(null);
    const [detailLoading, setDetailLoading] = useState(false);

    // Filters
    const [filters, setFilters] = useState({
        type: '',
        status: ''
    });

    // Pagination
    const [pagination, setPagination] = useState({
        total: 0,
        limit: 20,
        offset: 0,
        hasMore: false
    });

    const fetchSessions = useCallback(async () => {
        if (!user) return;

        setLoading(true);
        setError('');

        try {
            let url = `/stn-eoc/api/eoc/sessions?limit=${pagination.limit}&offset=${pagination.offset}`;
            if (filters.type) url += `&type=${filters.type}`;
            if (filters.status) url += `&status=${filters.status}`;

            const response = await fetch(url);
            const result = await response.json();

            if (result.success) {
                setSessions(result.data);
                setPagination(prev => ({
                    ...prev,
                    ...result.pagination
                }));
            } else {
                setError(result.message);
            }
        } catch (err) {
            console.error('Error fetching sessions:', err);
            setError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoading(false);
        }
    }, [filters, pagination.limit, pagination.offset, user]);

    useEffect(() => {
        // ตรวจสอบสิทธิ์
        if (!user) {
            router.push('/login');
            return;
        }

        fetchSessions();
    }, [fetchSessions, router, user]);

    const fetchSessionDetail = async (sessionId) => {
        setDetailLoading(true);
        try {
            const response = await fetch('/stn-eoc/api/eoc/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ sessionId })
            });

            const result = await response.json();
            if (result.success) {
                setSessionDetail(result.data);
            }
        } catch (err) {
            console.error('Error fetching session detail:', err);
        } finally {
            setDetailLoading(false);
        }
    };

    const handleViewDetail = (session) => {
        setSelectedSession(session);
        fetchSessionDetail(session.id);
    };

    const handleCloseDetail = () => {
        setSelectedSession(null);
        setSessionDetail(null);
    };

    const handleFilterChange = (key, value) => {
        setFilters(prev => ({ ...prev, [key]: value }));
        setPagination(prev => ({ ...prev, offset: 0 }));
    };

    const handlePageChange = (direction) => {
        setPagination(prev => ({
            ...prev,
            offset: direction === 'next'
                ? prev.offset + prev.limit
                : Math.max(0, prev.offset - prev.limit)
        }));
    };

    const formatDuration = (hours) => {
        if (!hours) return '-';
        const h = Math.floor(hours);
        const m = Math.round((hours - h) * 60);
        return `${h} ชม. ${m} นาที`;
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

    const getEOCTypeName = (sessionOrType) => formatEocDisplayName(sessionOrType);

    const getStatusBadge = (status) => {
        const badges = {
            active: <span className="px-2 py-1 text-xs rounded-full bg-green-100 text-green-800">เปิดอยู่</span>,
            closed: <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-800">ปิดแล้ว</span>
        };
        return badges[status] || status;
    };

    if (!user) return null;

    return (
        <EOCLayout>
            <div className="p-6">
                <div className="mb-6">
                    <h1 className="text-2xl font-bold text-gray-800 mb-2">ประวัติการเปิด-ปิด EOC</h1>
                    <p className="text-gray-600">ประวัติการเปิดและปิด EOC ทุกประเภทพร้อมสรุปกิจกรรม</p>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ประเภท EOC
                            </label>
                            <select
                                value={filters.type}
                                onChange={(e) => handleFilterChange('type', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">ทั้งหมด</option>
                                <option value="flood">อุทกภัยน้ำท่วม</option>
                                <option value="drought">ภัยแล้ง</option>
                                <option value="tsunami">คลื่นสึนามิ</option>
                                <option value="earthquake">แผ่นดินไหว</option>
                                <option value="disease">โรคระบาด</option>
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                สถานะ
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => handleFilterChange('status', e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                            >
                                <option value="">ทั้งหมด</option>
                                <option value="active">เปิดอยู่</option>
                                <option value="closed">ปิดแล้ว</option>
                            </select>
                        </div>

                        <div className="flex items-end">
                            <button
                                onClick={() => {
                                    setFilters({ type: '', status: '' });
                                    setPagination(prev => ({ ...prev, offset: 0 }));
                                }}
                                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                            >
                                ล้างตัวกรอง
                            </button>
                        </div>
                    </div>
                </div>

                {/* Sessions List */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-600 mx-auto"></div>
                        <p className="mt-4 text-gray-600">กำลังโหลดข้อมูล...</p>
                    </div>
                ) : error ? (
                    <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
                        {error}
                    </div>
                ) : sessions.length === 0 ? (
                    <div className="bg-gray-50 border border-gray-200 text-gray-600 px-4 py-8 rounded-lg text-center">
                        ไม่พบข้อมูลประวัติ EOC
                    </div>
                ) : (
                    <>
                        <div className="grid gap-4 mb-6">
                            {sessions.map((session) => (
                                <div
                                    key={session.id}
                                    className="bg-white rounded-lg shadow-md p-5 hover:shadow-lg transition cursor-pointer"
                                    onClick={() => handleViewDetail(session)}
                                >
                                    <div className="flex justify-between items-start mb-3">
                                        <div className="flex items-center gap-3">
                                            <h3 className="text-lg font-bold text-gray-800">
                                                {getEOCTypeName(session)} (ครั้งที่ {session.session_number})
                                            </h3>
                                            {getStatusBadge(session.status)}
                                        </div>
                                        <span className="text-sm text-gray-500">
                                            ID: {session.id}
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                        <div>
                                            <p className="text-gray-600">
                                                <span className="font-medium">เปิด:</span> {formatDate(session.opened_at)}
                                            </p>
                                            <p className="text-gray-600">
                                                <span className="font-medium">โดย:</span> {session.opened_by_name || session.opened_by_username}
                                            </p>
                                            {session.open_reason && (
                                                <p className="text-gray-600">
                                                    <span className="font-medium">เหตุผล:</span> {session.open_reason}
                                                </p>
                                            )}
                                            {session.eoc_type === 'disease' && session.disease_name && (
                                                <p className="text-gray-600">
                                                    <span className="font-medium">ประเภทโรค:</span> {session.disease_name}
                                                </p>
                                            )}
                                            {session.open_order_file_path && (
                                                <p className="text-gray-600">
                                                    <span className="font-medium">ไฟล์คำสั่ง:</span>{' '}
                                                    <a
                                                        href={getFileUrl(session.open_order_file_path)}
                                                        target="_blank"
                                                        rel="noreferrer"
                                                        className="text-blue-700 underline hover:text-blue-900"
                                                        onClick={(event) => event.stopPropagation()}
                                                    >
                                                        {session.open_order_file_name || 'เปิดไฟล์คำสั่ง'}
                                                    </a>
                                                </p>
                                            )}
                                        </div>

                                        <div>
                                            {session.status === 'closed' && (
                                                <>
                                                    <p className="text-gray-600">
                                                        <span className="font-medium">ปิด:</span> {formatDate(session.closed_at)}
                                                    </p>
                                                    <p className="text-gray-600">
                                                        <span className="font-medium">โดย:</span> {session.closed_by_name || session.closed_by_username}
                                                    </p>
                                                    <p className="text-gray-600">
                                                        <span className="font-medium">ระยะเวลา:</span> {formatDuration(session.duration_hours)}
                                                    </p>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {session.total_activities > 0 && (
                                        <div className="mt-3 pt-3 border-t border-gray-200">
                                            <p className="text-sm text-gray-600">
                                                <span className="font-medium">กิจกรรมทั้งหมด:</span> {session.total_activities} รายการ
                                            </p>
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Pagination */}
                        <div className="flex justify-between items-center">
                            <button
                                onClick={() => handlePageChange('prev')}
                                disabled={pagination.offset === 0}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                            >
                                ← หน้าก่อน
                            </button>

                            <span className="text-gray-600">
                                แสดง {pagination.offset + 1} - {Math.min(pagination.offset + sessions.length, pagination.total)} จาก {pagination.total}
                            </span>

                            <button
                                onClick={() => handlePageChange('next')}
                                disabled={!pagination.hasMore}
                                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
                            >
                                หน้าถัดไป →
                            </button>
                        </div>
                    </>
                )}

                {/* Session Detail Modal */}
                {selectedSession && (
                    <div className="fixed inset-0  backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                                <h2 className="text-xl font-bold text-gray-800">
                                    รายละเอียด: {getEOCTypeName(selectedSession)} (ครั้งที่ {selectedSession.session_number})
                                </h2>
                                <button
                                    onClick={handleCloseDetail}
                                    className="text-gray-500 hover:text-gray-700 text-2xl"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="p-6">
                                {detailLoading ? (
                                    <div className="text-center py-12">
                                        <div className="animate-spin rounded-full h-12 w-12 border-b border-blue-600 mx-auto"></div>
                                        <p className="mt-4 text-gray-600">กำลังโหลดรายละเอียด...</p>
                                    </div>
                                ) : sessionDetail ? (
                                    <>
                                        {/* Session Info */}
                                        <div className="bg-gray-50 rounded-lg p-4 mb-6">
                                            <h3 className="font-bold text-gray-800 mb-3">ข้อมูลทั่วไป</h3>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                                                <div>
                                                    <p className="text-gray-600 mb-2">
                                                        <span className="font-medium">เปิดเมื่อ:</span> {formatDate(sessionDetail.session.opened_at)}
                                                    </p>
                                                    <p className="text-gray-600 mb-2">
                                                        <span className="font-medium">เปิดโดย:</span> {sessionDetail.session.opened_by_name}
                                                    </p>
                                                    {sessionDetail.session.open_reason && (
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">เหตุผล:</span> {sessionDetail.session.open_reason}
                                                        </p>
                                                    )}
                                                    {sessionDetail.session.eoc_type === 'disease' && sessionDetail.session.disease_name && (
                                                        <p className="text-gray-600 mt-2">
                                                            <span className="font-medium">ประเภทโรค:</span> {sessionDetail.session.disease_name}
                                                        </p>
                                                    )}
                                                    {sessionDetail.session.open_order_file_path && (
                                                        <p className="text-gray-600 mt-2">
                                                            <span className="font-medium">ไฟล์คำสั่ง:</span>{' '}
                                                            <a
                                                                href={getFileUrl(sessionDetail.session.open_order_file_path)}
                                                                target="_blank"
                                                                rel="noreferrer"
                                                                className="text-blue-700 underline hover:text-blue-900"
                                                            >
                                                                {sessionDetail.session.open_order_file_name || 'เปิดไฟล์คำสั่ง'}
                                                            </a>
                                                        </p>
                                                    )}
                                                </div>
                                                {sessionDetail.session.status === 'closed' && (
                                                    <div>
                                                        <p className="text-gray-600 mb-2">
                                                            <span className="font-medium">ปิดเมื่อ:</span> {formatDate(sessionDetail.session.closed_at)}
                                                        </p>
                                                        <p className="text-gray-600 mb-2">
                                                            <span className="font-medium">ปิดโดย:</span> {sessionDetail.session.closed_by_name}
                                                        </p>
                                                        <p className="text-gray-600">
                                                            <span className="font-medium">ระยะเวลา:</span> {formatDuration(sessionDetail.session.duration_hours)}
                                                        </p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        {/* Summary */}
                                        {sessionDetail.summary && (
                                            <div className="mb-6">
                                                <h3 className="font-bold text-gray-800 mb-3">สรุปกิจกรรม</h3>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    {/* Action Types */}
                                                    {sessionDetail.summary.actionTypes && sessionDetail.summary.actionTypes.length > 0 && (
                                                        <div className="bg-blue-50 rounded-lg p-4">
                                                            <h4 className="font-medium text-gray-700 mb-2">ประเภทกิจกรรม</h4>
                                                            <div className="space-y-1 text-sm">
                                                                {sessionDetail.summary.actionTypes.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between">
                                                                        <span className="text-gray-600">{item.action_type}</span>
                                                                        <span className="font-medium">{item.count} ครั้ง</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Top Users */}
                                                    {sessionDetail.summary.topUsers && sessionDetail.summary.topUsers.length > 0 && (
                                                        <div className="bg-green-50 rounded-lg p-4">
                                                            <h4 className="font-medium text-gray-700 mb-2">ผู้ใช้งานที่มีกิจกรรมมากที่สุด</h4>
                                                            <div className="space-y-1 text-sm">
                                                                {sessionDetail.summary.topUsers.map((item, idx) => (
                                                                    <div key={idx} className="flex justify-between">
                                                                        <span className="text-gray-600">{item.full_name}</span>
                                                                        <span className="font-medium">{item.activity_count} ครั้ง</span>
                                                                    </div>
                                                                ))}
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}

                                        {/* Activities */}
                                        {sessionDetail.activities && sessionDetail.activities.length > 0 && (
                                            <div>
                                                <h3 className="font-bold text-gray-800 mb-3">
                                                    กิจกรรมทั้งหมด ({sessionDetail.activities.length} รายการ)
                                                </h3>
                                                <div className="space-y-2 max-h-96 overflow-y-auto">
                                                    {sessionDetail.activities.map((activity) => (
                                                        <div key={activity.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                                                            <div className="flex justify-between items-start mb-1">
                                                                <span className="font-medium text-gray-800">{activity.action_type}</span>
                                                                <span className="text-gray-500 text-xs">{formatDate(activity.created_at)}</span>
                                                            </div>
                                                            <p className="text-gray-600 mb-1">{activity.description}</p>
                                                            <p className="text-gray-500 text-xs">โดย: {activity.full_name}</p>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </>
                                ) : null}
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}
