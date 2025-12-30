'use client';

import { useState, useEffect } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';

export default function VillagePolygonsPage() {
    const [polygons, setPolygons] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterDistrict, setFilterDistrict] = useState('');
    const [filterTambon, setFilterTambon] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingPolygon, setEditingPolygon] = useState(null);
    const [formData, setFormData] = useState({
        villname: '',
        distname: '',
        subdistnam: '',
        coordinates: ''
    });

    useEffect(() => {
        fetchPolygons();
    }, [filterDistrict, filterTambon, searchTerm]);

    const fetchPolygons = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterDistrict) params.append('district', filterDistrict);
            if (filterTambon) params.append('tambon', filterTambon);
            if (searchTerm) params.append('search', searchTerm);

            const response = await fetch(`/api/admin/village-polygons?${params}`);
            const data = await response.json();

            if (data.success) {
                setPolygons(data.data);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching polygons:', error);
            showError('ไม่สามารถโหลดข้อมูลได้');
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = editingPolygon
                ? `/api/admin/village-polygons/${editingPolygon.id}`
                : '/api/admin/village-polygons';

            const method = editingPolygon ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                showSuccess(editingPolygon ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มข้อมูลหมู่บ้านสำเร็จ');
                setShowModal(false);
                resetForm();
                fetchPolygons();
            } else {
                showError(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error saving polygon:', error);
            showError('ไม่สามารถบันทึกข้อมูลได้');
        }
    };

    const handleEdit = (polygon) => {
        setEditingPolygon(polygon);
        setFormData({
            villname: polygon.villname,
            distname: polygon.distname,
            subdistnam: polygon.subdistnam,
            coordinates: polygon.coordinates || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (polygon) => {
        if (!confirm(`ต้องการลบ ${polygon.villname} ใช่หรือไม่?`)) return;

        try {
            const response = await fetch(`/api/admin/village-polygons/${polygon.id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('ลบข้อมูลสำเร็จ');
                fetchPolygons();
            } else {
                showError(data.error || 'ไม่สามารถลบข้อมูลได้');
            }
        } catch (error) {
            console.error('Error deleting polygon:', error);
            showError('ไม่สามารถลบข้อมูลได้');
        }
    };

    const resetForm = () => {
        setFormData({
            villname: '',
            distname: '',
            subdistnam: '',
            coordinates: ''
        });
        setEditingPolygon(null);
    };

    // ดึงรายการอำเภอที่ไม่ซ้ำ
    const districts = [...new Set(polygons.map(p => p.distname))].filter(Boolean).sort();

    // ดึงรายการตำบลที่ไม่ซ้ำ (ตามอำเภอที่เลือก)
    const tambons = [...new Set(
        polygons
            .filter(p => !filterDistrict || p.distname === filterDistrict)
            .map(p => p.subdistnam)
    )].filter(Boolean).sort();

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        🗺️ จัดการข้อมูลหมู่บ้าน
                    </h1>
                    <p className="text-gray-600">ระบบจัดการข้อมูล Polygon และพิกัดหมู่บ้าน</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="text-sm text-gray-600 mb-1">จำนวนหมู่บ้านทั้งหมด</div>
                        <div className="text-3xl font-bold text-gray-800">
                            {stats.total || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="text-sm text-gray-600 mb-1">จำนวนอำเภอ</div>
                        <div className="text-3xl font-bold text-gray-800">
                            {stats.districts || 0}
                        </div>
                    </div>
                    <div className="bg-white p-6 rounded-lg shadow">
                        <div className="text-sm text-gray-600 mb-1">จำนวนตำบล</div>
                        <div className="text-3xl font-bold text-gray-800">
                            {stats.tambons || 0}
                        </div>
                    </div>
                </div>

                {/* Search and Filter */}
                <div className="bg-white p-4 rounded-lg shadow mb-6 text-gray-800">
                    <div className="flex flex-wrap gap-4">
                        <input
                            type="text"
                            placeholder="🔍 ค้นหาชื่อหมู่บ้าน..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={filterDistrict}
                            onChange={(e) => {
                                setFilterDistrict(e.target.value);
                                setFilterTambon(''); // รีเซ็ตตำบลเมื่อเปลี่ยนอำเภอ
                            }}
                            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทุกอำเภอ</option>
                            {districts.map(district => (
                                <option key={district} value={district}>
                                    {district}
                                </option>
                            ))}
                        </select>
                        <select
                            value={filterTambon}
                            onChange={(e) => setFilterTambon(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            disabled={!filterDistrict}
                        >
                            <option value="">ทุกตำบล</option>
                            {tambons.map(tambon => (
                                <option key={tambon} value={tambon}>
                                    {tambon}
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
                            ➕ เพิ่มหมู่บ้าน
                        </button>
                    </div>
                </div>

                {/* Polygons Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : polygons.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            ไม่พบข้อมูลหมู่บ้าน
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อหมู่บ้าน</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ตำบล</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">พิกัด Polygon</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {polygons.map((polygon) => (
                                        <tr key={polygon.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {polygon.id}
                                            </td>
                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{polygon.villname}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {polygon.distname}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {polygon.subdistnam}
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                <div className="max-w-xs truncate">
                                                    {polygon.coordinates
                                                        ? `${polygon.coordinates.substring(0, 50)}...`
                                                        : '-'
                                                    }
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleEdit(polygon)}
                                                    className="text-blue-600 hover:text-blue-800 mr-3"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(polygon)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    🗑️
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
                        <h2 className="text-xl font-bold mb-4 text-gray-700">
                            {editingPolygon ? '✏️ แก้ไขข้อมูลหมู่บ้าน' : '➕ เพิ่มข้อมูลหมู่บ้านใหม่'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ชื่อหมู่บ้าน *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.villname}
                                    onChange={(e) => setFormData({ ...formData, villname: e.target.value })}
                                    className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        อำเภอ *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.distname}
                                        onChange={(e) => setFormData({ ...formData, distname: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        ตำบล *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.subdistnam}
                                        onChange={(e) => setFormData({ ...formData, subdistnam: e.target.value })}
                                        className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    พิกัด Polygon (GeoJSON coordinates)
                                </label>
                                <textarea
                                    value={formData.coordinates}
                                    onChange={(e) => setFormData({ ...formData, coordinates: e.target.value })}
                                    rows={6}
                                    className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                                    placeholder='[[[100.123, 6.456], [100.124, 6.457], ...]]'
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    รูปแบบ: GeoJSON coordinates array (Polygon หรือ MultiPolygon)
                                </p>
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors"
                                >
                                    💾 บันทึก
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowModal(false);
                                        resetForm();
                                    }}
                                    className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors"
                                >
                                    ❌ ยกเลิก
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </EOCLayout>
    );
}
