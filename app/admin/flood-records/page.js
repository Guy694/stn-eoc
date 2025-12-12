"use client";
import { useState, useEffect } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { satunDistricts } from "@/data/satunData";

export default function FloodRecordsPage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [filters, setFilters] = useState({
        year: new Date().getFullYear(),
        district: 'all',
        tambon: 'all',
        flood_level: 'all',
        status: 'all'
    });

    const [formData, setFormData] = useState({
        year: new Date().getFullYear(),
        district: '',
        tambon: '',
        village: '',
        flood_level: 'ไม่มี',
        flood_start_date: '',
        flood_end_date: '',
        water_depth_cm: '',
        affected_area_sqm: '',
        affected_households: 0,
        affected_people: 0,
        description: '',
        damage_amount: 0,
        relief_amount: 0,
        status: 'รอดำเนินการ'
    });

    const [tambonOptions, setTambonOptions] = useState([]);
    const currentYear = new Date().getFullYear();
    const years = Array.from({ length: 10 }, (_, i) => currentYear - i);

    // โหลดข้อมูล
    useEffect(() => {
        fetchRecords();
    }, [filters]);

    // อัพเดตตัวเลือกตำบลเมื่อเลือกอำเภอ
    useEffect(() => {
        if (formData.district) {
            const district = satunDistricts.find(d => d.name === formData.district);
            setTambonOptions(district?.tambons || []);
        } else {
            setTambonOptions([]);
        }
    }, [formData.district]);

    const fetchRecords = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filters.year) params.append('year', filters.year);
            if (filters.district !== 'all') params.append('district', filters.district);
            if (filters.tambon !== 'all') params.append('tambon', filters.tambon);
            if (filters.flood_level !== 'all') params.append('flood_level', filters.flood_level);
            if (filters.status !== 'all') params.append('status', filters.status);

            const res = await fetch(`/api/admin/flood-records?${params}`);
            const data = await res.json();
            if (data.success) {
                setRecords(data.data);
            }
        } catch (error) {
            console.error('Error fetching records:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        try {
            const url = '/api/admin/flood-records';
            const method = editingRecord ? 'PUT' : 'POST';
            const body = editingRecord
                ? { ...formData, id: editingRecord.id }
                : formData;

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.success) {
                setShowModal(false);
                setEditingRecord(null);
                resetForm();
                fetchRecords();
                alert(editingRecord ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ');
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving record:', error);
            alert('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleEdit = (record) => {
        setEditingRecord(record);
        setFormData({
            year: record.year,
            district: record.district,
            tambon: record.tambon,
            village: record.village || '',
            flood_level: record.flood_level,
            flood_start_date: record.flood_start_date?.split('T')[0] || '',
            flood_end_date: record.flood_end_date?.split('T')[0] || '',
            water_depth_cm: record.water_depth_cm || '',
            affected_area_sqm: record.affected_area_sqm || '',
            affected_households: record.affected_households || 0,
            affected_people: record.affected_people || 0,
            description: record.description || '',
            damage_amount: record.damage_amount || 0,
            relief_amount: record.relief_amount || 0,
            status: record.status
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        if (!confirm('ต้องการลบข้อมูลนี้หรือไม่?')) return;

        try {
            const res = await fetch(`/api/admin/flood-records?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                fetchRecords();
                alert('ลบข้อมูลสำเร็จ');
            } else {
                alert('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            alert('เกิดข้อผิดพลาดในการลบข้อมูล');
        }
    };

    const resetForm = () => {
        setFormData({
            year: new Date().getFullYear(),
            district: '',
            tambon: '',
            village: '',
            flood_level: 'ไม่มี',
            flood_start_date: '',
            flood_end_date: '',
            water_depth_cm: '',
            affected_area_sqm: '',
            affected_households: 0,
            affected_people: 0,
            description: '',
            damage_amount: 0,
            relief_amount: 0,
            status: 'รอดำเนินการ'
        });
    };

    const getFloodLevelColor = (level) => {
        const colors = {
            'ไม่มี': 'bg-gray-100 text-gray-800',
            'ต่ำ': 'bg-green-100 text-green-800',
            'ปานกลาง': 'bg-yellow-100 text-yellow-800',
            'สูง': 'bg-orange-100 text-orange-800',
            'สูงมาก': 'bg-red-100 text-red-800'
        };
        return colors[level] || 'bg-gray-100 text-gray-800';
    };

    const getStatusColor = (status) => {
        const colors = {
            'รอดำเนินการ': 'bg-yellow-100 text-yellow-800',
            'กำลังดำเนินการ': 'bg-blue-100 text-blue-800',
            'เสร็จสิ้น': 'bg-green-100 text-green-800'
        };
        return colors[status] || 'bg-gray-100 text-gray-800';
    };

    return (
        <EOCLayout>
            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                            <span className="text-4xl">💧</span>
                            บันทึกพื้นที่น้ำท่วมรายปี
                        </h1>
                        <p className="text-gray-600">
                            จัดการข้อมูลพื้นที่น้ำท่วมแต่ละหมู่บ้าน/ตำบล
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingRecord(null);
                            resetForm();
                            setShowModal(true);
                        }}
                        className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors font-medium flex items-center gap-2"
                    >
                        <span className="text-xl">➕</span>
                        เพิ่มข้อมูล
                    </button>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                    <h2 className="text-lg font-semibold text-gray-800 mb-4">🔍 ฟิลเตอร์ข้อมูล</h2>
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ปี</label>
                            <select
                                value={filters.year}
                                onChange={(e) => setFilters({ ...filters, year: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="">ทั้งหมด</option>
                                {years.map(year => (
                                    <option key={year} value={year}>{year + 543}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ</label>
                            <select
                                value={filters.district}
                                onChange={(e) => setFilters({ ...filters, district: e.target.value, tambon: 'all' })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">ทั้งหมด</option>
                                {satunDistricts.map(d => (
                                    <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ระดับน้ำท่วม</label>
                            <select
                                value={filters.flood_level}
                                onChange={(e) => setFilters({ ...filters, flood_level: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="ไม่มี">ไม่มี</option>
                                <option value="ต่ำ">ต่ำ</option>
                                <option value="ปานกลาง">ปานกลาง</option>
                                <option value="สูง">สูง</option>
                                <option value="สูงมาก">สูงมาก</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">สถานะ</label>
                            <select
                                value={filters.status}
                                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            >
                                <option value="all">ทั้งหมด</option>
                                <option value="รอดำเนินการ">รอดำเนินการ</option>
                                <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                                <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                            </select>
                        </div>
                        <div className="flex items-end">
                            <button
                                onClick={() => setFilters({
                                    year: currentYear,
                                    district: 'all',
                                    tambon: 'all',
                                    flood_level: 'all',
                                    status: 'all'
                                })}
                                className="w-full px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                            >
                                ล้างฟิลเตอร์
                            </button>
                        </div>
                    </div>
                </div>

                {/* Summary Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                    <StatCard
                        label="ทั้งหมด"
                        value={records.length}
                        icon="📊"
                        color="blue"
                    />
                    <StatCard
                        label="น้ำท่วมสูง"
                        value={records.filter(r => r.flood_level === 'สูง' || r.flood_level === 'สูงมาก').length}
                        icon="⚠️"
                        color="red"
                    />
                    <StatCard
                        label="ครัวเรือนได้รับผลกระทบ"
                        value={records.reduce((sum, r) => sum + (r.affected_households || 0), 0)}
                        icon="🏠"
                        color="orange"
                    />
                    <StatCard
                        label="กำลังดำเนินการ"
                        value={records.filter(r => r.status === 'กำลังดำเนินการ').length}
                        icon="🔄"
                        color="green"
                    />
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow-md overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="text-center">
                                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
                                <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
                            </div>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12">
                            <p className="text-gray-500 text-lg">ไม่พบข้อมูล</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ปี</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">พื้นที่</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ระดับน้ำท่วม</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ระยะเวลา</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ผลกระทบ</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {records.map((record) => (
                                        <tr key={record.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {parseInt(record.year) + 543}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div className="font-medium">{record.district}</div>
                                                <div className="text-gray-500">{record.tambon} {record.village && `(${record.village})`}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getFloodLevelColor(record.flood_level)}`}>
                                                    {record.flood_level}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {record.flood_start_date && (
                                                    <div>
                                                        {new Date(record.flood_start_date).toLocaleDateString('th-TH')}
                                                        {record.flood_end_date && ` - ${new Date(record.flood_end_date).toLocaleDateString('th-TH')}`}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div>{record.affected_households || 0} ครัวเรือน</div>
                                                <div className="text-gray-500">{record.affected_people || 0} คน</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(record.status)}`}>
                                                    {record.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                >
                                                    แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record.id)}
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
                </div>
            </div>

            {/* Modal Form */}
            {showModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="p-6">
                            <div className="flex justify-between items-center mb-6">
                                <h2 className="text-2xl font-bold text-gray-800">
                                    {editingRecord ? '✏️ แก้ไขข้อมูล' : '➕ เพิ่มข้อมูลใหม่'}
                                </h2>
                                <button
                                    onClick={() => {
                                        setShowModal(false);
                                        setEditingRecord(null);
                                        resetForm();
                                    }}
                                    className="text-gray-500 hover:text-gray-700 text-2xl"
                                >
                                    ✕
                                </button>
                            </div>

                            <form onSubmit={handleSubmit} className="space-y-6">
                                {/* ข้อมูลพื้นที่ */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4">📍 ข้อมูลพื้นที่</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ปี <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.year}
                                                onChange={(e) => setFormData({ ...formData, year: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                required
                                            >
                                                {years.map(year => (
                                                    <option key={year} value={year}>{year + 543}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                อำเภอ <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.district}
                                                onChange={(e) => setFormData({ ...formData, district: e.target.value, tambon: '', village: '' })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                required
                                            >
                                                <option value="">เลือกอำเภอ</option>
                                                {satunDistricts.map(d => (
                                                    <option key={d.name} value={d.name}>{d.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ตำบล <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.tambon}
                                                onChange={(e) => setFormData({ ...formData, tambon: e.target.value, village: '' })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                required
                                                disabled={!formData.district}
                                            >
                                                <option value="">เลือกตำบล</option>
                                                {tambonOptions.map(t => (
                                                    <option key={t.name} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                หมู่บ้าน (ถ้ามี)
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.village}
                                                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="ระบุหมู่บ้าน"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ข้อมูลน้ำท่วม */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4">💧 ข้อมูลน้ำท่วม</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ระดับน้ำท่วม <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.flood_level}
                                                onChange={(e) => setFormData({ ...formData, flood_level: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                required
                                            >
                                                <option value="ไม่มี">ไม่มี</option>
                                                <option value="ต่ำ">ต่ำ</option>
                                                <option value="ปานกลาง">ปานกลาง</option>
                                                <option value="สูง">สูง</option>
                                                <option value="สูงมาก">สูงมาก</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ความลึกน้ำ (ซม.)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.water_depth_cm}
                                                onChange={(e) => setFormData({ ...formData, water_depth_cm: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                วันที่เริ่มน้ำท่วม
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.flood_start_date}
                                                onChange={(e) => setFormData({ ...formData, flood_start_date: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                วันที่น้ำลด
                                            </label>
                                            <input
                                                type="date"
                                                value={formData.flood_end_date}
                                                onChange={(e) => setFormData({ ...formData, flood_end_date: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* ผลกระทบ */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4">👥 ผลกระทบ</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                จำนวนครัวเรือน
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.affected_households}
                                                onChange={(e) => setFormData({ ...formData, affected_households: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                จำนวนประชากร
                                            </label>
                                            <input
                                                type="number"
                                                value={formData.affected_people}
                                                onChange={(e) => setFormData({ ...formData, affected_people: parseInt(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                พื้นที่ได้รับผลกระทบ (ตร.ม.)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.affected_area_sqm}
                                                onChange={(e) => setFormData({ ...formData, affected_area_sqm: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                สถานะ <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.status}
                                                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                required
                                            >
                                                <option value="รอดำเนินการ">รอดำเนินการ</option>
                                                <option value="กำลังดำเนินการ">กำลังดำเนินการ</option>
                                                <option value="เสร็จสิ้น">เสร็จสิ้น</option>
                                            </select>
                                        </div>
                                    </div>
                                </div>

                                {/* รายละเอียด */}
                                <div>
                                    <h3 className="text-lg font-semibold text-gray-700 mb-4">📝 รายละเอียดเพิ่มเติม</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                มูลค่าความเสียหาย (บาท)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.damage_amount}
                                                onChange={(e) => setFormData({ ...formData, damage_amount: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                งบประมาณช่วยเหลือ (บาท)
                                            </label>
                                            <input
                                                type="number"
                                                step="0.01"
                                                value={formData.relief_amount}
                                                onChange={(e) => setFormData({ ...formData, relief_amount: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                รายละเอียด
                                            </label>
                                            <textarea
                                                value={formData.description}
                                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                                rows={4}
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                                placeholder="ระบุรายละเอียดเพิ่มเติม..."
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Buttons */}
                                <div className="flex justify-end gap-3 pt-4 border-t">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            setEditingRecord(null);
                                            resetForm();
                                        }}
                                        className="px-6 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
                                    >
                                        ยกเลิก
                                    </button>
                                    <button
                                        type="submit"
                                        className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
                                    >
                                        {editingRecord ? 'บันทึกการแก้ไข' : 'เพิ่มข้อมูล'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                </div>
            )}
        </EOCLayout>
    );
}

function StatCard({ label, value, icon, color }) {
    const colorClasses = {
        blue: 'bg-blue-50 text-blue-700',
        red: 'bg-red-50 text-red-700',
        orange: 'bg-orange-50 text-orange-700',
        green: 'bg-green-50 text-green-700',
    };

    return (
        <div className={`${colorClasses[color]} p-4 rounded-lg`}>
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-sm font-medium opacity-80">{label}</p>
                    <p className="text-2xl font-bold mt-1">{value.toLocaleString()}</p>
                </div>
                <div className="text-3xl">{icon}</div>
            </div>
        </div>
    );
}
