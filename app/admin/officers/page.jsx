'use client';

import { useCallback, useEffect, useState } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';

export default function OfficersManagementPage() {
    const [officers, setOfficers] = useState([]);
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [showModal, setShowModal] = useState(false);
    const [editingOfficer, setEditingOfficer] = useState(null);
    const [formData, setFormData] = useState({
        username: '',
        password: '',
        title: '',
        given_name: '',
        family_name: '',
        email: '',
        phone: '',
        role: 'staff'
    });

    const roles = [
        { value: 'admin', label: 'ผู้ดูแลระบบ', color: 'bg-red-100 text-red-700' },
        { value: 'MCATT', label: 'MCATT', color: 'bg-teal-100 text-teal-700' },
        { value: 'SAT', label: 'SAT', color: 'bg-blue-100 text-blue-700' },
        { value: 'SeRHT', label: 'SeRHT', color: 'bg-green-100 text-green-700' },
        { value: 'staff', label: 'เจ้าหน้าที่ทั่วไป', color: 'bg-gray-100 text-gray-700' }
    ];

    const fetchOfficers = useCallback(async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (filterRole) params.append('role', filterRole);
            if (searchTerm) params.append('search', searchTerm);

            const response = await fetch(`/stn-eoc/api/admin/officers?${params}`);
            const data = await response.json();

            if (data.success) {
                setOfficers(data.data);
                setStats(data.stats);
            }
        } catch (error) {
            console.error('Error fetching officers:', error);
            showError('ไม่สามารถโหลดข้อมูลได้');
        } finally {
            setLoading(false);
        }
    }, [filterRole, searchTerm]);

    useEffect(() => {
        fetchOfficers();
    }, [fetchOfficers]);

    const handleSubmit = async (e) => {
        e.preventDefault();

        try {
            const url = editingOfficer
                ? `/stn-eoc/api/admin/officers/${editingOfficer.id}`
                : '/stn-eoc/api/admin/officers';

            const method = editingOfficer ? 'PUT' : 'POST';

            const submitData = { ...formData };
            if (editingOfficer && !submitData.password) {
                delete submitData.password;
            }

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(submitData)
            });

            const data = await response.json();

            if (data.success) {
                showSuccess(editingOfficer ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มเจ้าหน้าที่สำเร็จ');
                setShowModal(false);
                resetForm();
                fetchOfficers();
            } else {
                showError(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error saving officer:', error);
            showError('ไม่สามารถบันทึกข้อมูลได้');
        }
    };

    const handleEdit = (officer) => {
        setEditingOfficer(officer);
        setFormData({
            username: officer.username,
            password: '',
            title: officer.title || '',
            given_name: officer.given_name,
            family_name: officer.family_name,
            email: officer.email || '',
            phone: officer.phone || '',
            role: officer.role
        });
        setShowModal(true);
    };

    const handleDelete = async (officer) => {
        const fullName = `${officer.title || ''} ${officer.given_name} ${officer.family_name}`.trim();
        if (!confirm(`คุณต้องการลบ ${fullName} ใช่หรือไม่?`)) {
            return;
        }

        try {
            const response = await fetch(`/stn-eoc/api/admin/officers/${officer.id}`, {
                method: 'DELETE'
            });

            const data = await response.json();

            if (data.success) {
                showSuccess('ลบข้อมูลสำเร็จ');
                fetchOfficers();
            } else {
                showError(data.error || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error deleting officer:', error);
            showError('ไม่สามารถลบข้อมูลได้');
        }
    };

    const resetForm = () => {
        setEditingOfficer(null);
        setFormData({
            username: '',
            password: '',
            title: '',
            given_name: '',
            family_name: '',
            email: '',
            phone: '',
            role: 'staff'
        });
    };

    const getRoleColor = (role) => {
        return roles.find(r => r.value === role)?.color || 'bg-gray-100 text-gray-700';
    };

    const getRoleLabel = (role) => {
        return roles.find(r => r.value === role)?.label || role;
    };

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        👥 จัดการเจ้าหน้าที่
                    </h1>
                    <p className="text-gray-600">ระบบจัดการข้อมูลเจ้าหน้าที่และสิทธิ์การเข้าถึง</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
                    {roles.map(role => (
                        <div key={role.value} className={`bg-white rounded-lg shadow p-4 border ${getRoleColor(role.value)}`}>
                            <div className="text-sm text-gray-600 mb-1">{role.label}</div>
                            <div className="text-2xl font-bold">
                                {stats[role.value] || 0}
                            </div>
                        </div>
                    ))}
                </div>

                {/* Search and Filter */}
                <div className="bg-white p-4 rounded-lg shadow mb-6">
                    <div className="flex flex-wrap gap-4">
                        <input
                            type="text"
                            placeholder="🔍 ค้นหาชื่อ, username, email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className=" text-gray-700 flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={filterRole}
                            onChange={(e) => setFilterRole(e.target.value)}
                            className=" text-gray-700 px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทุกบทบาท</option>
                            {roles.map(role => (
                                <option key={role.value} value={role.value}>
                                    {role.label}
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
                            ➕ เพิ่มเจ้าหน้าที่
                        </button>
                    </div>
                </div>

                {/* Officers Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : officers.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            ไม่พบข้อมูลเจ้าหน้าที่
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อ-นามสกุล</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Username</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">บทบาท</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่สร้าง</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {officers.map((officer) => (
                                        <tr key={officer.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {officer.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-gray-900">
                                                    {officer.title && `${officer.title} `}
                                                    {officer.given_name} {officer.family_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {officer.username}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {officer.email || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {officer.phone || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getRoleColor(officer.role)}`}>
                                                    {getRoleLabel(officer.role)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(officer.created_at).toLocaleDateString('th-TH')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleEdit(officer)}
                                                    className="text-blue-600 hover:text-blue-800 mr-3"
                                                >
                                                    ✏️ แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(officer)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    🗑️ ลบ
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
                <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4 shadow-lg">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">
                            {editingOfficer ? '✏️ แก้ไขเจ้าหน้าที่' : '➕ เพิ่มเจ้าหน้าที่ใหม่'}
                        </h2>

                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.username}
                                    onChange={(e) => setFormData({ ...formData, username: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Password {editingOfficer ? '(เว้นว่างถ้าไม่เปลี่ยน)' : '*'}
                                </label>
                                <input
                                    type="password"
                                    required={!editingOfficer}
                                    value={formData.password}
                                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    คำนำหน้า
                                </label>
                                <select
                                    value={formData.title}
                                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    <option value="">ไม่ระบุ</option>
                                    <option value="นาย">นาย</option>
                                    <option value="นาง">นาง</option>
                                    <option value="นางสาว">นางสาว</option>
                                    <option value="ดร.">ดร.</option>
                                    <option value="ผศ.ดร.">ผศ.ดร.</option>
                                    <option value="รศ.ดร.">รศ.ดร.</option>
                                    <option value="ศ.ดร.">ศ.ดร.</option>
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    ชื่อ *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.given_name}
                                    onChange={(e) => setFormData({ ...formData, given_name: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="เช่น สมชาย"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    นามสกุล *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={formData.family_name}
                                    onChange={(e) => setFormData({ ...formData, family_name: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="เช่น ใจดี"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    Email
                                </label>
                                <input
                                    type="email"
                                    value={formData.email}
                                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    เบอร์โทร
                                </label>
                                <input
                                    type="tel"
                                    value={formData.phone}
                                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    สิทธิ์การเข้าถึง *
                                </label>
                                <select
                                    required
                                    value={formData.role}
                                    onChange={(e) => setFormData({ ...formData, role: e.target.value })}
                                    className="text-gray-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {roles.map(role => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
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
