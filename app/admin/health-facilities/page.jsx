'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';
import AppIcon from "@/components/icons/AppIcon";

export default function HealthFacilitiesPage() {
    const [facilities, setFacilities] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [showModal, setShowModal] = useState(false);
    const [editingFacility, setEditingFacility] = useState(null);
    const [formData, setFormData] = useState({
        name: '',
        typecode: '',
        address: '',
        district: '',
        tambon: '',
        lat: '',
        lon: '',
        phone: ''
    });

    const facilityTypes = [
        { value: 'รพ.ทั่วไป', label: 'โรงพยาบาลทั่วไป', color: 'bg-red-100 text-red-700' },
        { value: 'รพ.ชุมชน', label: 'โรงพยาบาลชุมชน', color: 'bg-orange-100 text-orange-700' },
        { value: 'รพ.สต.', label: 'โรงพยาบาลส่งเสริมสุขภาพตำบล', color: 'bg-green-100 text-green-700' },
        { value: 'ศสช.', label: 'ศูนย์สาธารณสุข', color: 'bg-blue-100 text-blue-700' },
        { value: 'สสจ', label: 'สำนักงานสาธารณสุขจังหวัด', color: 'bg-teal-100 text-teal-700' },
        { value: 'สสอ.', label: 'สำนักงานสาธารณสุขอำเภอ', color: 'bg-pink-100 text-pink-700' },
        { value: 'สอน.', label: 'สถานีอนามัย', color: 'bg-cyan-100 text-cyan-700' }
    ];

    const fetchFacilities = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterType) params.append('type', filterType);
            if (searchTerm) params.append('search', searchTerm);

            const response = await fetch(`/stn-eoc/api/admin/health-facilities?${params}`);
            const data = await response.json();

            if (data.success) {
                setFacilities(data.data);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching facilities:', error);
            showError('ไม่สามารถโหลดข้อมูลได้');
        } finally {
            setLoading(false);
        }
    }, [filterType, searchTerm]);

    useEffect(() => {
        fetchFacilities();
    }, [fetchFacilities]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterType, searchTerm]);

    const paginatedFacilities = useMemo(
        () => paginateRows(facilities, currentPage, pageSize),
        [facilities, currentPage, pageSize]
    );

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = editingFacility
                ? `/stn-eoc/api/admin/health-facilities/${editingFacility.id}`
                : '/stn-eoc/api/admin/health-facilities';

            const method = editingFacility ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                showSuccess(editingFacility ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มสถานพยาบาลสำเร็จ');
                setShowModal(false);
                resetForm();
                fetchFacilities();
            } else {
                showError(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error saving facility:', error);
            showError('ไม่สามารถบันทึกข้อมูลได้');
        }
    };

    const handleEdit = (facility) => {
        setEditingFacility(facility);
        setFormData({
            name: facility.name,
            typecode: facility.typecode,
            address: facility.address || '',
            district: facility.district || '',
            tambon: facility.tambon || '',
            lat: facility.lat || '',
            lon: facility.lon || '',
            phone: facility.phone || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (facility) => {
        if (!confirm(`ต้องการลบ ${facility.name} ใช่หรือไม่?`)) return;

        try {
            const response = await fetch(`/stn-eoc/api/admin/health-facilities/${facility.id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('ลบข้อมูลสำเร็จ');
                fetchFacilities();
            } else {
                showError(data.error || 'ไม่สามารถลบข้อมูลได้');
            }
        } catch (error) {
            console.error('Error deleting facility:', error);
            showError('ไม่สามารถลบข้อมูลได้');
        }
    };

    const resetForm = () => {
        setFormData({
            name: '',
            typecode: '',
            address: '',
            district: '',
            tambon: '',
            lat: '',
            lon: '',
            phone: ''
        });
        setEditingFacility(null);
    };

    const getTypeColor = (type) => {
        const found = facilityTypes.find(t => t.value === type);
        return found ? found.color : 'bg-gray-100 text-gray-700';
    };

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        <AppIcon icon="hospital" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> จัดการหน่วยบริการ
                    </h1>
                    <p className="text-gray-600">ระบบจัดการข้อมูลสถานพยาบาลและสถานีอนามัย</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    {facilityTypes.map(type => (
                        <div key={type.value} className={`bg-white rounded-lg shadow p-4 border ${getTypeColor(type.value)}`}>
                            <div className="text-sm text-gray-600 mb-1">{type.label}</div>
                            <div className="text-2xl font-bold">
                                {stats[type.value] || 0}
                            </div>
                        </div>
                    ))}
                </div>



                {/* Search and Filter */}
                <div className="bg-white p-4 rounded-lg shadow mb-6 text-gray-800">
                    <div className="flex flex-wrap gap-4 ">
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อสถานพยาบาล, ที่อยู่..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทุกประเภท</option>
                            {facilityTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        <button
                            onClick={() => {
                                resetForm();
                                setShowModal(true);
                            }}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            <AppIcon icon="plus" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เพิ่มสถานพยาบาล
                        </button>
                    </div>
                </div>

                {/* Facilities Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : facilities.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            ไม่พบข้อมูลสถานพยาบาล
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อสถานพยาบาล</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ที่อยู่</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ/ตำบล</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">พิกัด</th>

                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {paginatedFacilities.map((facility) => (
                                        <tr key={facility.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {facility.id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{facility.name}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getTypeColor(facility.typecode)}`}>
                                                    {facility.typecode}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                {facility.address || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {facility.district_name || '-'} / {facility.tambon || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {facility.lat && facility.lon
                                                    ? `${parseFloat(facility.lat).toFixed(4)}, ${parseFloat(facility.lon).toFixed(4)}`
                                                    : '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {facility.phone || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleEdit(facility)}
                                                    className="text-blue-600 hover:text-blue-800 mr-3"
                                                >
                                                    <AppIcon icon="edit" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(facility)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <AppIcon icon="trash" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                    <PaginationControls
                        page={currentPage}
                        pageSize={pageSize}
                        totalItems={facilities.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="แห่ง"
                    />
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-700">
                            {editingFacility ? "แก้ไขสถานพยาบาล" : "เพิ่มสถานพยาบาลใหม่"}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ชื่อสถานพยาบาล *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ประเภท *
                                    </label>
                                    <select
                                        required
                                        value={formData.typecode}
                                        onChange={(e) => setFormData({ ...formData, typecode: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="">เลือกประเภท</option>
                                        {facilityTypes.map(type => (
                                            <option key={type.value} value={type.value}>
                                                {type.label}
                                            </option>
                                        ))}
                                    </select>
                                </div>



                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ที่อยู่
                                    </label>
                                    <textarea
                                        value={formData.address}
                                        onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                        rows={2}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        อำเภอ
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.district}
                                        onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ตำบล
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.tambon}
                                        onChange={(e) => setFormData({ ...formData, tambon: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Latitude (ละติจูด)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.lat}
                                        onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="6.xxxxx"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Longitude (ลองจิจูด)
                                    </label>
                                    <input
                                        type="number"
                                        step="any"
                                        value={formData.lon}
                                        onChange={(e) => setFormData({ ...formData, lon: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="100.xxxxx"
                                    />
                                </div>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    <AppIcon icon="save" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> บันทึก
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    <AppIcon icon="xCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ยกเลิก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </EOCLayout>
    );
}
