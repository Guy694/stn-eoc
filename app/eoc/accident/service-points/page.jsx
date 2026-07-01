"use client";
import { useCallback, useEffect, useState } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { satunDistricts } from "@/data/satunData";
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';
import dynamic from 'next/dynamic';

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-[400px] bg-gray-100 rounded-lg animate-pulse flex items-center justify-center">กำลังโหลดแผนที่...</div>
});

const pointTypes = ['จุดตรวจ', 'จุดบริการ', 'จุดพักรถ', 'ด่านชุมชน'];

export default function ServicePointsPage() {
    const [points, setPoints] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingPoint, setEditingPoint] = useState(null);
    const [activeSession, setActiveSession] = useState(null);

    const [formData, setFormData] = useState({
        name: '',
        point_type: 'จุดตรวจ',
        lat: '',
        lng: '',
        district: '',
        tambon: '',
        address: '',
        officer_count: 0,
        vehicle_count: 0,
        start_date: '',
        end_date: '',
        operating_hours: '00:00-24:00',
        contact_phone: '',
        is_active: true
    });

    const [tambonOptions, setTambonOptions] = useState([]);

    useEffect(() => {
        const fetchSession = async () => {
            try {
                const res = await fetch('/stn-eoc/api/eoc/accident/area-status');
                const result = await res.json();
                if (result.hasActiveSession) {
                    setActiveSession(result.activeSession);
                }
            } catch (error) {
                console.error('Error:', error);
            }
        };
        fetchSession();
    }, []);

    useEffect(() => {
        if (formData.district) {
            const district = satunDistricts.find(d => d.name === formData.district);
            setTambonOptions(district?.tambons || []);
        } else {
            setTambonOptions([]);
        }
    }, [formData.district]);

    const fetchPoints = useCallback(async () => {
        if (!activeSession) return;
        try {
            setLoading(true);
            const res = await fetch(`/stn-eoc/api/admin/temporary-service-points?session_id=${activeSession.id}&active_only=false`);
            const data = await res.json();
            if (data.success) {
                setPoints(data.data || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    }, [activeSession]);

    useEffect(() => {
        if (activeSession) {
            fetchPoints();
        } else {
            setLoading(false);
        }
    }, [activeSession, fetchPoints]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeSession) {
            showError('ไม่พบ EOC Session ที่เปิดอยู่');
            return;
        }

        try {
            const url = editingPoint
                ? `/stn-eoc/api/admin/temporary-service-points?id=${editingPoint.id}`
                : '/stn-eoc/api/admin/temporary-service-points';
            const method = editingPoint ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, session_id: activeSession.id })
            });

            const data = await res.json();
            if (data.success) {
                showSuccess(editingPoint ? 'แก้ไขข้อมูลสำเร็จ' : 'เพิ่มจุดบริการสำเร็จ');
                setShowModal(false);
                setEditingPoint(null);
                resetForm();
                fetchPoints();
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError('เกิดข้อผิดพลาด');
        }
    };

    const handleEdit = (point) => {
        setEditingPoint(point);
        setFormData({
            name: point.name || '',
            point_type: point.point_type || 'จุดตรวจ',
            lat: point.lat || '',
            lng: point.lng || '',
            district: point.district || '',
            tambon: point.tambon || '',
            address: point.address || '',
            officer_count: point.officer_count || 0,
            vehicle_count: point.vehicle_count || 0,
            start_date: point.start_date?.split('T')[0] || '',
            end_date: point.end_date?.split('T')[0] || '',
            operating_hours: point.operating_hours || '00:00-24:00',
            contact_phone: point.contact_phone || '',
            is_active: point.is_active !== false
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await showDeleteConfirm();
        if (!confirmed) return;

        try {
            const res = await fetch(`/stn-eoc/api/admin/temporary-service-points?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showSuccess('ลบจุดบริการสำเร็จ');
                fetchPoints();
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError('เกิดข้อผิดพลาด');
        }
    };

    const toggleActive = async (point) => {
        try {
            const res = await fetch(`/stn-eoc/api/admin/temporary-service-points?id=${point.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ is_active: !point.is_active })
            });
            const data = await res.json();
            if (data.success) {
                showSuccess(point.is_active ? 'ปิดจุดบริการแล้ว' : 'เปิดจุดบริการแล้ว');
                fetchPoints();
            }
        } catch (error) {
            showError('เกิดข้อผิดพลาด');
        }
    };

    const resetForm = () => {
        const today = new Date().toISOString().split('T')[0];
        setFormData({
            name: '',
            point_type: 'จุดตรวจ',
            lat: '',
            lng: '',
            district: '',
            tambon: '',
            address: '',
            officer_count: 0,
            vehicle_count: 0,
            start_date: today,
            end_date: '',
            operating_hours: '00:00-24:00',
            contact_phone: '',
            is_active: true
        });
    };

    const stats = {
        total: points.length,
        active: points.filter(p => p.is_active).length,
        officers: points.reduce((sum, p) => sum + (p.officer_count || 0), 0),
        vehicles: points.reduce((sum, p) => sum + (p.vehicle_count || 0), 0)
    };

    if (!activeSession) {
        return (
            <EOCLayout>
                <div className="p-6">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มี EOC Session ที่เปิดอยู่</h3>
                        <p className="text-gray-600">กรุณาเปิด EOC Session ก่อนจัดการจุดบริการ</p>
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
                            <span className="text-4xl">🚧</span>
                            จุดบริการชั่วคราว
                        </h1>
                        <p className="text-gray-600">
                            EOC Session #{activeSession.session_number} - จุดตรวจ/จุดบริการช่วง 7 วันอันตราย
                        </p>
                    </div>
                    <button
                        onClick={() => { setEditingPoint(null); resetForm(); setShowModal(true); }}
                        className="bg-orange-600 text-white px-6 py-3 rounded-lg hover:bg-orange-700 flex items-center gap-2"
                    >
                        ➕ เพิ่มจุดบริการ
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 shadow border border-orange-500">
                        <div className="text-3xl font-bold text-orange-600">{stats.total}</div>
                        <div className="text-sm text-gray-600">จุดบริการทั้งหมด</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow border border-green-500">
                        <div className="text-3xl font-bold text-green-600">{stats.active}</div>
                        <div className="text-sm text-gray-600">🟢 เปิดให้บริการ</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow border border-blue-500">
                        <div className="text-3xl font-bold text-blue-600">{stats.officers}</div>
                        <div className="text-sm text-gray-600">👮 เจ้าหน้าที่</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow border border-teal-500">
                        <div className="text-3xl font-bold text-teal-600">{stats.vehicles}</div>
                        <div className="text-sm text-gray-600">🚔 รถตรวจ</div>
                    </div>
                </div>

                {/* Cards View */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-b border-orange-500 mx-auto mb-4"></div>
                        <p className="text-gray-600">กำลังโหลด...</p>
                    </div>
                ) : points.length === 0 ? (
                    <div className="bg-white rounded-lg shadow p-12 text-center">
                        <div className="text-6xl mb-4">📭</div>
                        <h3 className="text-xl font-bold text-gray-700 mb-2">ยังไม่มีจุดบริการ</h3>
                        <p className="text-gray-500 mb-4">คลิกปุ่ม &quot;เพิ่มจุดบริการ&quot; เพื่อเริ่มต้น</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {points.map((point) => (
                            <div
                                key={point.id}
                                className={`bg-white rounded-lg shadow-md overflow-hidden border ${point.is_active ? 'border-green-500' : 'border-gray-300'
                                    }`}
                            >
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-gray-900 text-lg">{point.name}</h3>
                                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${point.is_active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                                }`}>
                                                {point.is_active ? '🟢 เปิดให้บริการ' : '⚪ ปิดบริการ'}
                                            </span>
                                        </div>
                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                                            {point.point_type}
                                        </span>
                                    </div>

                                    <div className="text-sm text-gray-600 mb-3">
                                        {point.address && <p className="mb-1">📍 {point.address}</p>}
                                        {point.district && <p className="text-xs text-gray-500">อ.{point.district} ต.{point.tambon}</p>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div className="bg-blue-50 rounded p-2 text-center">
                                            <div className="font-bold text-blue-700">{point.officer_count || 0}</div>
                                            <div className="text-xs text-blue-600">👮 เจ้าหน้าที่</div>
                                        </div>
                                        <div className="bg-teal-50 rounded p-2 text-center">
                                            <div className="font-bold text-teal-700">{point.vehicle_count || 0}</div>
                                            <div className="text-xs text-teal-600">🚔 รถตรวจ</div>
                                        </div>
                                    </div>

                                    {point.operating_hours && (
                                        <p className="text-xs text-gray-500 mb-3">🕐 {point.operating_hours}</p>
                                    )}

                                    <div className="flex gap-2 pt-2 border-t">
                                        <button
                                            onClick={() => toggleActive(point)}
                                            className={`flex-1 py-2 rounded text-sm font-medium ${point.is_active
                                                ? 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                }`}
                                        >
                                            {point.is_active ? '⏸️ ปิดชั่วคราว' : '▶️ เปิดบริการ'}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(point)}
                                            className="px-4 py-2 bg-blue-100 text-blue-700 rounded hover:bg-blue-200"
                                        >
                                            ✏️
                                        </button>
                                        <button
                                            onClick={() => handleDelete(point.id)}
                                            className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                        >
                                            🗑️
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* Modal */}
                {showModal && (
                    <div className="fixed inset-0 backdrop-blur-md bg-white/30 flex items-center justify-center z-50 p-4">
                        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="text-gray-700 text-2xl font-bold mb-4">
                                    {editingPoint ? 'แก้ไขจุดบริการ' : '🚧 เพิ่มจุดบริการ'}
                                </h2>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ชื่อจุดบริการ *</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                                placeholder="เช่น ด่านตรวจหน้า อบต."
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท *</label>
                                            <select
                                                value={formData.point_type}
                                                onChange={(e) => setFormData({ ...formData, point_type: e.target.value })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            >
                                                {pointTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">ที่อยู่/ตำแหน่ง</label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="ถนน/ซอย/หมู่บ้าน"
                                            className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ</label>
                                            <select
                                                value={formData.district}
                                                onChange={(e) => setFormData({ ...formData, district: e.target.value, tambon: '' })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            >
                                                <option value="">เลือกอำเภอ</option>
                                                {satunDistricts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ตำบล</label>
                                            <select
                                                value={formData.tambon}
                                                onChange={(e) => setFormData({ ...formData, tambon: e.target.value })}
                                                disabled={!formData.district}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg disabled:bg-gray-100"
                                            >
                                                <option value="">เลือกตำบล</option>
                                                {tambonOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-2">พิกัดจุดบริการ (ปักหมุดบนแผนที่)</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">ละติจูด</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.lat}
                                                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                                                    placeholder="6.xxxx"
                                                    className="text-gray-600 w-full px-3 py-2 border rounded-lg bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-gray-500 mb-1">ลองจิจูด</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.lng}
                                                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                                                    placeholder="100.xxxx"
                                                    className="text-gray-600 w-full px-3 py-2 border rounded-lg bg-white"
                                                />
                                            </div>
                                        </div>
                                        <div className="border border-gray-200 rounded-lg overflow-hidden relative z-0">
                                            <MapSelector
                                                position={formData.lat && formData.lng ? {
                                                    lat: parseFloat(formData.lat) || 6.6238,
                                                    lng: parseFloat(formData.lng) || 100.0673
                                                } : null}
                                                onPositionChange={(pos) => setFormData({ ...formData, lat: pos.lat.toFixed(6), lng: pos.lng.toFixed(6) })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">👮 จำนวนเจ้าหน้าที่</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.officer_count}
                                                onChange={(e) => setFormData({ ...formData, officer_count: parseInt(e.target.value) || 0 })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">🚔 จำนวนรถตรวจ</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.vehicle_count}
                                                onChange={(e) => setFormData({ ...formData, vehicle_count: parseInt(e.target.value) || 0 })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">วันเริ่มเปิด</label>
                                            <input
                                                type="date"
                                                value={formData.start_date}
                                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">วันสิ้นสุด</label>
                                            <input
                                                type="date"
                                                value={formData.end_date}
                                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">เวลาเปิดบริการ</label>
                                            <input
                                                type="text"
                                                value={formData.operating_hours}
                                                onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                                                placeholder="00:00-24:00"
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">📞 เบอร์ติดต่อ</label>
                                        <input
                                            type="text"
                                            value={formData.contact_phone}
                                            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                            placeholder="074-xxx-xxx"
                                            className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowModal(false); setEditingPoint(null); resetForm(); }}
                                            className="px-6 py-2 bg-gray-500 rounded-lg text-white hover:bg-gray-600"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button type="submit" className="px-6 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700">
                                            {editingPoint ? 'บันทึกการแก้ไข' : 'บันทึก'}
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
