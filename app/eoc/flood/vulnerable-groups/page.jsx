"use client";
import { useState, useEffect } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { satunDistricts } from "@/data/satunData";
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';

export default function VulnerableGroupsPage() {
    const [records, setRecords] = useState([]);
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [selectedDistrict, setSelectedDistrict] = useState('all');
    const [selectedTambon, setSelectedTambon] = useState('all');
    const [tambonOptions, setTambonOptions] = useState([]);

    const [formData, setFormData] = useState({
        district: '',
        tambon: '',
        village: '',
        elderly: 0,
        children: 0,
        disabled: 0,
        bedridden: 0,
        pregnant: 0,
        chronic_illness: 0,
        notes: '',
        needs: ''
    });

    // ดึงข้อมูล Active EOC Session
    useEffect(() => {
        const fetchActiveSession = async () => {
            try {
                const response = await fetch('/api/eoc/flood/area-status');
                const result = await response.json();
                if (result.hasActiveSession && result.activeSession) {
                    setActiveSession(result.activeSession);
                } else {
                    showError('ไม่มี EOC Session ที่เปิดอยู่');
                }
            } catch (error) {
                console.error('Error fetching active session:', error);
            }
        };
        fetchActiveSession();
    }, []);

    // โหลดข้อมูล
    useEffect(() => {
        if (activeSession) {
            fetchRecords();
            fetchStats();
        }
    }, [activeSession, selectedDistrict, selectedTambon]);

    // อัพเดตตัวเลือกตำบลเมื่อเลือกอำเภอ
    useEffect(() => {
        if (selectedDistrict !== 'all') {
            const district = satunDistricts.find(d => d.name === selectedDistrict);
            setTambonOptions(district?.tambons || []);
        } else {
            setTambonOptions([]);
        }
    }, [selectedDistrict]);

    useEffect(() => {
        if (formData.district) {
            const district = satunDistricts.find(d => d.name === formData.district);
            setTambonOptions(district?.tambons || []);
        }
    }, [formData.district]);

    const fetchRecords = async () => {
        if (!activeSession) return;

        try {
            setLoading(true);
            const params = new URLSearchParams();
            params.append('session_id', activeSession.id);
            if (selectedDistrict !== 'all') params.append('district', selectedDistrict);
            if (selectedTambon !== 'all') params.append('tambon', selectedTambon);

            const res = await fetch(`/api/eoc/flood/vulnerable-groups?${params}`);
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

    const fetchStats = async () => {
        if (!activeSession) return;

        try {
            const res = await fetch(`/api/eoc/flood/vulnerable-groups/stats?session_id=${activeSession.id}`);
            const data = await res.json();

            if (data.success) {
                setStats(data.data);
            }
        } catch (error) {
            console.error('Error fetching stats:', error);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeSession) {
            showError('ไม่พบ EOC Session ที่เปิดอยู่');
            return;
        }

        try {
            const url = '/api/eoc/flood/vulnerable-groups';
            const method = editingRecord ? 'PUT' : 'POST';

            const body = {
                ...formData,
                session_id: activeSession.id,
                id: editingRecord?.id
            };

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body)
            });

            const data = await res.json();
            if (data.success) {
                await fetchRecords();
                await fetchStats();
                showSuccess(editingRecord ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกข้อมูลสำเร็จ');
                setShowModal(false);
                setEditingRecord(null);
                resetForm();
            } else {
                showError('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error('Error saving record:', error);
            showError('เกิดข้อผิดพลาดในการบันทึกข้อมูล');
        }
    };

    const handleEdit = (record) => {
        setEditingRecord(record);
        setFormData({
            district: record.district,
            tambon: record.tambon,
            village: record.village || '',
            elderly: record.elderly || 0,
            children: record.children || 0,
            disabled: record.disabled || 0,
            bedridden: record.bedridden || 0,
            pregnant: record.pregnant || 0,
            chronic_illness: record.chronic_illness || 0,
            notes: record.notes || '',
            needs: record.needs || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await showDeleteConfirm();
        if (!confirmed) return;

        try {
            const res = await fetch(`/api/eoc/flood/vulnerable-groups?id=${id}`, {
                method: 'DELETE'
            });
            const data = await res.json();
            if (data.success) {
                await fetchRecords();
                await fetchStats();
                showSuccess('ลบข้อมูลสำเร็จ');
            } else {
                showError('เกิดข้อผิดพลาด: ' + data.error);
            }
        } catch (error) {
            console.error('Error deleting record:', error);
            showError('เกิดข้อผิดพลาดในการลบข้อมูล');
        }
    };

    const resetForm = () => {
        setFormData({
            district: '',
            tambon: '',
            village: '',
            elderly: 0,
            children: 0,
            disabled: 0,
            bedridden: 0,
            pregnant: 0,
            chronic_illness: 0,
            notes: '',
            needs: ''
        });
    };

    const calculateTotal = (record) => {
        return (record.elderly || 0) + (record.children || 0) + (record.disabled || 0) +
            (record.bedridden || 0) + (record.pregnant || 0) + (record.chronic_illness || 0);
    };

    if (!activeSession) {
        return (
            <EOCLayout>
                <div className="p-6">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มี EOC Session ที่เปิดอยู่</h3>
                        <p className="text-gray-600">
                            กรุณาเปิด EOC Session ก่อนบันทึกข้อมูลกลุ่มเปราะบาง
                        </p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    return (
        <EOCLayout>
            <div className="p-6">
                {/* Header */}
                <div className="flex justify-between items-center mb-6">
                    <div>
                        <h1 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
                            <span className="text-4xl">👥</span>
                            บันทึกข้อมูลกลุ่มเปราะบาง
                        </h1>
                        <p className="text-gray-600">
                            EOC Session #{activeSession.session_number} - {new Date(activeSession.opened_at).toLocaleDateString('th-TH')}
                        </p>
                    </div>
                    <button
                        onClick={() => {
                            setEditingRecord(null);
                            resetForm();
                            setShowModal(true);
                        }}
                        className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
                    >
                        <span>➕</span>
                        เพิ่มข้อมูลใหม่
                    </button>
                </div>

                {/* สถิติรวม */}
                {stats && (
                    <>
                        {/* สถิติจังหวัด */}
                        <div className="bg-gradient-to-r from-blue-500 to-blue-600 rounded-lg shadow-lg p-6 mb-6 text-white">
                            <h2 className="text-2xl font-bold mb-4 flex items-center gap-2">
                                <span>🏛️</span>
                                สถิติรวมจังหวัด{stats.province.province}
                            </h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
                                <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                                    <div className="text-3xl font-bold">{stats.province.total_elderly || 0}</div>
                                    <div className="text-sm mt-1">👴 ผู้สูงอายุ</div>
                                </div>
                                <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                                    <div className="text-3xl font-bold">{stats.province.total_children || 0}</div>
                                    <div className="text-sm mt-1">👶 เด็กเล็ก</div>
                                </div>
                                <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                                    <div className="text-3xl font-bold">{stats.province.total_disabled || 0}</div>
                                    <div className="text-sm mt-1">♿ ผู้พิการ</div>
                                </div>
                                <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                                    <div className="text-3xl font-bold">{stats.province.total_bedridden || 0}</div>
                                    <div className="text-sm mt-1">🛏️ ติดเตียง</div>
                                </div>
                                <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                                    <div className="text-3xl font-bold">{stats.province.total_pregnant || 0}</div>
                                    <div className="text-sm mt-1">🤰 มีครรภ์</div>
                                </div>
                                <div className="bg-white/20 backdrop-blur rounded-lg p-4 text-center">
                                    <div className="text-3xl font-bold">{stats.province.total_chronic_illness || 0}</div>
                                    <div className="text-sm mt-1">💊 ป่วยเรื้อรัง</div>
                                </div>
                                <div className="bg-yellow-400 text-gray-900 rounded-lg p-4 text-center font-bold">
                                    <div className="text-4xl">{stats.province.grand_total || 0}</div>
                                    <div className="text-sm mt-1">รวมทั้งหมด</div>
                                </div>
                            </div>
                        </div>

                        {/* สถิติอำเภอ */}
                        {stats.districts && stats.districts.length > 0 && (
                            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span>🏘️</span>
                                    สถิติรวมแต่ละอำเภอ
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">👴 ผู้สูงอายุ</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">👶 เด็กเล็ก</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">♿ ผู้พิการ</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">🛏️ ติดเตียง</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">🤰 มีครรภ์</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">💊 ป่วยเรื้อรัง</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase font-bold">รวม</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {stats.districts.map((district, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                        {district.district}
                                                    </td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{district.total_elderly || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{district.total_children || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{district.total_disabled || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{district.total_bedridden || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{district.total_pregnant || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{district.total_chronic_illness || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center font-bold text-blue-600">{district.total || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}

                        {/* สถิติตำบล */}
                        {stats.tambons && stats.tambons.length > 0 && (
                            <div className="bg-white rounded-lg shadow-md p-6 mb-6">
                                <h3 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span>🏡</span>
                                    สถิติรวมแต่ละตำบล
                                </h3>
                                <div className="overflow-x-auto">
                                    <table className="min-w-full divide-y divide-gray-200">
                                        <thead className="bg-gray-50">
                                            <tr>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">อำเภอ</th>
                                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ตำบล</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">👴 ผู้สูงอายุ</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">👶 เด็กเล็ก</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">♿ ผู้พิการ</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">🛏️ ติดเตียง</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">🤰 มีครรภ์</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">💊 ป่วยเรื้อรัง</th>
                                                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase font-bold">รวม</th>
                                            </tr>
                                        </thead>
                                        <tbody className="bg-white divide-y divide-gray-200">
                                            {stats.tambons.map((tambon, index) => (
                                                <tr key={index} className="hover:bg-gray-50">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                        {tambon.district}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">
                                                        {tambon.tambon}
                                                    </td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{tambon.total_elderly || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{tambon.total_children || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{tambon.total_disabled || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{tambon.total_bedridden || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{tambon.total_pregnant || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center">{tambon.total_chronic_illness || 0}</td>
                                                    <td className="text-gray-600 px-6 py-4 text-center font-bold text-blue-600">{tambon.total || 0}</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </>
                )}

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ</label>
                            <select
                                value={selectedDistrict}
                                onChange={(e) => {
                                    setSelectedDistrict(e.target.value);
                                    setSelectedTambon('all');
                                }}
                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="all">ทั้งหมด</option>
                                {satunDistricts.map(d => (
                                    <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">ตำบล</label>
                            <select
                                value={selectedTambon}
                                onChange={(e) => setSelectedTambon(e.target.value)}
                                disabled={selectedDistrict === 'all'}
                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                            >
                                <option value="all">ทั้งหมด</option>
                                {tambonOptions.map(t => (
                                    <option key={t.name} value={t.name}>{t.name}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-200">
                        <h3 className="font-bold text-gray-800">📋 ตารางข้อมูลที่บันทึกแล้ว</h3>
                        <p className="text-sm text-gray-600 mt-1">แสดงข้อมูลทั้งหมด {records.length} รายการ</p>
                    </div>

                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500 mx-auto mb-2"></div>
                            <p className="text-gray-600 text-sm">กำลังโหลดข้อมูล...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📭</div>
                            <h4 className="text-lg font-semibold text-gray-700 mb-2">ยังไม่มีข้อมูล</h4>
                            <p className="text-gray-500 text-sm">คลิกปุ่ม "เพิ่มข้อมูลใหม่" เพื่อเริ่มบันทึกข้อมูล</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">พื้นที่</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">👴 ผู้สูงอายุ</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">👶 เด็ก</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">♿ พิการ</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">🛏️ ติดเตียง</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">🤰 ครรภ์</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">💊 เรื้อรัง</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">รวม</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {records.map((record, index) => (
                                        <tr key={record.id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-4 py-4 whitespace-nowrap text-sm text-gray-500">{index + 1}</td>
                                            <td className="px-4 py-4">
                                                <div className="text-sm font-medium text-gray-900">{record.village || 'ทั้งตำบล'}</div>
                                                <div className="text-sm text-gray-500">ต.{record.tambon} อ.{record.district}</div>
                                            </td>
                                            <td className="text-gray-600 px-4 py-4 text-center text-sm">{record.elderly || 0}</td>
                                            <td className="text-gray-600 px-4 py-4 text-center text-sm">{record.children || 0}</td>
                                            <td className="text-gray-600  px-4 py-4 text-center text-sm">{record.disabled || 0}</td>
                                            <td className="text-gray-600 px-4 py-4 text-center text-sm">{record.bedridden || 0}</td>
                                            <td className="text-gray-600 px-4 py-4 text-center text-sm">{record.pregnant || 0}</td>
                                            <td className="text-gray-600 px-4 py-4 text-center text-sm">{record.chronic_illness || 0}</td>
                                            <td className="text-gray-600 px-4 py-4 text-center font-bold text-blue-600">{calculateTotal(record)}</td>
                                            <td className="text-gray-600 px-4 py-4 whitespace-nowrap text-center">
                                                <button
                                                    onClick={() => handleEdit(record)}
                                                    className="text-blue-600 hover:text-blue-800 mr-3 px-2 py-1 rounded hover:bg-blue-50"
                                                    title="แก้ไข"
                                                >
                                                    ✏️
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(record.id)}
                                                    className="text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50"
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

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-gray-700 text-2xl font-bold mb-4">
                                    {editingRecord ? 'แก้ไขข้อมูล' : 'เพิ่มข้อมูลใหม่'}
                                </h2>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    {/* Location */}
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                อำเภอ <span className="text-red-500">*</span>
                                            </label>
                                            <select
                                                value={formData.district}
                                                onChange={(e) => setFormData({ ...formData, district: e.target.value, tambon: '' })}
                                                required
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
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
                                                onChange={(e) => setFormData({ ...formData, tambon: e.target.value })}
                                                required
                                                disabled={!formData.district}
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100"
                                            >
                                                <option value="">เลือกตำบล</option>
                                                {tambonOptions.map(t => (
                                                    <option key={t.name} value={t.name}>{t.name}</option>
                                                ))}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                หมู่บ้าน
                                            </label>
                                            <input
                                                type="text"
                                                value={formData.village}
                                                onChange={(e) => setFormData({ ...formData, village: e.target.value })}
                                                placeholder="ระบุหมู่บ้าน (หรือเว้นว่างสำหรับทั้งตำบล)"
                                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    {/* Vulnerable Groups Counts */}
                                    <div className="border-t pt-4">
                                        <h3 className="font-bold text-gray-800 mb-3">จำนวนกลุ่มเปราะบาง</h3>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    👴 ผู้สูงอายุ
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.elderly}
                                                    onChange={(e) => setFormData({ ...formData, elderly: parseInt(e.target.value) || 0 })}
                                                    className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    👶 เด็กเล็ก (&#60;5ปี)
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.children}
                                                    onChange={(e) => setFormData({ ...formData, children: parseInt(e.target.value) || 0 })}
                                                    className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    ♿ ผู้พิการ
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.disabled}
                                                    onChange={(e) => setFormData({ ...formData, disabled: parseInt(e.target.value) || 0 })}
                                                    className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    🛏️ ผู้ป่วยติดเตียง
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.bedridden}
                                                    onChange={(e) => setFormData({ ...formData, bedridden: parseInt(e.target.value) || 0 })}
                                                    className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    🤰 สตรีมีครรภ์
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.pregnant}
                                                    onChange={(e) => setFormData({ ...formData, pregnant: parseInt(e.target.value) || 0 })}
                                                    className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                                    💊 ผู้ป่วยเรื้อรัง
                                                </label>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    value={formData.chronic_illness}
                                                    onChange={(e) => setFormData({ ...formData, chronic_illness: parseInt(e.target.value) || 0 })}
                                                    className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                                />
                                            </div>
                                        </div>
                                    </div>

                                    {/* Notes */}
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows="2"
                                            className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ความต้องการเฉพาะ</label>
                                        <textarea
                                            value={formData.needs}
                                            onChange={(e) => setFormData({ ...formData, needs: e.target.value })}
                                            rows="2"
                                            placeholder="เช่น ต้องการรถเข็น, อุปกรณ์ช่วยเหลือ, ยาพิเศษ"
                                            className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setShowModal(false);
                                                setEditingRecord(null);
                                                resetForm();
                                            }}
                                            className="px-6 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button
                                            type="submit"
                                            className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
                                        >
                                            {editingRecord ? 'บันทึกการแก้ไข' : 'บันทึก'}
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
