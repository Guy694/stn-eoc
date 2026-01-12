"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/context/AuthContext";
import { useEOC } from "@/context/EOCContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import Swal from "sweetalert2";

export default function EOCManagementPage() {
    const router = useRouter();
    const { user, loading: authLoading } = useAuth();
    const { eocStatus, toggleEOC, getEOCDisplayName, refreshStatus } = useEOC();
    const [updating, setUpdating] = useState({});
    const [descriptions, setDescriptions] = useState({});
    const [message, setMessage] = useState({ type: '', text: '' });
    const [eocTypes, setEocTypes] = useState([]);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingType, setEditingType] = useState(null);
    const [formData, setFormData] = useState({
        id: '',
        name_th: '',
        name_en: '',
        icon: '⚠️',
        color_primary: 'gray',
        color_gradient: 'from-gray-500 to-gray-600',
        description: ''
    });

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'admin')) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    useEffect(() => {
        loadEOCTypes();
    }, []);

    // โหลด EOC Types จาก database
    const loadEOCTypes = async () => {
        try {
            const response = await fetch('/api/admin/eoc-types');
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                setEocTypes(result.data.map(item => item.id));
            } else {
                // fallback ถ้าไม่มีข้อมูลใน database
                setEocTypes(['flood', 'drought', 'tsunami', 'earthquake', 'disease']);
            }
        } catch (error) {
            console.error("Error loading EOC types:", error);
            setEocTypes(['flood', 'drought', 'tsunami', 'earthquake', 'disease']);
        }
    };

    const handleToggle = async (eocType) => {
        setUpdating(prev => ({ ...prev, [eocType]: true }));
        setMessage({ type: '', text: '' });

        const currentStatus = eocStatus[eocType]?.is_active || false;
        const newStatus = !currentStatus;

        try {
            const result = await toggleEOC(
                eocType,
                newStatus,
                descriptions[eocType] || ''
            );

            if (result.success) {
                setMessage({ type: 'success', text: result.message });
                setDescriptions(prev => ({ ...prev, [eocType]: '' }));
                await refreshStatus();
            } else {
                setMessage({ type: 'error', text: result.message });
            }
        } catch (error) {
            setMessage({ type: 'error', text: error.message });
        } finally {
            setUpdating(prev => ({ ...prev, [eocType]: false }));
        }
    };

    // เพิ่ม EOC Type ใหม่
    const handleAddEOCType = async () => {
        try {
            if (!formData.id || !formData.name_th || !formData.name_en) {
                await Swal.fire('ข้อผิดพลาด', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
                return;
            }

            const response = await fetch('/api/admin/eoc-types', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                await Swal.fire('สำเร็จ', 'เพิ่ม EOC Type สำเร็จ', 'success');
                setShowAddModal(false);
                setFormData({
                    id: '', name_th: '', name_en: '', icon: '⚠️',
                    color_primary: 'gray', color_gradient: 'from-gray-500 to-gray-600',
                    description: ''
                });
                await loadEOCTypes();
                await refreshStatus();
            } else {
                await Swal.fire('ข้อผิดพลาด', result.error, 'error');
            }
        } catch (error) {
            console.error('Error adding EOC type:', error);
            await Swal.fire('ข้อผิดพลาด', error.message, 'error');
        }
    };

    // แก้ไข EOC Type
    const handleEditEOCType = async () => {
        try {
            const response = await fetch('/api/admin/eoc-types', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(formData)
            });

            const result = await response.json();

            if (result.success) {
                await Swal.fire('สำเร็จ', 'แก้ไข EOC Type สำเร็จ', 'success');
                setShowEditModal(false);
                setEditingType(null);
                await loadEOCTypes();
                await refreshStatus();
            } else {
                await Swal.fire('ข้อผิดพลาด', result.error, 'error');
            }
        } catch (error) {
            console.error('Error editing EOC type:', error);
            await Swal.fire('ข้อผิดพลาด', error.message, 'error');
        }
    };

    // ลบ EOC Type
    const handleDeleteEOCType = async (id) => {
        const confirm = await Swal.fire({
            title: 'ยืนยันการลบ',
            text: `คุณต้องการลบ EOC Type "${id}" ใช่หรือไม่?`,
            icon: 'warning',
            showCancelButton: true,
            confirmButtonColor: '#d33',
            cancelButtonColor: '#3085d6',
            confirmButtonText: 'ลบ',
            cancelButtonText: 'ยกเลิก'
        });

        if (!confirm.isConfirmed) return;

        try {
            const response = await fetch(`/api/admin/eoc-types?id=${id}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                await Swal.fire('สำเร็จ', 'ลบ EOC Type สำเร็จ', 'success');
                await loadEOCTypes();
                await refreshStatus();
            } else {
                await Swal.fire('ข้อผิดพลาด', result.error, 'error');
            }
        } catch (error) {
            console.error('Error deleting EOC type:', error);
            await Swal.fire('ข้อผิดพลาด', error.message, 'error');
        }
    };

    // เปิด modal แก้ไข
    const openEditModal = async (typeId) => {
        try {
            const response = await fetch('/api/admin/eoc-types');
            const result = await response.json();

            if (result.success) {
                const typeData = result.data.find(item => item.id === typeId);
                if (typeData) {
                    setFormData({
                        id: typeData.id,
                        name_th: typeData.name_th,
                        name_en: typeData.name_en,
                        icon: typeData.icon,
                        color_primary: typeData.color_primary,
                        color_gradient: typeData.color_gradient,
                        description: typeData.description || ''
                    });
                    setEditingType(typeId);
                    setShowEditModal(true);
                }
            }
        } catch (error) {
            console.error('Error loading type data:', error);
        }
    };

    const getStatusBadge = (isActive) => {
        if (isActive) {
            return (
                <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-green-100 text-green-800">
                    <span className="w-2 h-2 bg-green-500 rounded-full mr-2"></span>
                    เปิดใช้งาน
                </span>
            );
        }
        return (
            <span className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-gray-100 text-gray-800">
                <span className="w-2 h-2 bg-gray-500 rounded-full mr-2"></span>
                ปิดใช้งาน
            </span>
        );
    };

    if (authLoading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-16 w-16 border-b-4 border-green-600 mx-auto mb-4"></div>
                    <p className="text-gray-600">กำลังโหลด...</p>
                </div>
            </div>
        );
    }

    if (!user || user.role !== 'admin') {
        return null;
    }

    return (
        <EOCLayout>
            <div className="max-w-6xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2">จัดการศูนย์ EOC</h1>
                        <p className="text-gray-600">เปิด/ปิดการทำงานของศูนย์ EOC แต่ละประเภท และจัดการประเภท EOC</p>
                    </div>
                    <div className="flex gap-2">
                        <button
                            onClick={() => setShowAddModal(true)}
                            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่ม EOC Type
                        </button>
                        <Link
                            href="/admin/eoc-sessions"
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            ดูประวัติ EOC
                        </Link>
                    </div>
                </div>

                {/* Message */}
                {message.text && (
                    <div className={`mb-6 p-4 rounded-lg ${message.type === 'success'
                        ? 'bg-green-50 border border-green-200 text-green-700'
                        : 'bg-red-50 border border-red-200 text-red-700'
                        }`}>
                        {message.text}
                    </div>
                )}

                {/* EOC Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {eocTypes.map(eocType => {
                        const status = eocStatus[eocType] || {};
                        const isActive = status.is_active || false;

                        return (
                            <div key={eocType} className="bg-white rounded-lg shadow-md p-6 border border-gray-200">
                                <div className="flex items-center justify-between mb-4">
                                    <div className="flex-1">
                                        <h3 className="text-xl font-semibold text-gray-800">
                                            EOC {getEOCDisplayName(eocType)}
                                        </h3>
                                        <p className="text-sm text-gray-500 mt-1">
                                            {status.description || 'ไม่มีรายละเอียด'}
                                        </p>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {getStatusBadge(isActive)}
                                        <div className="flex gap-1">
                                            <button
                                                onClick={() => router.push(`/admin/eoc-modules?eoc_type=${eocType}`)}
                                                className="p-2 text-purple-600 hover:bg-purple-50 rounded transition"
                                                title="จัดการเมนู Sidebar"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => openEditModal(eocType)}
                                                className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
                                                title="แก้ไข"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                                                </svg>
                                            </button>
                                            <button
                                                onClick={() => handleDeleteEOCType(eocType)}
                                                className="p-2 text-red-600 hover:bg-red-50 rounded transition"
                                                title="ลบ"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                                                </svg>
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                {/* Details */}
                                {isActive && status.activated_at && (
                                    <div className="bg-green-50 rounded-md p-3 mb-4 text-sm">
                                        <p className="text-gray-700">
                                            <span className="font-medium">เปิดเมื่อ:</span>{' '}
                                            {new Date(status.activated_at).toLocaleString('th-TH')}
                                        </p>
                                        {status.activated_by_name && (
                                            <p className="text-gray-700 mt-1">
                                                <span className="font-medium">โดย:</span>{' '}
                                                {status.activated_by_name}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {!isActive && status.deactivated_at && (
                                    <div className="bg-gray-50 rounded-md p-3 mb-4 text-sm">
                                        <p className="text-gray-700">
                                            <span className="font-medium">ปิดเมื่อ:</span>{' '}
                                            {new Date(status.deactivated_at).toLocaleString('th-TH')}
                                        </p>
                                        {status.deactivated_by_name && (
                                            <p className="text-gray-700 mt-1">
                                                <span className="font-medium">โดย:</span>{' '}
                                                {status.deactivated_by_name}
                                            </p>
                                        )}
                                    </div>
                                )}

                                {/* Description Input */}
                                <div className="mb-4">
                                    <label className="block text-sm font-medium text-gray-700 mb-2">
                                        รายละเอียด/เหตุผล
                                    </label>
                                    <textarea
                                        value={descriptions[eocType] || ''}
                                        onChange={(e) => setDescriptions(prev => ({
                                            ...prev,
                                            [eocType]: e.target.value
                                        }))}
                                        placeholder={`ระบุรายละเอียดหรือเหตุผลในการ${isActive ? 'ปิด' : 'เปิด'} EOC`}
                                        rows={2}
                                        className=" text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                    />
                                </div>

                                {/* Action Buttons */}
                                <div className="space-y-2">
                                    {/* จัดการทีมงาน (แสดงเมื่อ active) */}
                                    {isActive && status.session_id && (
                                        <Link
                                            href={`/admin/eoc-sessions/${status.session_id}/teams`}
                                            className="w-full block py-2 px-4 text-center rounded-md font-medium bg-blue-600 text-white hover:bg-blue-700 transition-colors"
                                        >
                                            👥 จัดการทีมงาน
                                        </Link>
                                    )}

                                    {/* Toggle Button */}
                                    <button
                                        onClick={() => handleToggle(eocType)}
                                        disabled={updating[eocType]}
                                        className={`w-full py-2 px-4 rounded-md font-medium transition-colors ${isActive
                                            ? 'bg-red-600 text-white hover:bg-red-700'
                                            : 'bg-green-600 text-white hover:bg-green-700'
                                            } disabled:opacity-50 disabled:cursor-not-allowed`}
                                    >
                                        {updating[eocType] ? (
                                            <span className="flex items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                                กำลังดำเนินการ...
                                            </span>
                                        ) : (
                                            isActive ? '🔴 ปิด EOC' : '🟢 เปิด EOC'
                                        )}
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Active EOCs Summary */}
                <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-blue-900 mb-3">
                        📊 สรุป EOC ที่เปิดใช้งาน
                    </h3>
                    <div className="space-y-2">
                        {eocTypes.filter(type => eocStatus[type]?.is_active).length > 0 ? (
                            eocTypes
                                .filter(type => eocStatus[type]?.is_active)
                                .map(type => (
                                    <div key={type} className="flex items-center gap-2 text-blue-800">
                                        <span className="w-2 h-2 bg-green-500 rounded-full"></span>
                                        <span className="font-medium">EOC {getEOCDisplayName(type)}</span>
                                        <span className="text-sm text-blue-600">
                                            (เปิดเมื่อ: {new Date(eocStatus[type].activated_at).toLocaleString('th-TH')})
                                        </span>
                                    </div>
                                ))
                        ) : (
                            <p className="text-blue-700">ไม่มี EOC ที่เปิดใช้งานในขณะนี้</p>
                        )}
                    </div>
                </div>

                {/* Modal เพิ่ม EOC Type */}
                {showAddModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-white/30 bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">เพิ่มรายการ EOC ใหม่</h2>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                รหัส EOC Type * <span className="text-xs text-gray-500">(ภาษาอังกฤษ เช่น flood, landslide)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.id}
                                                onChange={(e) => setFormData({ ...formData, id: e.target.value.toLowerCase() })}
                                                placeholder="flood"
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ไอคอน
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.icon}
                                                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                                placeholder="⚠️"
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ชื่อภาษาไทย *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name_th}
                                                onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
                                                placeholder="น้ำท่วม"
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ชื่อภาษาอังกฤษ *
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name_en}
                                                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                                placeholder="Flood"
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                สีหลัก
                                            </label>
                                            <select
                                                value={formData.color_primary}
                                                onChange={(e) => setFormData({ ...formData, color_primary: e.target.value })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            >
                                                <option value="blue">น้ำเงิน</option>
                                                <option value="red">แดง</option>
                                                <option value="orange">ส้ม</option>
                                                <option value="green">เขียว</option>
                                                <option value="cyan">ฟ้า</option>
                                                <option value="purple">ม่วง</option>
                                                <option value="yellow">เหลือง</option>
                                                <option value="gray">เทา</option>
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Gradient <span className="text-xs text-gray-500">(Tailwind classes)</span>
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.color_gradient}
                                                onChange={(e) => setFormData({ ...formData, color_gradient: e.target.value })}
                                                placeholder="from-blue-500 to-blue-600"
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            รายละเอียด
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            placeholder="รายละเอียดเกี่ยวกับประเภท EOC นี้"
                                            rows={3}
                                            className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-6">
                                    <button
                                        onClick={handleAddEOCType}
                                        className="flex-1 bg-green-600 text-white py-2 px-4 rounded-md hover:bg-green-700 transition"
                                    >
                                        เพิ่ม
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowAddModal(false);
                                            setFormData({
                                                id: '', name_th: '', name_en: '', icon: '⚠️',
                                                color_primary: 'gray', color_gradient: 'from-gray-500 to-gray-600',
                                                description: ''
                                            });
                                        }}
                                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition"
                                    >
                                        ยกเลิก
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Modal แก้ไข EOC Type */}
                {showEditModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-2xl font-bold text-gray-800 mb-4">แก้ไข EOC Type: {formData.id}</h2>

                                <div className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ไอคอน
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.icon}
                                                onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                สีหลัก
                                            </label>
                                            <select
                                                value={formData.color_primary}
                                                onChange={(e) => setFormData({ ...formData, color_primary: e.target.value })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            >
                                                <option value="blue">น้ำเงิน</option>
                                                <option value="red">แดง</option>
                                                <option value="orange">ส้ม</option>
                                                <option value="green">เขียว</option>
                                                <option value="cyan">ฟ้า</option>
                                                <option value="purple">ม่วง</option>
                                                <option value="yellow">เหลือง</option>
                                                <option value="gray">เทา</option>
                                            </select>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ชื่อภาษาไทย
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name_th}
                                                onChange={(e) => setFormData({ ...formData, name_th: e.target.value })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                ชื่อภาษาอังกฤษ
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.name_en}
                                                onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                                className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Gradient
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.color_gradient}
                                            onChange={(e) => setFormData({ ...formData, color_gradient: e.target.value })}
                                            className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            รายละเอียด
                                        </label>
                                        <textarea
                                            value={formData.description}
                                            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                            rows={3}
                                            className="text-gray-700 w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>
                                </div>

                                <div className="flex gap-2 mt-6">
                                    <button
                                        onClick={handleEditEOCType}
                                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 transition"
                                    >
                                        บันทึก
                                    </button>
                                    <button
                                        onClick={() => {
                                            setShowEditModal(false);
                                            setEditingType(null);
                                        }}
                                        className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-md hover:bg-gray-400 transition"
                                    >
                                        ยกเลิก
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}
