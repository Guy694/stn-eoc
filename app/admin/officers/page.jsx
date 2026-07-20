'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import EOCLayout from '@/components/layouts/EOCLayout';
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';
import AppIcon from "@/components/icons/AppIcon";

export default function OfficersManagementPage() {
    const [officers, setOfficers] = useState([]);
    const [registrations, setRegistrations] = useState([]);
    const [registrationStats, setRegistrationStats] = useState({ actionable: 0, pending: 0, verified: 0 });
    const [stats, setStats] = useState({});
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterRole, setFilterRole] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
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
        role: 'staff',
        department: '',
        requested_role: 'staff',
        is_approved: 1
    });

    const roles = [
        { value: 'admin', label: 'ผู้ดูแลระบบ', color: 'bg-red-100 text-red-700' },
        { value: 'MCATT', label: 'MCATT', color: 'bg-teal-100 text-teal-700' },
        { value: 'SAT', label: 'SAT', color: 'bg-blue-100 text-blue-700' },
        { value: 'SeRHT', label: 'SeRHT', color: 'bg-green-100 text-green-700' },
        { value: 'staff', label: 'เจ้าหน้าที่ทั่วไป', color: 'bg-gray-100 text-gray-700' }
    ];

    const registrationStatusLabels = {
        pending: 'รอ ThaiD',
        verified: 'ยืนยัน ThaiD แล้ว',
        approved: 'อนุมัติแล้ว',
        rejected: 'ปฏิเสธ'
    };

    const registrationStatusColors = {
        pending: 'bg-amber-100 text-amber-800 border-amber-200',
        verified: 'bg-blue-100 text-blue-800 border-blue-200',
        approved: 'bg-emerald-100 text-emerald-800 border-emerald-200',
        rejected: 'bg-red-100 text-red-800 border-red-200'
    };

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

    const fetchRegistrations = useCallback(async () => {
        try {
            const response = await fetch('/stn-eoc/api/admin/registrations?limit=8');
            const data = await response.json();

            if (data.success) {
                setRegistrations(data.data || []);
                setRegistrationStats(data.stats || { actionable: 0, pending: 0, verified: 0 });
            }
        } catch (error) {
            console.error('Error fetching registrations:', error);
        }
    }, []);

    useEffect(() => {
        fetchOfficers();
        fetchRegistrations();
    }, [fetchOfficers, fetchRegistrations]);

    useEffect(() => {
        setCurrentPage(1);
    }, [filterRole, searchTerm]);

    const paginatedOfficers = useMemo(
        () => paginateRows(officers, currentPage, pageSize),
        [officers, currentPage, pageSize]
    );

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
            role: officer.role,
            department: officer.department || '',
            requested_role: officer.requested_role || officer.role || 'staff',
            is_approved: officer.is_approved ?? 1
        });
        setShowModal(true);
    };

    const handleApprove = async (officer) => {
        const roleToApprove = officer.requested_role || officer.role || 'staff';

        try {
            const response = await fetch(`/stn-eoc/api/admin/officers/${officer.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    role: roleToApprove,
                    requested_role: roleToApprove,
                    is_approved: 1
                })
            });
            const data = await response.json();

            if (data.success) {
                showSuccess('อนุมัติเจ้าหน้าที่เรียบร้อยแล้ว');
                fetchOfficers();
                fetchRegistrations();
            } else {
                showError(data.error || 'ไม่สามารถอนุมัติได้');
            }
        } catch (error) {
            console.error('Error approving officer:', error);
            showError('ไม่สามารถอนุมัติได้');
        }
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
            role: 'staff',
            department: '',
            requested_role: 'staff',
            is_approved: 1
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
                        <AppIcon icon="users" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> จัดการเจ้าหน้าที่
                    </h1>
                    <p className="text-gray-600">ระบบจัดการข้อมูลเจ้าหน้าที่และสิทธิ์การเข้าถึง</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-6 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 border border-amber-200">
                        <div className="text-sm text-gray-600 mb-1">ผู้ลงทะเบียนใหม่</div>
                        <div className="text-2xl font-bold text-amber-700">
                            {registrationStats.actionable || 0}
                        </div>
                    </div>
                    {roles.map(role => (
                        <div key={role.value} className={`bg-white rounded-lg shadow p-4 border ${getRoleColor(role.value)}`}>
                            <div className="text-sm text-gray-600 mb-1">{role.label}</div>
                            <div className="text-2xl font-bold">
                                {stats[role.value] || 0}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mb-6 rounded-lg border border-amber-200 bg-white shadow">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-100 bg-amber-50 px-5 py-4">
                        <div>
                            <h2 className="text-lg font-bold text-amber-950">ผู้ลงทะเบียนใหม่</h2>
                            <p className="text-sm text-amber-800">
                                {registrationStats.pending || 0} รายรอ ThaiD • {registrationStats.verified || 0} รายยืนยันแล้วรออนุมัติ
                            </p>
                        </div>
                        <span className="rounded-full bg-amber-600 px-3 py-1 text-sm font-black text-white">
                            {registrationStats.actionable || 0}
                        </span>
                    </div>

                    {registrations.length === 0 ? (
                        <div className="px-5 py-6 text-center text-sm text-gray-500">
                            ยังไม่มีผู้ลงทะเบียนใหม่
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {registrations.map((registration) => {
                                const isPendingOfficer = registration.user_type === 'officer' && Number(registration.is_approved) !== 1;
                                const roleToApprove = registration.requested_role || registration.role || 'staff';

                                return (
                                    <div key={registration.id} className="grid gap-3 px-5 py-4 md:grid-cols-[1.5fr_1fr_auto] md:items-center">
                                        <div>
                                            <div className="font-bold text-gray-900">
                                                {`${registration.title || ''} ${registration.given_name || ''} ${registration.family_name || ''}`.trim()}
                                            </div>
                                            <div className="mt-1 text-sm text-gray-600">
                                                {registration.user_type === 'officer' ? 'เจ้าหน้าที่' : 'ประชาชน'}
                                                {registration.username ? ` • ${registration.username}` : ''}
                                                {registration.agency ? ` • ${registration.agency}` : ''}
                                            </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className={`rounded-full border px-3 py-1 text-xs font-bold ${registrationStatusColors[registration.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                {registrationStatusLabels[registration.status] || registration.status}
                                            </span>
                                            {registration.user_type === 'officer' && (
                                                <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold text-slate-700">
                                                    ขอสิทธิ์ {getRoleLabel(roleToApprove)}
                                                </span>
                                            )}
                                        </div>

                                        <div className="flex justify-start gap-2 md:justify-end">
                                            {isPendingOfficer && (
                                                <button
                                                    type="button"
                                                    onClick={() => handleApprove({
                                                        id: registration.officer_id,
                                                        requested_role: roleToApprove,
                                                        role: registration.role || 'staff'
                                                    })}
                                                    className="rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700 disabled:bg-gray-300"
                                                    disabled={!registration.officer_id}
                                                >
                                                    อนุมัติ
                                                </button>
                                            )}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Search and Filter */}
                <div className="bg-white p-4 rounded-lg shadow mb-6">
                    <div className="flex flex-wrap gap-4">
                        <input
                            type="text"
                            placeholder="ค้นหาชื่อ, username, email..."
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
                            <AppIcon icon="plus" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เพิ่มเจ้าหน้าที่
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
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">วันที่สร้าง</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {paginatedOfficers.map((officer) => (
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
                                                {officer.requested_role && officer.requested_role !== officer.role && (
                                                    <div className="mt-1 text-xs text-amber-700">
                                                        ขอสิทธิ์: {getRoleLabel(officer.requested_role)}
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {Number(officer.is_approved) === 1 ? (
                                                    <span className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">อนุมัติแล้ว</span>
                                                ) : (
                                                    <span className="rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-700">รออนุมัติ</span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {new Date(officer.created_at).toLocaleDateString('th-TH')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                {Number(officer.is_approved) !== 1 && (
                                                    <button
                                                        onClick={() => handleApprove(officer)}
                                                        className="mr-3 text-green-600 hover:text-green-800"
                                                    >
                                                        <AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> อนุมัติ
                                                    </button>
                                                )}
                                                <button
                                                    onClick={() => handleEdit(officer)}
                                                    className="text-blue-600 hover:text-blue-800 mr-3"
                                                >
                                                    <AppIcon icon="edit" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(officer)}
                                                    className="text-red-600 hover:text-red-800"
                                                >
                                                    <AppIcon icon="trash" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ลบ
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
                        totalItems={officers.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="คน"
                    />
                </div>
            </div>

            {/* Modal */}
            {showModal && (
                <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4 shadow-lg">
                    <div className="bg-white rounded-lg max-w-md w-full p-6">
                        <h2 className="text-xl font-bold mb-4 text-gray-800">
                            {editingOfficer ? "แก้ไขเจ้าหน้าที่" : "เพิ่มเจ้าหน้าที่ใหม่"}
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
