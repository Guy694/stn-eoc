'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import EOCLayout from '@/components/layouts/EOCLayout';
import { showSuccess, showError, showConfirm, showDeleteConfirm } from '@/lib/sweetAlert';
import 'leaflet/dist/leaflet.css';

// Import Leaflet dynamically (client-side only)
const MapContainer = dynamic(() => import('react-leaflet').then(mod => mod.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(mod => mod.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(mod => mod.Marker), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(mod => mod.Popup), { ssr: false });

const DISASTER_TYPES = {
    flood: 'น้ำท่วม',
    drought: 'ภัยแล้ง',
    fire: 'อัคคีภัย',
    storm: 'พายุ',
    landslide: 'ดินถลม',
    earthquake: 'แผ่นดินไหว',
    other: 'อื่นๆ'
};

const STATUS_COLORS = {
    pending: 'bg-yellow-100 text-yellow-800 border-yellow-300',
    reviewing: 'bg-blue-100 text-blue-800 border-blue-300',
    verified: 'bg-green-100 text-green-800 border-green-300',
    resolved: 'bg-gray-100 text-gray-800 border-gray-300',
    rejected: 'bg-red-100 text-red-800 border-red-300'
};

const STATUS_LABELS = {
    pending: 'รอตรวจสอบ',
    reviewing: 'กำลังตรวจสอบ',
    verified: 'ยืนยันแล้ว',

    rejected: 'ปฏิเสธ'
};

export default function IncidentReportsPage() {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [stats, setStats] = useState({});
    const [filters, setFilters] = useState({
        status: '',
        disaster_type: ''
    });
    const [selectedReport, setSelectedReport] = useState(null);
    const [showModal, setShowModal] = useState(false);
    const [reviewData, setReviewData] = useState({
        status: '',
        admin_notes: ''
    });
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });
    const [mapMounted, setMapMounted] = useState(false);

    useEffect(() => {
        fetchReports();
    }, [filters, pagination.page]);

    useEffect(() => {
        setMapMounted(true);

        // Fix Leaflet marker icon issue in Next.js
        if (typeof window !== 'undefined') {
            import('leaflet').then((L) => {
                delete L.Icon.Default.prototype._getIconUrl;
                L.Icon.Default.mergeOptions({
                    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
                    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
                    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
                });
            });
        }
    }, []);

    const fetchReports = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams({
                page: pagination.page,
                limit: pagination.limit,
                ...filters
            });

            const response = await fetch(`/api/admin/incident-reports?${params}`);

            if (!response.ok) {
                showError('ไม่สามารถโหลดข้อมูลได้');
                return;
            }

            const data = await response.json();

            if (data.success) {
                setReports(data.data);
                setStats(data.stats || {});
                setPagination(prev => ({
                    ...prev,
                    total: data.pagination.total,
                    totalPages: data.pagination.totalPages
                }));
            }
        } catch (error) {
            console.error('Error fetching reports:', error);
            showError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    const handleViewReport = (report) => {
        setSelectedReport(report);
        setReviewData({
            status: report.status,
            admin_notes: report.admin_notes || ''
        });
        setShowModal(true);
    };

    const handleUpdateStatus = async () => {
        if (!reviewData.status) {
            showError('กรุณาเลือกสถานะ');
            return;
        }

        try {
            const response = await fetch('/api/admin/incident-reports', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    reportId: selectedReport.id,
                    status: reviewData.status,
                    adminNotes: reviewData.admin_notes,
                    reviewedBy: 1 // TODO: ใช้ user ID จริงจาก context
                })
            });

            if (!response.ok) {
                showError('ไม่สามารถอัปเดตสถานะได้');
                return;
            }

            const data = await response.json();

            if (data.success) {
                showSuccess('อัปเดตสถานะสำเร็จ');
                setShowModal(false);
                fetchReports();
            }
        } catch (error) {
            console.error('Error updating status:', error);
            showError('เกิดข้อผิดพลาดในการอัปเดตสถานะ');
        }
    };

    const handleDelete = async (reportId) => {
        const confirmed = await showDeleteConfirm('คุณต้องการลบรายงานนี้ใช่หรือไม่?');
        if (!confirmed) return;

        try {
            const response = await fetch(`/api/admin/incident-reports?id=${reportId}`, {
                method: 'DELETE'
            });

            if (!response.ok) {
                showError('ไม่สามารถลบรายงานได้');
                return;
            }

            const data = await response.json();

            if (data.success) {
                showSuccess('ลบรายงานสำเร็จ');
                fetchReports();
            }
        } catch (error) {
            console.error('Error deleting report:', error);
            showError('เกิดข้อผิดพลาดในการลบรายงาน');
        }
    };

    const getImageUrl = (imagePath) => {
        if (!imagePath) return null;

        // If it's already a full URL
        if (imagePath.startsWith('http://') || imagePath.startsWith('https://')) {
            return imagePath;
        }

        // If it already starts with /uploads
        if (imagePath.startsWith('/uploads/')) {
            return imagePath;
        }

        // Otherwise, prepend /uploads/incidents/
        return `/uploads/incidents/${imagePath}`;
    };

    const getPhotoArray = (photoPath) => {
        if (!photoPath) return [];

        try {
            // If it's already an array, return it
            if (Array.isArray(photoPath)) {
                return photoPath;
            }

            // If it's a string, try to parse it as JSON
            if (typeof photoPath === 'string') {
                // Check if it looks like JSON array
                if (photoPath.trim().startsWith('[')) {
                    return JSON.parse(photoPath);
                }
                // Otherwise, treat it as a single image path
                return [photoPath];
            }

            return [];
        } catch (error) {
            console.error('Error parsing photo path:', error);
            // If JSON parse fails, treat it as a single image path
            return typeof photoPath === 'string' ? [photoPath] : [];
        }
    };

    return (
        <EOCLayout>
            <div className="container mx-auto">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                        <span className="text-4xl">📋</span>

                    </h1>
                    <p className="text-gray-600">จัดการและตรวจสอบรายงานเหตุการณ์ที่ส่งมาจากประชาชน</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                        <div className="text-sm text-gray-600 mb-1">ทั้งหมด</div>
                        <div className="text-2xl font-bold text-gray-800">
                            {(stats.pending || 0) + (stats.approved || 0) + (stats.rejected || 0)}
                        </div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
                        <div className="text-sm text-gray-600 mb-1">รอตรวจสอบ</div>
                        <div className="text-2xl font-bold text-yellow-600">{stats.pending || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                        <div className="text-sm text-gray-600 mb-1">อนุมัติแล้ว</div>
                        <div className="text-2xl font-bold text-green-600">{stats.approved || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
                        <div className="text-sm text-gray-600 mb-1">ปฏิเสธ</div>
                        <div className="text-2xl font-bold text-red-600">{stats.rejected || 0}</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                สถานะ
                            </label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">ทั้งหมด</option>
                                <option value="pending">รอตรวจสอบ</option>
                                <option value="reviewing">กำลังตรวจสอบ</option>
                                <option value="verified">ยืนยันแล้ว</option>

                                <option value="rejected">ปฏิเสธ</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ประเภทภัย
                            </label>
                            <select
                                value={filters.disaster_type}
                                onChange={(e) => setFilters({ ...filters, disaster_type: e.target.value })}
                                className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">ทั้งหมด</option>
                                {Object.entries(DISASTER_TYPES).map(([key, label]) => (
                                    <option key={key} value={key}>{label}</option>
                                ))}
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setFilters({ status: '', disaster_type: '' })}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                ล้างตัวกรอง
                            </button>
                        </div>
                    </div>
                </div>

                {/* Reports Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            ไม่พบรายงานเหตุการณ์
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            วันที่รายงาน
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ผู้รายงาน
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ประเภทภัย
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            สถานที่
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            สถานะ
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            การดำเนินการ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {reports.map((report) => (
                                        <tr key={report.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {new Date(report.created_at).toLocaleString('th-TH')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {report.first_name} {report.last_name}
                                                </div>
                                                <div className="text-sm text-gray-500">
                                                    {report.phone}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {DISASTER_TYPES[report.disaster_type] || report.disaster_type}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-900">
                                                <div className="max-w-xs truncate">
                                                    {report.description || 'ไม่ระบุ'}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border ${STATUS_COLORS[report.status]}`}>
                                                    {STATUS_LABELS[report.status]}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => handleViewReport(report)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                >
                                                    ดูรายละเอียด
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(report.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    ลบ
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}

                    {/* Pagination */}
                    {pagination.totalPages > 1 && (
                        <div className="bg-white px-4 py-3 flex items-center justify-between border-t border-gray-200 sm:px-6">
                            <div className="flex-1 flex justify-between sm:hidden">
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                    disabled={pagination.page === 1}
                                    className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    ก่อนหน้า
                                </button>
                                <button
                                    onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                    disabled={pagination.page === pagination.totalPages}
                                    className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50 disabled:opacity-50"
                                >
                                    ถัดไป
                                </button>
                            </div>
                            <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                                <div>
                                    <p className="text-sm text-gray-700">
                                        แสดง <span className="font-medium">{((pagination.page - 1) * pagination.limit) + 1}</span> ถึง{' '}
                                        <span className="font-medium">
                                            {Math.min(pagination.page * pagination.limit, pagination.total)}
                                        </span>{' '}
                                        จาก <span className="font-medium">{pagination.total}</span> รายการ
                                    </p>
                                </div>
                                <div>
                                    <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                                        <button
                                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page - 1 }))}
                                            disabled={pagination.page === 1}
                                            className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            ก่อนหน้า
                                        </button>
                                        <span className="relative inline-flex items-center px-4 py-2 border border-gray-300 bg-white text-sm font-medium text-gray-700">
                                            หน้า {pagination.page} / {pagination.totalPages}
                                        </span>
                                        <button
                                            onClick={() => setPagination(prev => ({ ...prev, page: prev.page + 1 }))}
                                            disabled={pagination.page === pagination.totalPages}
                                            className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium text-gray-500 hover:bg-gray-50 disabled:opacity-50"
                                        >
                                            ถัดไป
                                        </button>
                                    </nav>
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Detail Modal */}
                {showModal && selectedReport && (
                    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <h2 className="text-2xl font-bold text-gray-800">รายละเอียดรายงาน</h2>
                                    <button
                                        onClick={() => setShowModal(false)}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <div className="space-y-4">
                                    {/* Reporter Info */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h3 className="font-semibold text-gray-700 mb-2">ข้อมูลผู้รายงาน</h3>
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <span className="text-sm text-gray-600">ชื่อ:</span>
                                                <p className="font-medium text-gray-600">{selectedReport.first_name} {selectedReport.last_name}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">เบอร์โทร:</span>
                                                <p className="font-medium text-gray-600">{selectedReport.phone}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Incident Info */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h3 className="font-semibold text-gray-700 mb-2">ข้อมูลเหตุการณ์</h3>
                                        <div className="space-y-2">
                                            <div>
                                                <span className="text-sm text-gray-600">ประเภทภัย:</span>
                                                <p className="font-medium text-gray-600">{DISASTER_TYPES[selectedReport.disaster_type] || selectedReport.disaster_type}</p>
                                            </div>
                                            {selectedReport.report_type && (
                                                <div>
                                                    <span className="text-sm text-gray-600">ประเภทรายงาน:</span>
                                                    <p className="font-medium text-gray-600">
                                                        {selectedReport.report_type === 'help_request' ? '🆘 แจ้งความช่วยเหลือ' : '🚧 แจ้งเส้นทางการจราจร'}
                                                    </p>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-sm text-gray-600">รายละเอียด:</span>
                                                <p className="font-medium text-gray-600">{selectedReport.description}</p>
                                            </div>
                                            {selectedReport.water_level && (
                                                <div>
                                                    <span className="text-sm text-gray-600">ระดับน้ำ:</span>
                                                    <p className="font-medium text-gray-600">{selectedReport.water_level} ซม.</p>
                                                </div>
                                            )}
                                            {selectedReport.affected_people && (
                                                <div>
                                                    <span className="text-sm text-gray-600">ผู้ได้รับผลกระทบ:</span>
                                                    <p className="font-medium text-gray-600">{selectedReport.affected_people} คน</p>
                                                </div>
                                            )}
                                            {selectedReport.urgency && (
                                                <div>
                                                    <span className="text-sm text-gray-600">ความเร่งด่วน:</span>
                                                    <p className={`font-medium ${selectedReport.urgency === 'critical' ? 'text-red-600' :
                                                        selectedReport.urgency === 'high' ? 'text-orange-600' :
                                                            selectedReport.urgency === 'medium' ? 'text-yellow-600' :
                                                                'text-blue-600'
                                                        }`}>
                                                        {selectedReport.urgency === 'critical' ? 'เร่งด่วนมาก' :
                                                            selectedReport.urgency === 'high' ? 'เร่งด่วน' :
                                                                selectedReport.urgency === 'medium' ? 'ปานกลาง' :
                                                                    'ไม่เร่งด่วน'}
                                                    </p>
                                                </div>
                                            )}
                                            {selectedReport.travel_status && (
                                                <div>
                                                    <span className="text-sm text-gray-600">สถานะการสัญจร:</span>
                                                    <p className="font-medium text-gray-600">
                                                        {selectedReport.travel_status === 'passable' ? '✅ สัญจรได้ปกติ' :
                                                            selectedReport.travel_status === 'difficult' ? '⚠️ สัญจรได้ยากลำบาก' :
                                                                '🚫 ไม่สามารถสัญจรได้'}
                                                    </p>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-sm text-gray-600">สถานที่:</span>
                                                <p className="font-medium text-gray-600">หมู่บ้าน {selectedReport.village || '-'} ตำบล {selectedReport.sub_district || '-'} อำเภอ {selectedReport.district || '-'}</p>
                                            </div>
                                            <div>
                                                <span className="text-sm text-gray-600">พิกัด:</span>
                                                <p className="font-medium text-gray-600">
                                                    {selectedReport.latitude}, {selectedReport.longitude}
                                                </p>
                                            </div>
                                            {selectedReport.occurred_at && (
                                                <div>
                                                    <span className="text-sm text-gray-600">วันเวลาที่เกิดเหตุ:</span>
                                                    <p className="font-medium text-gray-600">{new Date(selectedReport.occurred_at).toLocaleString('th-TH')}</p>
                                                </div>
                                            )}
                                            <div>
                                                <span className="text-sm text-gray-600">วันที่รายงาน:</span>
                                                <p className="font-medium text-gray-600">{new Date(selectedReport.created_at).toLocaleString('th-TH')}</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Map */}
                                    {selectedReport.latitude && selectedReport.longitude && mapMounted && (
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <h3 className="font-semibold text-gray-700 mb-2">ตำแหน่งบนแผนที่</h3>
                                            <div className="w-full h-64 rounded-lg border border-gray-300 overflow-hidden">
                                                <MapContainer
                                                    center={[parseFloat(selectedReport.latitude), parseFloat(selectedReport.longitude)]}
                                                    zoom={15}
                                                    style={{ height: '100%', width: '100%' }}
                                                    scrollWheelZoom={false}
                                                >
                                                    <TileLayer
                                                        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                                                        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                                    />
                                                    <Marker position={[parseFloat(selectedReport.latitude), parseFloat(selectedReport.longitude)]}>
                                                        <Popup>
                                                            <div className="text-sm">
                                                                <strong>{DISASTER_TYPES[selectedReport.disaster_type] || selectedReport.disaster_type}</strong>
                                                                <br />
                                                                {selectedReport.description}
                                                            </div>
                                                        </Popup>
                                                    </Marker>
                                                </MapContainer>
                                            </div>
                                            <p className="text-sm text-gray-600 mt-2">
                                                📍 พิกัด: {selectedReport.latitude}, {selectedReport.longitude}
                                            </p>
                                        </div>
                                    )}

                                    {/* Images */}
                                    {selectedReport.photo_path && (
                                        <div className="bg-gray-50 rounded-lg p-4">
                                            <h3 className="font-semibold text-gray-700 mb-2">รูปภาพ</h3>
                                            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                                {getPhotoArray(selectedReport.photo_path).map((img, idx) => {
                                                    const imageUrl = getImageUrl(img);
                                                    return (
                                                        <div key={idx} className="relative h-48 bg-gray-200 rounded-lg overflow-hidden">
                                                            <img
                                                                src={imageUrl}
                                                                alt={`รูปภาพ ${idx + 1}`}
                                                                className="w-full h-full object-cover"
                                                                onError={(e) => {
                                                                    e.target.onerror = null;
                                                                    e.target.src = '/img/no-image.png';
                                                                    e.target.alt = 'ไม่สามารถโหลดรูปภาพได้';
                                                                }}
                                                            />
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                    )}

                                    {/* Review Section */}
                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <h3 className="font-semibold text-gray-700 mb-3">การตรวจสอบ</h3>
                                        <div className="space-y-3">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    สถานะ *
                                                </label>
                                                <select
                                                    value={reviewData.status}
                                                    onChange={(e) => setReviewData({ ...reviewData, status: e.target.value })}
                                                    className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                >
                                                    <option value="">เลือกสถานะ</option>
                                                    <option value="pending">รอตรวจสอบ</option>
                                                    <option value="reviewing">กำลังตรวจสอบ</option>
                                                    <option value="verified">ยืนยันแล้ว</option>
                                                    <option value="rejected">ปฏิเสธ</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-2">
                                                    หมายเหตุ
                                                </label>
                                                <textarea
                                                    value={reviewData.admin_notes}
                                                    onChange={(e) => setReviewData({ ...reviewData, admin_notes: e.target.value })}
                                                    rows={3}
                                                    className="text-gray-600 
                                                    w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                                    placeholder="หมายเหตุเพิ่มเติม (ถ้ามี)"
                                                />
                                            </div>
                                            {selectedReport.reviewed_at && (
                                                <div className="text-sm text-gray-600">
                                                    ตรวจสอบเมื่อ: {new Date(selectedReport.reviewed_at).toLocaleString('th-TH')}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <button
                                            onClick={() => setShowModal(false)}
                                            className="px-4 py-2 bg-red-600 rounded-lg text-white hover:bg-red-700"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            onClick={handleUpdateStatus}
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            บันทึก
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}
