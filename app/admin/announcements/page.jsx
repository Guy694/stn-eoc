'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import EOCLayout from '@/components/layouts/EOCLayout';
import { showSuccess, showError, showDeleteConfirm } from '@/lib/sweetAlert';
import Image from 'next/image';

function AnnouncementsContent() {
    const { user } = useAuth();
    const searchParams = useSearchParams();
    const eocParam = searchParams.get('eoc');

    const [announcements, setAnnouncements] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editMode, setEditMode] = useState(false);
    const [selectedAnnouncement, setSelectedAnnouncement] = useState(null);
    const [filters, setFilters] = useState({
        eoc_type: eocParam || '',
        is_active: '',
        show_popup: ''
    });
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        popup: 0
    });
    const [eocStats, setEocStats] = useState({});
    const [pagination, setPagination] = useState({
        page: 1,
        limit: 20,
        total: 0,
        totalPages: 0
    });

    const eocTypes = [
        { value: 'flood', label: '💧 น้ำท่วม', color: 'blue' },
        { value: 'festival-accidents', label: '🎉 อุบัติเหตุช่วงเทศกาล', color: 'yellow' },
        { value: 'disease', label: '🦠 โรคระบาด', color: 'red' }
    ];

    const [formData, setFormData] = useState({
        title: '',
        eoc_type: eocParam || 'flood',
        description: '',
        show_popup: false,
        priority: 0,
        is_active: true,
        start_date: '',
        end_date: ''
    });
    const [imageFile, setImageFile] = useState(null);
    const [imagePreview, setImagePreview] = useState(null);

    useEffect(() => {
        fetchAnnouncements();
    }, [filters, pagination.page]);

    // Update filter when URL parameter changes
    useEffect(() => {
        if (eocParam) {
            setFilters(prev => ({ ...prev, eoc_type: eocParam }));
        }
    }, [eocParam]);

    const fetchAnnouncements = async () => {
        setLoading(true);
        try {
            const params = new URLSearchParams();
            params.append('page', pagination.page);
            params.append('limit', pagination.limit);
            if (filters.eoc_type !== '') params.append('eoc_type', filters.eoc_type);
            if (filters.is_active !== '') params.append('is_active', filters.is_active);
            if (filters.show_popup !== '') params.append('show_popup', filters.show_popup);

            const response = await fetch(`/stn-eoc/api/admin/announcements?${params}`);
            const data = await response.json();

            console.log('Announcements API Response:', data);

            if (data.success) {
                setAnnouncements(data.data);
                if (data.stats) {
                    setStats(data.stats);
                }
                if (data.eocStats) {
                    setEocStats(data.eocStats);
                }
                if (data.pagination) {
                    setPagination(prev => ({
                        ...prev,
                        total: data.pagination.total,
                        totalPages: data.pagination.totalPages
                    }));
                }
                console.log('Announcements data:', data.data);
            } else {
                showError(data.message || 'ไม่สามารถโหลดข้อมูลได้');
            }
        } catch (error) {
            console.error('Error fetching announcements:', error);
            showError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
        } finally {
            setLoading(false);
        }
    };

    const handleImageChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            setImageFile(file);
            const reader = new FileReader();
            reader.onloadend = () => {
                setImagePreview(reader.result);
            };
            reader.readAsDataURL(file);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        if (!editMode && !imageFile) {
            showError('กรุณาเลือกรูปภาพแบนเนอร์');
            return;
        }

        try {
            if (editMode) {
                // Update
                const response = await fetch('/stn-eoc/api/admin/announcements', {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: selectedAnnouncement.id,
                        ...formData
                    })
                });

                const data = await response.json();
                if (data.success) {
                    showSuccess('อัปเดตแบนเนอร์สำเร็จ');
                    setShowModal(false);
                    fetchAnnouncements();
                    resetForm();
                }
            } else {
                // Create
                const formDataToSend = new FormData();
                formDataToSend.append('title', formData.title);
                formDataToSend.append('eoc_type', formData.eoc_type);
                formDataToSend.append('description', formData.description);
                formDataToSend.append('show_popup', formData.show_popup);
                formDataToSend.append('priority', formData.priority);
                formDataToSend.append('is_active', formData.is_active);
                formDataToSend.append('start_date', formData.start_date);
                formDataToSend.append('end_date', formData.end_date);
                formDataToSend.append('created_by', user?.id || 1);
                formDataToSend.append('image', imageFile);

                const response = await fetch('/stn-eoc/api/admin/announcements', {
                    method: 'POST',
                    body: formDataToSend
                });

                const data = await response.json();
                if (data.success) {
                    showSuccess('สร้างแบนเนอร์สำเร็จ');
                    setShowModal(false);
                    fetchAnnouncements();
                    resetForm();
                }
            }
        } catch (error) {
            console.error('Error saving announcement:', error);
            showError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleEdit = (announcement) => {
        setEditMode(true);
        setSelectedAnnouncement(announcement);
        setFormData({
            title: announcement.title,
            eoc_type: announcement.eoc_type || 'flood',
            description: announcement.description || '',
            show_popup: announcement.show_popup === 1,
            priority: announcement.priority,
            is_active: announcement.is_active === 1,
            start_date: announcement.start_date ? announcement.start_date.slice(0, 16) : '',
            end_date: announcement.end_date ? announcement.end_date.slice(0, 16) : ''
        });
        setImagePreview(announcement.image_path);
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await showDeleteConfirm('คุณต้องการลบแบนเนอร์นี้ใช่หรือไม่?');
        if (!confirmed) return;

        try {
            const response = await fetch(`/stn-eoc/api/admin/announcements?id=${id}`, {
                method: 'DELETE'
            });

            const data = await response.json();
            if (data.success) {
                showSuccess('ลบแบนเนอร์สำเร็จ');
                fetchAnnouncements();
            }
        } catch (error) {
            console.error('Error deleting announcement:', error);
            showError('เกิดข้อผิดพลาดในการลบแบนเนอร์');
        }
    };

    const resetForm = () => {
        setFormData({
            title: '',
            eoc_type: filters.eoc_type || 'flood',
            description: '',
            show_popup: false,
            priority: 0,
            is_active: true,
            start_date: '',
            end_date: ''
        });
        setImageFile(null);
        setImagePreview(null);
        setEditMode(false);
        setSelectedAnnouncement(null);
    };

    const openCreateModal = () => {
        resetForm();
        setShowModal(true);
    };

    return (
        <EOCLayout>
            <div className="container mx-auto px-4">
                {/* Header */}
                <div className="mb-6 flex justify-between items-center">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                            <span className="text-4xl">📢</span>
                            จัดการประชาสัมพันธ์/แบนเนอร์
                            {filters.eoc_type && (
                                <span className="text-xl text-gray-600">
                                    ({eocTypes.find(t => t.value === filters.eoc_type)?.label})
                                </span>
                            )}
                        </h1>
                        <p className="text-gray-600">จัดการแบนเนอร์และประกาศข่าวสารต่างๆ</p>
                    </div>
                    <button
                        onClick={openCreateModal}
                        className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                        <span className="text-xl">➕</span>
                        เพิ่มแบนเนอร์ใหม่
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                        <div className="text-sm text-gray-600 mb-1">ทั้งหมด</div>
                        <div className="text-2xl font-bold text-gray-800">{stats.total}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
                        <div className="text-sm text-gray-600 mb-1">เปิดใช้งาน</div>
                        <div className="text-2xl font-bold text-green-600">{stats.active}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
                        <div className="text-sm text-gray-600 mb-1">แสดง Popup</div>
                        <div className="text-2xl font-bold text-blue-600">{stats.popup}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-500">
                        <div className="text-sm text-gray-600 mb-1">ปิดใช้งาน</div>
                        <div className="text-2xl font-bold text-gray-600">{stats.inactive}</div>
                    </div>
                </div>

                {/* EOC Stats */}
                {Object.keys(eocStats).length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                        {eocTypes.map(type => (
                            <div key={type.value} className="bg-white rounded-lg shadow p-4 border-l-4 border-gray-300">
                                <div className="text-sm text-gray-600 mb-1">{type.label}</div>
                                <div className="text-xl font-bold text-gray-800">
                                    {eocStats[type.value]?.count || 0}
                                    <span className="text-sm text-gray-500 ml-1">
                                        ({eocStats[type.value]?.active || 0} เปิด)
                                    </span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                ประเภท EOC
                            </label>
                            <select
                                value={filters.eoc_type}
                                onChange={(e) => setFilters({ ...filters, eoc_type: e.target.value })}
                                className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">ทั้งหมด</option>
                                {eocTypes.map(type => (
                                    <option key={type.value} value={type.value}>{type.label}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                สถานะการใช้งาน
                            </label>
                            <select
                                value={filters.is_active}
                                onChange={(e) => setFilters({ ...filters, is_active: e.target.value })}
                                className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">ทั้งหมด</option>
                                <option value="true">เปิดใช้งาน</option>
                                <option value="false">ปิดใช้งาน</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                แสดง Popup
                            </label>
                            <select
                                value={filters.show_popup}
                                onChange={(e) => setFilters({ ...filters, show_popup: e.target.value })}
                                className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                            >
                                <option value="">ทั้งหมด</option>
                                <option value="true">แสดง</option>
                                <option value="false">ไม่แสดง</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setFilters({ eoc_type: '', is_active: '', show_popup: '' })}
                                className="px-4 py-2 bg-gray-500 text-white rounded-lg hover:bg-gray-600 transition-colors"
                            >
                                ล้างตัวกรอง
                            </button>
                        </div>
                    </div>
                </div>

                {/* Announcements List */}
                <div className="bg-white rounded-lg shadow">
                    {loading ? (
                        <div className="flex justify-center items-center py-12">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                        </div>
                    ) : announcements.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            ยังไม่มีแบนเนอร์
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            รูปภาพ
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            หัวข้อ
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ประเภท EOC
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            สถานะ
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            แสดง Popup
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ลำดับ
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            ผู้ลงข่าว
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            วันที่สร้าง
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            การดำเนินการ
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {announcements.map((announcement) => (
                                        <tr key={announcement.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="relative h-16 w-24">
                                                    <img
                                                        src={announcement.image_path}
                                                        alt={announcement.title}
                                                        className="h-full w-full object-cover rounded"
                                                    />
                                                </div>
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="text-sm font-medium text-gray-900">
                                                    {announcement.title}
                                                </div>
                                                {announcement.description && (
                                                    <div className="text-sm text-gray-500 truncate max-w-xs">
                                                        {announcement.description}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="text-gray-600 px-6 py-4 whitespace-nowrap">
                                                <span className="text-sm">
                                                    {eocTypes.find(t => t.value === announcement.eoc_type)?.label || announcement.eoc_type}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${announcement.is_active
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {announcement.is_active ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${announcement.show_popup
                                                    ? 'bg-blue-100 text-blue-800'
                                                    : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                    {announcement.show_popup ? '✓ แสดง' : '✗ ไม่แสดง'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {announcement.priority}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {announcement.created_by_name || `User ID: ${announcement.created_by}`}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {new Date(announcement.created_at).toLocaleDateString('th-TH')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => handleEdit(announcement)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                >
                                                    แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(announcement.id)}
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

                {/* Create/Edit Modal */}
                {showModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <h2 className="text-2xl font-bold text-gray-800">
                                        {editMode ? 'แก้ไขแบนเนอร์' : 'เพิ่มแบนเนอร์ใหม่'}
                                    </h2>
                                    <button
                                        onClick={() => {
                                            setShowModal(false);
                                            resetForm();
                                        }}
                                        className="text-gray-400 hover:text-gray-600"
                                    >
                                        <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                        </svg>
                                    </button>
                                </div>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Title */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            หัวข้อ *
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.title}
                                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                            className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                            required
                                        />
                                    </div>

                                    {/* EOC Type */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            ประเภท EOC *
                                        </label>
                                        <select
                                            value={formData.eoc_type}
                                            onChange={(e) => setFormData({ ...formData, eoc_type: e.target.value })}
                                            className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                            required
                                        >
                                            {eocTypes.map(type => (
                                                <option key={type.value} value={type.value}>{type.label}</option>
                                            ))}
                                        </select>
                                    </div>

                                    {/* Description */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            รายละเอียด
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows={3}
                                            className=" text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>

                                    {/* Image */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            รูปภาพแบนเนอร์ {!editMode && '*'}
                                        </label>
                                        <input
                                            type="file"
                                            accept="image/*"
                                            onChange={handleImageChange}
                                            className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                        {imagePreview && (
                                            <div className="mt-2">
                                                <img
                                                    src={imagePreview}
                                                    alt="Preview"
                                                    className=" text-gray-600 max-w-full h-48 object-contain rounded border"
                                                />
                                            </div>
                                        )}
                                    </div>

                                    {/* Checkboxes */}
                                    <div className="flex gap-6">
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.is_active}
                                                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-gray-700">เปิดใช้งาน</span>
                                        </label>
                                        <label className="flex items-center">
                                            <input
                                                type="checkbox"
                                                checked={formData.show_popup}
                                                onChange={(e) => setFormData({ ...formData, show_popup: e.target.checked })}
                                                className="mr-2"
                                            />
                                            <span className="text-sm text-gray-700">แสดงเป็น Popup หน้าแรก</span>
                                        </label>
                                    </div>

                                    {/* Priority */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            ลำดับความสำคัญ (เลขมากแสดงก่อน)
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.priority}
                                            onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) })}
                                            className="text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>

                                    {/* Dates */}
                                    <div className="grid grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                วันที่เริ่มแสดง
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={formData.start_date}
                                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                                className=" text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">
                                                วันที่สิ้นสุด
                                            </label>
                                            <input
                                                type="datetime-local"
                                                value={formData.end_date}
                                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                                className=" text-gray-600 w-full border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>

                                    {/* Action Buttons */}
                                    <div className="flex justify-end gap-3 pt-4 border-t">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowModal(false);
                                                resetForm();
                                            }}
                                            className="px-4 py-2 bg-red-500 rounded-lg text-white hover:bg-red-600"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            {editMode ? 'บันทึก' : 'สร้าง'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}

export default function AnnouncementsPage() {
    return (
        <Suspense fallback={
            <EOCLayout>
                <div className="flex justify-center items-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-500"></div>
                </div>
            </EOCLayout>
        }>
            <AnnouncementsContent />
        </Suspense>
    );
}
