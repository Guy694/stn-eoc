"use client";
import React, { useCallback, useEffect, Suspense, useState } from 'react';
import Link from 'next/link';
import dynamic from 'next/dynamic';
import { useSearchParams } from 'next/navigation';
import { showWarning, showSuccess, showError, showConfirm } from '@/lib/sweetAlert';
import EOCLayout from '@/components/layouts/EOCLayout';
import ExportExcelButton from '@/components/ExportExcelButton';

// Dynamic import for Map component
const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-96 bg-gray-100 flex items-center justify-center">กำลังโหลดแผนที่...</div>
});

const EOC_TYPES = [
    { value: 'flood', label: '💧 น้ำท่วม', color: 'blue' },
    { value: 'drought', label: '🌵 ภัยแล้ง', color: 'yellow' },
    { value: 'tsunami', label: '🌊 สึนามิ', color: 'cyan' },
    { value: 'earthquake', label: '🏚️ แผ่นดินไหว', color: 'orange' },
    { value: 'disease', label: '🦠 โรคระบาด', color: 'red' }
];

function ShelterCenterContent() {
    const searchParams = useSearchParams();
    const eocParam = searchParams.get('eoc'); // Get EOC type from URL

    const [mounted, setMounted] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [shelterCenters, setShelterCenters] = useState([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterEocType, setFilterEocType] = useState(eocParam || '');
    const [showModal, setShowModal] = useState(false);
    const [editingCenter, setEditingCenter] = useState(null);
    const [markerPosition, setMarkerPosition] = useState(null);
    const [stats, setStats] = useState({
        total: 0,
        active: 0,
        inactive: 0,
        total_capacity: 0,
        by_type: {}
    });

    // Dropdown data
    const [districts, setDistricts] = useState([]);
    const [tambons, setTambons] = useState([]);
    const [villages, setVillages] = useState([]);

    const eocTypes = EOC_TYPES;

    // Form data
    const [formData, setFormData] = useState({
        sheltername: '',
        eoc_type: 'flood',
        lat: '',
        lon: '',
        address: '',
        tambon: '',
        district_name: '',
        village: '',
        is_active: 1,
        shelter_capacity: '',
        contact_phone: ''
    });

    // Update filter when URL parameter changes
    useEffect(() => {
        if (eocParam) {
            setFilterEocType(eocParam);
        }
    }, [eocParam]);

    const calculateStats = useCallback((data) => {
        if (!Array.isArray(data)) {
            setStats({
                total: 0,
                active: 0,
                inactive: 0,
                total_capacity: 0,
                by_type: {}
            });
            return;
        }

        const by_type = {};
        eocTypes.forEach(type => {
            const typeData = data.filter(c => c.eoc_type === type.value);
            by_type[type.value] = {
                count: typeData.length,
                capacity: typeData.reduce((sum, c) => sum + (parseInt(c.shelter_capacity) || 0), 0)
            };
        });

        const stats = {
            total: data.length,
            active: data.filter(c => c.is_active === 1).length,
            inactive: data.filter(c => c.is_active === 0).length,
            total_capacity: data.reduce((sum, c) => sum + (parseInt(c.shelter_capacity) || 0), 0),
            by_type
        };
        setStats(stats);
    }, [eocTypes]);

    const fetchShelterCenters = useCallback(async () => {
        try {
            setLoading(true);
            const response = await fetch('/stn-eoc/api/admin/shelter-center');
            const result = await response.json();

            const centersData = Array.isArray(result.data) ? result.data : [];
            setShelterCenters(centersData);
            calculateStats(centersData);

            if (!result.success && result.message) {
                showError(result.message);
            }
        } catch (error) {
            console.error('Fetch error:', error);
            showError('เกิดข้อผิดพลาดในการโหลดข้อมูล');
            setShelterCenters([]);
        } finally {
            setLoading(false);
        }
    }, [calculateStats]);

    const resetForm = () => {
        setFormData({
            sheltername: '',
            eoc_type: 'flood',
            lat: '',
            lon: '',
            address: '',
            tambon: '',
            district_name: '',
            village: '',
            is_active: 1,
            shelter_capacity: '',
            contact_phone: ''
        });
        setMarkerPosition(null);
        setEditingCenter(null);
        setTambons([]);
        setVillages([]);
    };

    // Fetch districts
    const fetchDistricts = useCallback(async () => {
        try {
            const response = await fetch('/stn-eoc/api/common/villages');
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                const uniqueDistricts = [...new Set(result.data.map(v => v.district))];
                setDistricts(uniqueDistricts.sort());
            }
        } catch (error) {
            console.error('Fetch districts error:', error);
        }
    }, []);

    useEffect(() => {
        setMounted(true);
        fetchShelterCenters();
        fetchDistricts();
    }, [fetchDistricts, fetchShelterCenters]);

    // Fetch tambons based on selected district
    const fetchTambons = async (district) => {
        try {
            const response = await fetch('/stn-eoc/api/common/villages');
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                const filteredTambons = result.data
                    .filter(v => v.district === district)
                    .map(v => v.subDistrict);
                const uniqueTambons = [...new Set(filteredTambons)];
                setTambons(uniqueTambons.sort());
            }
        } catch (error) {
            console.error('Fetch tambons error:', error);
        }
    };

    // Fetch villages based on selected district and tambon
    const fetchVillages = async (district, tambon) => {
        try {
            const response = await fetch('/stn-eoc/api/common/villages');
            const result = await response.json();
            if (result.success && Array.isArray(result.data)) {
                const filteredVillages = result.data
                    .filter(v => v.district === district && v.subDistrict === tambon)
                    .map(v => v.name);
                setVillages(filteredVillages.sort());
            }
        } catch (error) {
            console.error('Fetch villages error:', error);
        }
    };

    // Handle district change
    const handleDistrictChange = (e) => {
        const district = e.target.value;
        setFormData({ ...formData, district_name: district, tambon: '', village: '' });
        setTambons([]);
        setVillages([]);
        if (district) {
            fetchTambons(district);
        }
    };

    // Handle tambon change
    const handleTambonChange = (e) => {
        const tambon = e.target.value;
        setFormData({ ...formData, tambon: tambon, village: '' });
        setVillages([]);
        if (tambon && formData.district_name) {
            fetchVillages(formData.district_name, tambon);
        }
    };

    const handleEdit = (center) => {
        setEditingCenter(center);
        setFormData({
            sheltername: center.sheltername || '',
            eoc_type: center.eoc_type || 'flood',
            lat: center.lat || '',
            lon: center.lon || '',
            address: center.address || '',
            tambon: center.tambon || '',
            district_name: center.district_name || '',
            village: center.village || '',
            is_active: center.is_active || 1,
            shelter_capacity: center.shelter_capacity || '',
            contact_phone: center.contact_phone || ''
        });
        if (center.lat && center.lon) {
            setMarkerPosition({
                lat: parseFloat(center.lat),
                lng: parseFloat(center.lon)
            });
        }
        // Load tambons and villages for editing
        if (center.district_name) {
            fetchTambons(center.district_name);
            if (center.tambon) {
                fetchVillages(center.district_name, center.tambon);
            }
        }
        setShowModal(true);
    };

    const handleDelete = async (center, forceDelete = false) => {
        // ถ้ายังไม่ได้ force delete ให้แสดง confirm ปกติก่อน
        if (!forceDelete) {
            const result = await showConfirm(
                'warning',
                `คุณต้องการลบศูนย์พักพิง "${center.sheltername}" ใช่หรือไม่?`,
                'ยืนยันการลบ'
            );

            if (!result.isConfirmed) return;
        }

        try {
            const url = forceDelete
                ? `/stn-eoc/api/admin/shelter-center?id=${center.id}&force=true`
                : `/stn-eoc/api/admin/shelter-center?id=${center.id}`;

            const response = await fetch(url, {
                method: 'DELETE'
            });

            const result = await response.json();

            if (result.success) {
                showSuccess(result.message || 'ลบข้อมูลสำเร็จ');
                fetchShelterCenters();
            } else if (result.needsConfirmation) {
                // ถ้ามีข้อมูลที่เกี่ยวข้อง ให้ถามว่าต้องการลบพร้อมข้อมูลที่เกี่ยวข้องหรือไม่
                const confirmResult = await showConfirm(
                    '⚠️ พบข้อมูลที่เกี่ยวข้อง',
                    result.message,
                    'warning'
                );

                if (confirmResult.isConfirmed) {
                    // เรียกอีกครั้งด้วย force=true
                    handleDelete(center, true);
                }
            } else {
                showError(result.message || 'ไม่สามารถลบข้อมูลได้');
            }
        } catch (error) {
            console.error('Delete error:', error);
            showError('เกิดข้อผิดพลาดในการลบข้อมูล');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        // Validation
        if (!formData.sheltername) {
            showWarning('กรุณากรอกชื่อศูนย์พักพิง');
            return;
        }
        if (!formData.tambon) {
            showWarning('กรุณากรอกตำบล');
            return;
        }
        if (!markerPosition && !formData.lat) {
            showWarning('กรุณาปักหมุดตำแหน่งศูนย์พักพิงบนแผนที่');
            return;
        }
        if (!formData.shelter_capacity) {
            showWarning('กรุณากรอกความจุของศูนย์พักพิง');
            return;
        }

        setIsSubmitting(true);

        try {
            const dataToSend = {
                ...formData,
                lat: markerPosition ? markerPosition.lat : formData.lat,
                lon: markerPosition ? markerPosition.lng : formData.lon
            };

            const url = editingCenter
                ? `/stn-eoc/api/admin/shelter-center?id=${editingCenter.id}`
                : '/stn-eoc/api/admin/shelter-center';

            const method = editingCenter ? 'PUT' : 'POST';

            const response = await fetch(url, {
                method: method,
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(dataToSend)
            });

            const result = await response.json();

            if (result.success) {
                showSuccess(editingCenter ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มข้อมูลสำเร็จ');
                setShowModal(false);
                resetForm();
                fetchShelterCenters();
            } else {
                console.error('API Error:', result);
                showError(result.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
                if (result.error) {
                    console.error('Error details:', result.error);
                }
            }
        } catch (error) {
            console.error('Submit error:', error);
            showError('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้: ' + error.message);
        } finally {
            setIsSubmitting(false);
        }
    };

    // Filter centers with safety check
    const filteredCenters = Array.isArray(shelterCenters)
        ? shelterCenters.filter(center => {
            const matchSearch = center.sheltername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                center.address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                center.tambon?.toLowerCase().includes(searchTerm.toLowerCase());
            const matchType = filterEocType === '' || center.eoc_type === filterEocType;
            return matchSearch && matchType;
        })
        : [];

    const getEocTypeLabel = (eocType) => {
        const type = eocTypes.find(t => t.value === eocType);
        return type ? type.label : eocType;
    };

    const getEocTypeColor = (eocType) => {
        const colors = {
            flood: 'bg-blue-100 text-blue-800',
            drought: 'bg-yellow-100 text-yellow-800',
            tsunami: 'bg-cyan-100 text-cyan-800',
            earthquake: 'bg-orange-100 text-orange-800',
            disease: 'bg-red-100 text-red-800'
        };
        return colors[eocType] || 'bg-gray-100 text-gray-800';
    };

    if (!mounted) return null;

    return (
        <EOCLayout>
            <div className="max-w-7xl mx-auto p-6">
                {/* Header */}
                <div className="mb-6">
                    <h1 className="text-3xl font-bold text-gray-800 mb-2">
                        🏥 จัดการศูนย์พักพิงชั่วคราว
                    </h1>
                    <p className="text-gray-600">ระบบจัดการข้อมูลศูนย์พักพิงชั่วคราว</p>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-6">
                    <div className="bg-white rounded-lg shadow p-4 border border-blue-500">
                        <div className="text-sm text-gray-600 mb-1">ทั้งหมด</div>
                        <div className="text-2xl font-bold text-blue-600">{stats.total || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border border-green-500">
                        <div className="text-sm text-gray-600 mb-1">เปิดใช้งาน</div>
                        <div className="text-2xl font-bold text-green-600">{stats.active || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border border-red-500">
                        <div className="text-sm text-gray-600 mb-1">ปิดใช้งาน</div>
                        <div className="text-2xl font-bold text-red-600">{stats.inactive || 0}</div>
                    </div>
                    <div className="bg-white rounded-lg shadow p-4 border border-teal-500">
                        <div className="text-sm text-gray-600 mb-1">ความจุรวม</div>
                        <div className="text-2xl font-bold text-teal-600">{stats.total_capacity || 0}</div>
                    </div>
                    {eocTypes.map(type => {
                        const typeStats = stats.by_type?.[type.value] || { count: 0, capacity: 0 };
                        return (
                            <div key={type.value} className="bg-white rounded-lg shadow p-4 border border-gray-400">
                                <div className="text-xs text-gray-600 mb-1">{type.label}</div>
                                <div className="text-xl font-bold text-gray-700">
                                    {typeStats.count} ({typeStats.capacity})
                                </div>
                            </div>
                        );
                    })}
                </div>

                {/* Search and Filter */}
                <div className="bg-white p-4 rounded-lg shadow mb-6 text-gray-800">
                    <div className="flex flex-wrap gap-4 ">
                        <input
                            type="text"
                            placeholder="🔍 ค้นหาชื่อศูนย์พักพิง, ที่อยู่, ตำบล..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="flex-1 min-w-[200px] px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <select
                            value={filterEocType}
                            onChange={(e) => setFilterEocType(e.target.value)}
                            className="px-4 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">ทุกประเภท EOC</option>
                            {eocTypes.map(type => (
                                <option key={type.value} value={type.value}>
                                    {type.label}
                                </option>
                            ))}
                        </select>
                        <ExportExcelButton
                            data={filteredCenters.map(center => ({
                                'ID': center.id,
                                'ประเภท EOC': getEocTypeLabel(center.eoc_type),
                                'ชื่อศูนย์': center.sheltername,
                                'ที่อยู่': center.address || '-',
                                'อำเภอ': center.district_name || '-',
                                'ตำบล': center.tambon || '-',
                                'หมู่บ้าน': center.village || '-',
                                'ละติจูด': center.lat || '-',
                                'ลองจิจูด': center.lon || '-',
                                'ความจุ (คน)': center.shelter_capacity || '-',
                                'เบอร์โทรติดต่อ': center.contact_phone || '-',
                                'สถานะ': center.is_active === 1 ? 'เปิดใช้งาน' : 'ปิดใช้งาน'
                            }))}
                            filename="shelter_centers"
                            sheetName="ศูนย์พักพิง"
                        />
                        <button
                            onClick={() => {
                                resetForm();
                                setShowModal(true);
                            }}
                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                            ➕ เพิ่มศูนย์พักพิงชั่วคราว
                        </button>
                    </div>
                </div>

                {/* Shelter Centers Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    {loading ? (
                        <div className="p-8 text-center text-gray-500">
                            กำลังโหลดข้อมูล...
                        </div>
                    ) : filteredCenters.length === 0 ? (
                        <div className="p-8 text-center text-gray-500">
                            ไม่พบข้อมูลศูนย์พักพิงชั่วคราว
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead className="bg-gray-50 border-b">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท EOC</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ชื่อศูนย์พักพิง</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ที่อยู่</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ/ตำบล</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">พิกัด</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">เบอร์โทร</th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ความจุ (คน)</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">สถานะ</th>
                                        <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-200">
                                    {filteredCenters.map((center) => (
                                        <tr key={center.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {center.id}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getEocTypeColor(center.eoc_type)}`}>
                                                    {getEocTypeLabel(center.eoc_type)}
                                                </span>
                                            </td>

                                            <td className="px-6 py-4">
                                                <div className="font-medium text-gray-900">{center.sheltername}</div>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">
                                                {center.address || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {center.district_name || '-'} / {center.tambon || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {center.lat && center.lon
                                                    ? `${parseFloat(center.lat).toFixed(4)}, ${parseFloat(center.lon).toFixed(4)}`
                                                    : '-'
                                                }
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                                {center.contact_phone || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 text-center">
                                                {center.shelter_capacity || '-'}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <span className={`px-3 py-1 rounded-full text-xs font-medium ${center.is_active === 1
                                                    ? 'bg-green-100 text-green-800'
                                                    : 'bg-red-100 text-red-800'
                                                    }`}>
                                                    {center.is_active === 1 ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleEdit(center)}
                                                    className="text-blue-600 hover:text-blue-800 mr-3"
                                                    title="แก้ไข"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(center)}
                                                    className="text-red-600 hover:text-red-800"
                                                    title="ลบ"
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
            {
                showModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-4xl w-full p-6 max-h-[90vh] overflow-y-auto">
                            <h2 className="text-xl font-bold mb-4 text-gray-700">
                                {editingCenter ? '✏️ แก้ไขศูนย์พักพิงชั่วคราว' : '➕ เพิ่มศูนย์พักพิงชั่วคราวใหม่'}
                            </h2>

                            <form onSubmit={handleSubmit} className="space-y-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ชื่อศูนย์พักพิงชั่วคราว *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.sheltername}
                                            onChange={(e) => setFormData({ ...formData, sheltername: e.target.value })}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="เช่น ศูนย์พักพิงชั่วคราวโรงเรียนบ้านควนกาหลง"
                                        />
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ประเภท EOC *
                                        </label>
                                        <select
                                            required
                                            value={formData.eoc_type}
                                            onChange={(e) => setFormData({ ...formData, eoc_type: e.target.value })}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            {eocTypes.map(type => (
                                                <option key={type.value} value={type.value}>
                                                    {type.label}
                                                </option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-gray-500 mt-1">
                                            เลือกประเภทภัยพิบัติที่ศูนย์พักพิงนี้ใช้งาน
                                        </p>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            เขต/อำเภอ *
                                        </label>
                                        <select
                                            required
                                            value={formData.district_name}
                                            onChange={handleDistrictChange}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value="">-- เลือกอำเภอ --</option>
                                            {districts.map(district => (
                                                <option key={district} value={district}>{district}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ตำบล *
                                        </label>
                                        <select
                                            required
                                            value={formData.tambon}
                                            onChange={handleTambonChange}
                                            disabled={!formData.district_name}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                        >
                                            <option value="">-- เลือกตำบล --</option>
                                            {tambons.map(tambon => (
                                                <option key={tambon} value={tambon}>{tambon}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            หมู่บ้าน/ชุมชน
                                        </label>
                                        <select
                                            value={formData.village || ''}
                                            onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                            disabled={!formData.tambon}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 disabled:bg-gray-100"
                                        >
                                            <option value="">-- เลือกหมู่บ้าน --</option>
                                            {villages.map(village => (
                                                <option key={village} value={village}>{village}</option>
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
                                            placeholder="เช่น 123 หมู่ 1 ถนนสตูล"
                                        />
                                    </div>

                                    <div className="md:col-span-1">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            เบอร์โทรติดต่อ
                                        </label>
                                        <input
                                            type="tel"
                                            value={formData.contact_phone}
                                            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="เช่น 074-123456"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            ความจุ (จำนวนคนที่รองรับได้) *
                                        </label>
                                        <input
                                            type="number"
                                            required
                                            min="1"
                                            value={formData.shelter_capacity}
                                            onChange={(e) => setFormData({ ...formData, shelter_capacity: e.target.value })}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="เช่น 500"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            สถานะ *
                                        </label>
                                        <select
                                            required
                                            value={formData.is_active}
                                            onChange={(e) => setFormData({ ...formData, is_active: parseInt(e.target.value) })}
                                            className="text-gray-700 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        >
                                            <option value={1}>เปิดใช้งาน</option>
                                            <option value={0}>ปิดใช้งาน</option>
                                        </select>
                                    </div>

                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">
                                            ตำแหน่งบนแผนที่ * {markerPosition && `(Lat: ${markerPosition.lat.toFixed(5)}, Lng: ${markerPosition.lng.toFixed(5)})`}
                                        </label>
                                        <div className="border rounded-lg overflow-hidden">
                                            <MapSelector
                                                position={markerPosition}
                                                onPositionChange={setMarkerPosition}
                                            />
                                        </div>
                                        <p className="text-xs text-gray-500 mt-1">
                                            คลิกบนแผนที่เพื่อระบุตำแหน่งศูนย์พักพิง
                                        </p>
                                    </div>
                                </div>

                                <div className="flex gap-3 pt-4">
                                    <button
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors disabled:bg-gray-400"
                                    >
                                        {isSubmitting ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setShowModal(false);
                                            resetForm();
                                        }}
                                        disabled={isSubmitting}
                                        className="flex-1 bg-red-500 text-white py-2 rounded-lg hover:bg-red-600 transition-colors disabled:bg-gray-400"
                                    >
                                        ❌ ยกเลิก
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )
            }
        </EOCLayout >
    );
}

export default function ShelterCenterPage() {
    return (
        <Suspense fallback={
            <EOCLayout>
                <div className="flex justify-center items-center min-h-screen">
                    <div className="animate-spin rounded-full h-12 w-12 border-b border-green-500"></div>
                </div>
            </EOCLayout>
        }>
            <ShelterCenterContent />
        </Suspense>
    );
}
