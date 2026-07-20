"use client";
import { useCallback, useEffect, Suspense, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import EOCLayout from "@/components/layouts/EOCLayout";
import PaginationControls, { paginateRows } from "@/components/common/PaginationControls";
import Swal from "sweetalert2";
import AppIcon from "@/components/icons/AppIcon";

function EOCModulesContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const eocType = searchParams.get('eoc_type');
    const { user, loading: authLoading } = useAuth();

    const [modules, setModules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingModule, setEditingModule] = useState(null);
    const [eocInfo, setEocInfo] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [pageSize, setPageSize] = useState(20);

    const [formData, setFormData] = useState({
        module_code: '',
        module_name_th: '',
        module_name_en: '',
        module_type: 'report',
        route_path: '',
        icon: "file",
        description: '',
        is_active: 1,
        sort_order: 0
    });

    const moduleTypeOptions = [
        { value: 'map', label: 'แผนที่', icon: "map" },
        { value: 'report', label: 'รายงาน', icon: "barChart" },
        { value: 'data_entry', label: 'บันทึกข้อมูล', icon: "edit" },
        { value: 'dashboard', label: 'แดชบอร์ด', icon: "barChart" },
        { value: 'analytics', label: 'วิเคราะห์ข้อมูล', icon: "trendingDown" }
    ];

    useEffect(() => {
        if (!authLoading && (!user || user.role !== 'admin')) {
            router.push("/dashboard");
        }
    }, [user, authLoading, router]);

    const loadEOCInfo = useCallback(async () => {
        if (!eocType) return;

        try {
            const response = await fetch(`/stn-eoc/api/admin/eoc-types`);
            const result = await response.json();
            if (result.success) {
                const info = result.data.find(e => e.id === eocType);
                setEocInfo(info);
            }
        } catch (error) {
            console.error("Error loading EOC info:", error);
        }
    }, [eocType]);

    const loadModules = useCallback(async () => {
        if (!eocType) return;

        try {
            setLoading(true);
            const response = await fetch(`/stn-eoc/api/admin/eoc-modules?eoc_type=${eocType}`);
            const result = await response.json();

            if (result.success && Array.isArray(result.data)) {
                setModules(result.data);
            } else {
                console.error("Failed to load modules or data is not an array");
                setModules([]);
            }
        } catch (error) {
            console.error("Error loading modules:", error);
            setModules([]);
        } finally {
            setLoading(false);
        }
    }, [eocType]);

    useEffect(() => {
        if (eocType) {
            loadModules();
            loadEOCInfo();
        }
    }, [eocType, loadEOCInfo, loadModules]);

    useEffect(() => {
        setCurrentPage(1);
    }, [eocType]);

    const paginatedModules = useMemo(
        () => paginateRows(modules, currentPage, pageSize),
        [modules, currentPage, pageSize]
    );

    const handleOpenAddModal = () => {
        setEditingModule(null);
        setFormData({
            module_code: '',
            module_name_th: '',
            module_name_en: '',
            module_type: 'report',
            route_path: '',
            icon: "file",
            description: '',
            is_active: 1,
            sort_order: (Array.isArray(modules) ? modules.length : 0) + 1
        });
        setShowModal(true);
    };

    const handleOpenEditModal = (module) => {
        setEditingModule(module);
        setFormData({
            module_code: module.module_code,
            module_name_th: module.module_name_th,
            module_name_en: module.module_name_en,
            module_type: module.module_type,
            route_path: module.route_path,
            icon: module.icon,
            description: module.description || '',
            is_active: module.is_active,
            sort_order: module.sort_order
        });
        setShowModal(true);
    };

    const handleSaveModule = async () => {
        try {
            if (!formData.module_code || !formData.module_name_th || !formData.module_name_en || !formData.route_path) {
                await Swal.fire('ข้อผิดพลาด', 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'error');
                return;
            }

            const url = editingModule
                ? '/stn-eoc/api/admin/eoc-modules'
                : '/stn-eoc/api/admin/eoc-modules';

            const method = editingModule ? 'PUT' : 'POST';

            const payload = editingModule
                ? { id: editingModule.id, ...formData }
                : { eoc_type: eocType, ...formData };

            const response = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (result.success) {
                await Swal.fire('สำเร็จ', result.message, 'success');
                setShowModal(false);
                loadModules();
            } else {
                await Swal.fire('ข้อผิดพลาด', result.error, 'error');
            }
        } catch (error) {
            console.error("Error saving module:", error);
            await Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', 'error');
        }
    };

    const handleDeleteModule = async (moduleId) => {
        try {
            const confirm = await Swal.fire({
                title: 'ยืนยันการลบ',
                text: 'คุณต้องการลบ Module นี้หรือไม่?',
                icon: 'warning',
                showCancelButton: true,
                confirmButtonColor: '#d33',
                cancelButtonColor: '#3085d6',
                confirmButtonText: 'ลบ',
                cancelButtonText: 'ยกเลิก'
            });

            if (!confirm.isConfirmed) return;

            const response = await fetch(`/stn-eoc/api/admin/eoc-modules?id=${moduleId}`, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                await Swal.fire('สำเร็จ', 'ลบ Module สำเร็จ', 'success');
                loadModules();
            } else {
                await Swal.fire('ข้อผิดพลาด', result.error, 'error');
            }
        } catch (error) {
            console.error("Error deleting module:", error);
            await Swal.fire('ข้อผิดพลาด', 'เกิดข้อผิดพลาดในการลบข้อมูล', 'error');
        }
    };

    const getModuleTypeLabel = (type) => {
        const option = moduleTypeOptions.find(opt => opt.value === type);
        return option ? option.label : type;
    };

    const getModuleTypeIcon = (type) => {
        const option = moduleTypeOptions.find(opt => opt.value === type);
        return option ? option.icon : "file";
    };

    if (authLoading || loading) {
        return (
            <EOCLayout>
                <div className="flex items-center justify-center min-h-screen">
                    <div className="text-center">
                        <div className="animate-spin rounded-full h-16 w-16 border-b border-blue-600 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลด...</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    if (!user || user.role !== 'admin') return null;

    if (!eocType) {
        return (
            <EOCLayout>
                <div className="text-center py-12">
                    <p className="text-gray-600">กรุณาเลือก EOC Type</p>
                </div>
            </EOCLayout>
        );
    }

    return (
        <EOCLayout>
            <div className="mx-auto max-w-6xl">
                {/* Header */}
                <div className="mb-6">
                    <button
                        onClick={() => router.push('/admin/eoc-management')}
                        className="text-blue-600 hover:text-blue-800 mb-4 flex items-center gap-2"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
                        </svg>
                        กลับไปหน้าจัดการ EOC
                    </button>

                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                            <h1 className="text-2xl font-bold text-gray-800 mb-2 sm:text-3xl">
                                จัดการเมนู Sidebar - EOC {eocInfo?.name_th || eocType}
                            </h1>
                            <p className="text-gray-600">กำหนดเมนูที่จะแสดงใน Sidebar สำหรับ EOC นี้</p>
                        </div>
                        <button
                            onClick={handleOpenAddModal}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            เพิ่มเมนู
                        </button>
                    </div>
                </div>

                {/* Modules List */}
                <div className="bg-white rounded-lg shadow">
                    <div className="overflow-x-auto">
                        <table className="min-w-[920px] divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ไอคอน</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ชื่อเมนู</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ประเภท</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">เส้นทาง</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">สถานะ</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ลำดับ</th>
                                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">จัดการ</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {!Array.isArray(modules) || modules.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" className="px-6 py-12 text-center text-gray-500">
                                            ยังไม่มีเมนูสำหรับ EOC นี้
                                        </td>
                                    </tr>
                                ) : (
                                    paginatedModules.map((module) => (
                                        <tr key={module.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap"><AppIcon icon={module.icon} className="h-7 w-7" /></td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <div className="text-sm font-medium text-gray-900">{module.module_name_th}</div>
                                                <div className="text-sm text-gray-500">{module.module_name_en}</div>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                                                    <AppIcon icon={getModuleTypeIcon(module.module_type)} className="inline-block h-4 w-4" /> {getModuleTypeLabel(module.module_type)}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {module.route_path}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                {module.is_active ? (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                                                        เปิดใช้งาน
                                                    </span>
                                                ) : (
                                                    <span className="px-2 inline-flex text-xs leading-5 font-semibold rounded-full bg-gray-100 text-gray-800">
                                                        ปิดใช้งาน
                                                    </span>
                                                )}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                                {module.sort_order}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                                                <button
                                                    onClick={() => handleOpenEditModal(module)}
                                                    className="text-blue-600 hover:text-blue-900 mr-3"
                                                >
                                                    แก้ไข
                                                </button>
                                                <button
                                                    onClick={() => handleDeleteModule(module.id)}
                                                    className="text-red-600 hover:text-red-900"
                                                >
                                                    ลบ
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                    <PaginationControls
                        page={currentPage}
                        pageSize={pageSize}
                        totalItems={modules.length}
                        onPageChange={setCurrentPage}
                        onPageSizeChange={setPageSize}
                    />
                </div>

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg p-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto sm:p-6">
                            <h2 className="text-2xl font-bold mb-4">
                                {editingModule ? 'แก้ไขเมนู' : 'เพิ่มเมนูใหม่'}
                            </h2>

                            <div className="space-y-4">
                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            รหัสเมนู <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.module_code}
                                            onChange={(e) => setFormData({ ...formData, module_code: e.target.value })}
                                            disabled={!!editingModule}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="เช่น announcements"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ประเภทเมนู <span className="text-red-500">*</span>
                                        </label>
                                        <select
                                            value={formData.module_type}
                                            onChange={(e) => setFormData({ ...formData, module_type: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {moduleTypeOptions.map(opt => (
                                                <option key={opt.value} value={opt.value}>
                                                    <AppIcon icon={opt.icon} className="inline-block h-5 w-5" /> {opt.label}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ชื่อเมนู (ไทย) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.module_name_th}
                                            onChange={(e) => setFormData({ ...formData, module_name_th: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="เช่น ประชาสัมพันธ์"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ชื่อเมนู (อังกฤษ) <span className="text-red-500">*</span>
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.module_name_en}
                                            onChange={(e) => setFormData({ ...formData, module_name_en: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="เช่น Announcements"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        เส้นทาง URL <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.route_path}
                                        onChange={(e) => setFormData({ ...formData, route_path: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="/admin/announcements"
                                    />
                                </div>

                                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ไอคอน
                                        </label>
                                        <input
                                            type="text"
                                            value={formData.icon}
                                            onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="megaphone"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ลำดับ
                                        </label>
                                        <input
                                            type="number"
                                            value={formData.sort_order}
                                            onChange={(e) => setFormData({ ...formData, sort_order: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            สถานะ
                                        </label>
                                        <select
                                            value={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
                                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={1}>เปิดใช้งาน</option>
                                            <option value={0}>ปิดใช้งาน</option>
                                        </select>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        คำอธิบาย
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="คำอธิบายเพิ่มเติม..."
                                    />
                                </div>
                            </div>

                            <div className="flex flex-col gap-2 mt-6 sm:flex-row">
                                <button
                                    onClick={handleSaveModule}
                                    className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                >
                                    บันทึก
                                </button>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="flex-1 px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </EOCLayout>
    );
}

export default function EOCModulesManagement() {
    return (
        <Suspense fallback={
            <EOCLayout>
                <div className="flex justify-center items-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b border-green-500"></div>
                </div>
            </EOCLayout>
        }>
            <EOCModulesContent />
        </Suspense>
    );
}
