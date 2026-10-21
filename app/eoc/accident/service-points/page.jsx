"use client";
import { useCallback, useEffect, useState } from "react";
import { PageHero, heroPrimaryButtonClass } from "@/components/common/ThemePanels";
import { AppDialogFrame } from "@/components/ui/app-dialog";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useSatunDistricts } from "@/lib/useSatunDistricts";
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';
import dynamic from 'next/dynamic';
import AppIcon from "@/components/icons/AppIcon";
import { MetricCard } from "@/components/common/MetricCards";
import PaginationControls, { usePagination } from "@/components/common/PaginationControls";

const MapSelector = dynamic(() => import('@/components/MapSelector'), {
    ssr: false,
    loading: () => <div className="h-[400px] bg-slate-100 rounded-lg animate-pulse flex items-center justify-center">กำลังโหลดแผนที่...</div>
});

const pointTypes = ['จุดตรวจ', 'จุดบริการ', 'จุดพักรถ', 'ด่านชุมชน'];

export default function ServicePointsPage() {
    const satunDistricts = useSatunDistricts();
    const [points, setPoints] = useState([]);
    const { anchor: listAnchor, ...paged } = usePagination(points, { pageSize: 12 });
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
    }, [formData.district, satunDistricts]);

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
            showError('ไม่พบเหตุการณ์ EOC ที่เปิดอยู่');
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
                    <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-6 text-center">
                        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 text-slate-400 ring-1 ring-slate-200"><AppIcon icon="alert" className="h-6 w-6" /></span>
                        <h3 className="text-xl font-semibold text-slate-900 mb-2">ไม่มีเหตุการณ์ EOC ที่เปิดอยู่</h3>
                        <p className="text-slate-600">กรุณาเปิดเหตุการณ์ EOC ก่อนจัดการจุดบริการ</p>
                    </div>
                </div>
            </EOCLayout>
        );
    }

    return (
        <EOCLayout>
            <div className="p-6">
                {/* Header */}
                <PageHero icon="route" title="จุดบริการชั่วคราว" subtitle={<>เหตุการณ์ครั้งที่ {activeSession.session_number} - จุดตรวจ/จุดบริการช่วง 7 วันอันตราย</>} actions={<><button
                        onClick={() => { setEditingPoint(null); resetForm(); setShowModal(true); }}
                        className={heroPrimaryButtonClass}
                    >
                        <AppIcon icon="plus" className="h-4 w-4" /> เพิ่มจุดบริการ
                    </button></>} className="mb-6" />

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <MetricCard label="จุดบริการทั้งหมด" value={stats.total} tone="amber" />
                    <MetricCard icon="statusGreen" label="เปิดให้บริการ" value={stats.active} tone="green" />
                    <MetricCard icon="shield" label="เจ้าหน้าที่" value={stats.officers} tone="blue" />
                    <MetricCard icon="car" label="รถตรวจ" value={stats.vehicles} tone="blue" />
                </div>

                {/* Cards View */}
                {loading ? (
                    <div className="text-center py-12">
                        <div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-[3px] border-[#0b4c86]/20 border-t-[#0b4c86] motion-reduce:animate-none"></div>
                        <p className="text-slate-600">กำลังโหลด...</p>
                    </div>
                ) : points.length === 0 ? (
                    <div className="border border-slate-200 bg-white rounded-2xl p-12 text-center">
                        <span className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-white/70 text-slate-400 ring-1 ring-slate-200"><AppIcon icon="file" className="h-6 w-6" /></span>
                        <h3 className="text-xl font-bold text-slate-700 mb-2">ยังไม่มีจุดบริการ</h3>
                        <p className="text-slate-500 mb-4">คลิกปุ่ม &quot;เพิ่มจุดบริการ&quot; เพื่อเริ่มต้น</p>
                    </div>
                ) : (
                    <div ref={listAnchor} className="scroll-mt-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {paged.visible.map((point) => (
                            <div
                                key={point.id}
                                className={`bg-white rounded-2xl overflow-hidden border ${point.is_active ? 'border-green-500' : 'border-slate-300'
                                    }`}
                            >
                                <div className="p-4">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <h3 className="font-bold text-slate-900 text-lg">{point.name}</h3>
                                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${point.is_active
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-slate-100 text-slate-600'
                                                }`}>
                                                {point.is_active ? "เปิดให้บริการ" : "ปิดบริการ"}
                                            </span>
                                        </div>
                                        <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
                                            {point.point_type}
                                        </span>
                                    </div>

                                    <div className="text-sm text-slate-600 mb-3">
                                        {point.address && <p className="mb-1">{point.address}</p>}
                                        {point.district && <p className="text-xs text-slate-500">อ.{point.district} ต.{point.tambon}</p>}
                                    </div>

                                    <div className="grid grid-cols-2 gap-2 text-sm mb-3">
                                        <div className="bg-[#edf5fc] rounded p-2 text-center">
                                            <div className="font-bold text-[#0b4c86]">{point.officer_count || 0}</div>
                                            <div className="text-xs text-[#0b4c86]">เจ้าหน้าที่</div>
                                        </div>
                                        <div className="bg-[#edf5fc] rounded p-2 text-center">
                                            <div className="font-bold text-[#0b4c86]">{point.vehicle_count || 0}</div>
                                            <div className="text-xs text-[#0b4c86]">รถตรวจ</div>
                                        </div>
                                    </div>

                                    {point.operating_hours && (
                                        <p className="text-xs text-slate-500 mb-3">เวลา {point.operating_hours}</p>
                                    )}

                                    <div className="flex gap-2 pt-2 border-t">
                                        <button
                                            onClick={() => toggleActive(point)}
                                            className={`flex-1 py-2 rounded text-sm font-medium ${point.is_active
                                                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                }`}
                                        >
                                            {point.is_active ? "ปิดชั่วคราว" : "เปิดบริการ"}
                                        </button>
                                        <button
                                            onClick={() => handleEdit(point)}
                                            className="px-4 py-2 bg-[#dbeaf7] text-[#0b4c86] rounded hover:bg-blue-200"
                                        >
                                            <AppIcon icon="edit" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(point.id)}
                                            className="px-4 py-2 bg-red-100 text-red-700 rounded hover:bg-red-200"
                                        >
                                            <AppIcon icon="trash" className="inline-block h-[1em] w-[1em] shrink-0 align-[-0.125em]" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    <PaginationControls {...paged.controls} pageSizeOptions={[12, 24, 48]} itemLabel="จุดบริการ" className="mt-4 rounded-2xl border border-slate-200 bg-white" />
                    </div>
                )}

                {/* Modal */}
                {showModal && (
                    <AppDialogFrame open onOpenChange={(open) => { if (!open) { setShowModal(false); setEditingPoint(null); resetForm(); } }}>
                        <div className="bg-white rounded-2xl font-[family-name:var(--font-kanit)] max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                            <div className="p-6">
                                <h2 className="mb-4 text-lg font-black text-slate-900 sm:text-xl">
                                    {editingPoint ? 'แก้ไขจุดบริการ' : "เพิ่มจุดบริการ"}
                                </h2>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">ชื่อจุดบริการ *</label>
                                            <input
                                                type="text"
                                                value={formData.name}
                                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                                required
                                                placeholder="เช่น ด่านตรวจหน้า อบต."
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">ประเภท *</label>
                                            <select
                                                value={formData.point_type}
                                                onChange={(e) => setFormData({ ...formData, point_type: e.target.value })}
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            >
                                                {pointTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">ที่อยู่/ตำแหน่ง</label>
                                        <input
                                            type="text"
                                            value={formData.address}
                                            onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                                            placeholder="ถนน/ซอย/หมู่บ้าน"
                                            className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">อำเภอ</label>
                                            <select
                                                value={formData.district}
                                                onChange={(e) => setFormData({ ...formData, district: e.target.value, tambon: '' })}
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            >
                                                <option value="">เลือกอำเภอ</option>
                                                {satunDistricts.map(d => <option key={d.name} value={d.name}>{d.name}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">ตำบล</label>
                                            <select
                                                value={formData.tambon}
                                                onChange={(e) => setFormData({ ...formData, tambon: e.target.value })}
                                                disabled={!formData.district}
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg disabled:bg-slate-100"
                                            >
                                                <option value="">เลือกตำบล</option>
                                                {tambonOptions.map(t => <option key={t.name} value={t.name}>{t.name}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div className="bg-slate-50 rounded-lg p-4">
                                        <label className="block text-sm font-medium text-slate-700 mb-2">พิกัดจุดบริการ (ปักหมุดบนแผนที่)</label>
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">ละติจูด</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.lat}
                                                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                                                    placeholder="6.xxxx"
                                                    className="text-slate-600 w-full px-3 py-2 border rounded-lg bg-white"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs text-slate-500 mb-1">ลองจิจูด</label>
                                                <input
                                                    type="number"
                                                    step="any"
                                                    value={formData.lng}
                                                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                                                    placeholder="100.xxxx"
                                                    className="text-slate-600 w-full px-3 py-2 border rounded-lg bg-white"
                                                />
                                            </div>
                                        </div>
                                        <div className="border border-slate-200 rounded-lg overflow-hidden relative z-0">
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
                                            <label className="block text-sm font-medium text-slate-700 mb-1">จำนวนเจ้าหน้าที่</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.officer_count}
                                                onChange={(e) => setFormData({ ...formData, officer_count: parseInt(e.target.value) || 0 })}
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">จำนวนรถตรวจ</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.vehicle_count}
                                                onChange={(e) => setFormData({ ...formData, vehicle_count: parseInt(e.target.value) || 0 })}
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">วันเริ่มเปิด</label>
                                            <input
                                                type="date"
                                                value={formData.start_date}
                                                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">วันสิ้นสุด</label>
                                            <input
                                                type="date"
                                                value={formData.end_date}
                                                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-slate-700 mb-1">เวลาเปิดบริการ</label>
                                            <input
                                                type="text"
                                                value={formData.operating_hours}
                                                onChange={(e) => setFormData({ ...formData, operating_hours: e.target.value })}
                                                placeholder="00:00-24:00"
                                                className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">เบอร์ติดต่อ</label>
                                        <input
                                            type="text"
                                            value={formData.contact_phone}
                                            onChange={(e) => setFormData({ ...formData, contact_phone: e.target.value })}
                                            placeholder="074-xxx-xxx"
                                            className="text-slate-600 w-full px-3 py-2 border rounded-lg"
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowModal(false); setEditingPoint(null); resetForm(); }}
                                            className="px-6 py-2 bg-slate-500 rounded-lg text-white hover:bg-slate-600"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button type="submit" className="px-6 py-2 bg-[#0b4c86] text-white rounded-lg hover:bg-[#083865]">
                                            {editingPoint ? 'บันทึกการแก้ไข' : 'บันทึก'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    </AppDialogFrame>
                )}
            </div>
        </EOCLayout>
    );
}
