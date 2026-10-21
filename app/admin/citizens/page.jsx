'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHero } from "@/components/common/ThemePanels";
import { AppDialogFrame } from "@/components/ui/app-dialog";
import EOCLayout from '@/components/layouts/EOCLayout';
import { showError, showSuccess, showWarning } from '@/lib/sweetAlert';
import PaginationControls, { paginateRows } from '@/components/common/PaginationControls';
import AppIcon from "@/components/icons/AppIcon";
import { MetricCard, MetricGrid } from "@/components/common/MetricCards";

export default function CitizensManagementPage() {
    const [citizens, setCitizens] = useState([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);
    const [showPromoteModal, setShowPromoteModal] = useState(false);
    const [selectedCitizen, setSelectedCitizen] = useState(null);
    const [promoteFormData, setPromoteFormData] = useState({
        username: '',
        role: 'staff',
        position: '',
        department: ''
    });

    const roles = [
        { value: 'admin', label: 'ผู้ดูแลระบบ' },
        { value: 'MCATT', label: 'MCATT' },
        { value: 'SAT', label: 'SAT' },
        { value: 'SeRHT', label: 'SeRHT' },
        { value: 'staff', label: 'เจ้าหน้าที่ทั่วไป' }
    ];

    const fetchCitizens = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/stn-eoc/api/admin/citizens');
            const data = await response.json();

            if (data.success) {
                // Filter by search term if exists
                let filtered = data.citizens;
                if (searchTerm) {
                    const term = searchTerm.toLowerCase();
                    filtered = filtered.filter(citizen =>
                        citizen.given_name?.toLowerCase().includes(term) ||
                        citizen.family_name?.toLowerCase().includes(term) ||
                        `${citizen.given_name} ${citizen.family_name}`.toLowerCase().includes(term)
                    );
                }
                setCitizens(filtered);
            }
        } catch (error) {
            console.error('Error fetching citizens:', error);
            showError('ไม่สามารถโหลดข้อมูลได้');
        } finally {
            setLoading(false);
        }
    }, [searchTerm]);

    useEffect(() => {
        fetchCitizens();
    }, [fetchCitizens]);

    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm]);

    const paginatedCitizens = useMemo(
        () => paginateRows(citizens, currentPage, pageSize),
        [citizens, currentPage, pageSize]
    );

    const handlePromoteClick = (citizen) => {
        setSelectedCitizen(citizen);
        // Auto-generate username from name
        const suggestedUsername = `${citizen.given_name}.${citizen.family_name}`.toLowerCase().replace(/\s+/g, '');
        setPromoteFormData({
            username: suggestedUsername,
            role: 'staff',
            position: '',
            department: ''
        });
        setShowPromoteModal(true);
    };

    const handlePromoteSubmit = async (e) => {
        e.preventDefault();

        if (!selectedCitizen) return;

        try {
            const response = await fetch('/stn-eoc/api/admin/citizens/promote', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    citizen_id: selectedCitizen.id,
                    username: promoteFormData.username,
                    role: promoteFormData.role,
                    position: promoteFormData.position,
                    department: promoteFormData.department
                })
            });

            const data = await response.json();

            if (data.success) {
                showSuccess(
                    `เลื่อนตำแหน่งสำเร็จ!\n\nUsername: ${promoteFormData.username}\nรหัสผ่านชั่วคราว: ${data.temporary_password}\n\nกรุณาบันทึกรหัสผ่านนี้เพื่อส่งให้ผู้ใช้`
                );
                setShowPromoteModal(false);
                resetPromoteForm();
                fetchCitizens();
            } else {
                showError(data.message || 'เกิดข้อผิดพลาด');
            }
        } catch (error) {
            console.error('Error promoting citizen:', error);
            showError('ไม่สามารถเลื่อนตำแหน่งได้');
        }
    };

    const resetPromoteForm = () => {
        setSelectedCitizen(null);
        setPromoteFormData({
            username: '',
            role: 'staff',
            position: '',
            department: ''
        });
    };

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <PageHero title="จัดการผู้ใช้ประชาชน" subtitle="รายชื่อประชาชนที่ลงทะเบียนผ่าน ThaiD และสามารถเลื่อนตำแหน่งเป็นเจ้าหน้าที่" className="mb-6" />

                {/* Stats Card */}
                <MetricGrid className="mb-6" cols="grid-cols-1 sm:grid-cols-3">
                    <MetricCard icon="users" label="ประชาชนที่ลงทะเบียน" value={citizens.length.toLocaleString("th-TH")} unit="คน" tone="blue" />
                </MetricGrid>

                {/* Search */}
                <div className="border border-slate-200 bg-white p-4 rounded-2xl mb-6">
                    <input
                        type="text"
                        placeholder="ค้นหาชื่อ-นามสกุล..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="text-slate-700 w-full px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                </div>

                {/* Citizens Table */}
                <div className="border border-slate-200 bg-white rounded-2xl overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-slate-500">
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : citizens.length === 0 ? (
                        <div className="p-8 text-center text-slate-500">
                            {searchTerm ? 'ไม่พบข้อมูลตามที่ค้นหา' : 'ยังไม่มีประชาชนลงทะเบียน'}
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-slate-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">ชื่อ-นามสกุล</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">วันเกิด</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">เพศ</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">เบอร์โทร</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-slate-500 uppercase">วันที่ลงทะเบียน</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-slate-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {paginatedCitizens.map((citizen) => (
                                        <tr key={citizen.id} className="hover:bg-slate-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-900">
                                                {citizen.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="font-medium text-slate-900">
                                                    {citizen.title && `${citizen.title} `}
                                                    {citizen.given_name} {citizen.family_name}
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {citizen.birthdate ? new Date(citizen.birthdate).toLocaleDateString('th-TH') : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {citizen.gender === 'male' ? 'ชาย' : citizen.gender === 'female' ? 'หญิง' : '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {citizen.phone || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                                                {new Date(citizen.created_at).toLocaleDateString('th-TH')}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handlePromoteClick(citizen)}
                                                    className="bg-[#0b4c86] text-white px-4 py-2 rounded-lg hover:bg-[#083865] transition-all shadow-md hover:shadow-lg"
                                                >
                                                    <AppIcon icon="arrowUp" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> เลื่อนเป็นเจ้าหน้าที่
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
                        totalItems={citizens.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                        itemLabel="คน"
                    />
                </div>
            </div>

            {/* Promote Modal */}
            {showPromoteModal && selectedCitizen && (
                <AppDialogFrame open onOpenChange={(open) => { if (!open) { setShowPromoteModal(false); resetPromoteForm(); } }}>
                    <div className="bg-white rounded-2xl font-[family-name:var(--font-kanit)] max-w-md w-full p-6 shadow-2xl">
                        <h2 className="mb-4 text-lg font-black text-slate-900 sm:text-xl">
                            เลื่อนตำแหน่งเป็นเจ้าหน้าที่
                        </h2>

                        <div className="rounded-2xl border border-blue-200 bg-blue-50 p-4 mb-4">
                            <div className="text-sm text-slate-600 mb-1">ประชาชน:</div>
                            <div className="font-bold text-slate-800">
                                {selectedCitizen.title} {selectedCitizen.given_name} {selectedCitizen.family_name}
                            </div>
                        </div>

                        <form onSubmit={handlePromoteSubmit} className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Username *
                                </label>
                                <input
                                    type="text"
                                    required
                                    value={promoteFormData.username}
                                    onChange={(e) => setPromoteFormData({ ...promoteFormData, username: e.target.value })}
                                    className="text-slate-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="เช่น somchai.jaidee"
                                />
                                <p className="text-xs text-slate-500 mt-1">
                                    ระบบจะสร้างรหัสผ่านชั่วคราวให้อัตโนมัติ
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    บทบาท *
                                </label>
                                <select
                                    required
                                    value={promoteFormData.role}
                                    onChange={(e) => setPromoteFormData({ ...promoteFormData, role: e.target.value })}
                                    className="text-slate-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                    {roles.map(role => (
                                        <option key={role.value} value={role.value}>
                                            {role.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    ตำแหน่ง
                                </label>
                                <input
                                    type="text"
                                    value={promoteFormData.position}
                                    onChange={(e) => setPromoteFormData({ ...promoteFormData, position: e.target.value })}
                                    className="text-slate-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="เช่น นักวิเคราะห์"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    แผนก
                                </label>
                                <input
                                    type="text"
                                    value={promoteFormData.department}
                                    onChange={(e) => setPromoteFormData({ ...promoteFormData, department: e.target.value })}
                                    className="text-slate-800 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    placeholder="เช่น กองป้องกันและบรรเทาสาธารณภัย"
                                />
                            </div>

                            <div className="flex gap-3 pt-4">
                                <button
                                    type="submit"
                                    className="flex-1 bg-[#0b4c86] text-white py-2 rounded-lg hover:bg-[#083865] transition-colors font-semibold"
                                >
                                    <AppIcon icon="checkCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ยืนยันเลื่อนตำแหน่ง
                                </button>
                                <button
                                    type="button"
                                    onClick={() => {
                                        setShowPromoteModal(false);
                                        resetPromoteForm();
                                    }}
                                    className="flex-1 bg-slate-600 text-white py-2 rounded-lg hover:bg-slate-700 transition-colors"
                                >
                                    <AppIcon icon="xCircle" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" /> ยกเลิก
                                </button>
                            </div>
                        </form>
                    </div>
                </AppDialogFrame>
            )}
        </EOCLayout>
    );
}
