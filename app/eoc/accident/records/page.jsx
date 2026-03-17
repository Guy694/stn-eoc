"use client";
import { useState, useEffect } from "react";
import EOCLayout from "@/components/layouts/EOCLayout";
import { satunDistricts } from "@/data/satunData";
import { showError, showSuccess, showDeleteConfirm } from '@/lib/sweetAlert';

const accidentTypes = ['รถยนต์', 'จักรยานยนต์', 'รถจักรยาน', 'คนเดินเท้า', 'อื่นๆ'];

export default function AccidentRecordsPage() {
    const [records, setRecords] = useState([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [editingRecord, setEditingRecord] = useState(null);
    const [activeSession, setActiveSession] = useState(null);
    const [filters, setFilters] = useState({ district: 'all', date: '' });

    const [formData, setFormData] = useState({
        report_date: new Date().toISOString().split('T')[0],
        report_time: '',
        accident_type: 'จักรยานยนต์',
        location_name: '',
        lat: '',
        lng: '',
        district: '',
        tambon: '',
        deaths: 0,
        injuries: 0,
        drunk_driving: false,
        no_helmet: false,
        no_seatbelt: false,
        speeding: false,
        notes: ''
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
        if (activeSession) {
            fetchRecords();
        } else {
            setLoading(false);
        }
    }, [activeSession, filters]);

    useEffect(() => {
        if (formData.district) {
            const district = satunDistricts.find(d => d.name === formData.district);
            setTambonOptions(district?.tambons || []);
        } else {
            setTambonOptions([]);
        }
    }, [formData.district]);

    const fetchRecords = async () => {
        if (!activeSession) return;
        try {
            setLoading(true);
            const params = new URLSearchParams({ session_id: activeSession.id });
            if (filters.district !== 'all') params.append('district', filters.district);
            if (filters.date) params.append('date', filters.date);

            const res = await fetch(`/stn-eoc/api/admin/accident-reports?${params}`);
            const data = await res.json();
            if (data.success) {
                setRecords(data.data || []);
            }
        } catch (error) {
            console.error('Error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!activeSession) {
            showError('ไม่พบ EOC Session ที่เปิดอยู่');
            return;
        }

        try {
            const url = editingRecord
                ? `/stn-eoc/api/admin/accident-reports?id=${editingRecord.id}`
                : '/stn-eoc/api/admin/accident-reports';
            const method = editingRecord ? 'PUT' : 'POST';

            const res = await fetch(url, {
                method,
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ...formData, session_id: activeSession.id })
            });

            const data = await res.json();
            if (data.success) {
                showSuccess(editingRecord ? 'แก้ไขข้อมูลสำเร็จ' : 'บันทึกอุบัติเหตุสำเร็จ');
                setShowModal(false);
                setEditingRecord(null);
                resetForm();
                fetchRecords();
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError('เกิดข้อผิดพลาด');
        }
    };

    const handleEdit = (record) => {
        setEditingRecord(record);
        setFormData({
            report_date: record.report_date?.split('T')[0] || '',
            report_time: record.report_time || '',
            accident_type: record.accident_type || 'จักรยานยนต์',
            location_name: record.location_name || '',
            lat: record.lat || '',
            lng: record.lng || '',
            district: record.district || '',
            tambon: record.tambon || '',
            deaths: record.deaths || 0,
            injuries: record.injuries || 0,
            drunk_driving: !!record.drunk_driving,
            no_helmet: !!record.no_helmet,
            no_seatbelt: !!record.no_seatbelt,
            speeding: !!record.speeding,
            notes: record.notes || ''
        });
        setShowModal(true);
    };

    const handleDelete = async (id) => {
        const confirmed = await showDeleteConfirm();
        if (!confirmed) return;

        try {
            const res = await fetch(`/stn-eoc/api/admin/accident-reports?id=${id}`, { method: 'DELETE' });
            const data = await res.json();
            if (data.success) {
                showSuccess('ลบข้อมูลสำเร็จ');
                fetchRecords();
            } else {
                showError(data.message);
            }
        } catch (error) {
            showError('เกิดข้อผิดพลาด');
        }
    };

    const resetForm = () => {
        setFormData({
            report_date: new Date().toISOString().split('T')[0],
            report_time: '',
            accident_type: 'จักรยานยนต์',
            location_name: '',
            lat: '',
            lng: '',
            district: '',
            tambon: '',
            deaths: 0,
            injuries: 0,
            drunk_driving: false,
            no_helmet: false,
            no_seatbelt: false,
            speeding: false,
            notes: ''
        });
    };

    // สถิติ
    const stats = {
        total: records.length,
        deaths: records.reduce((sum, r) => sum + (r.deaths || 0), 0),
        injuries: records.reduce((sum, r) => sum + (r.injuries || 0), 0),
        drunk: records.filter(r => r.drunk_driving).length
    };

    if (!activeSession) {
        return (
            <EOCLayout>
                <div className="p-6">
                    <div className="bg-yellow-50 border-2 border-yellow-200 rounded-lg p-6 text-center">
                        <div className="text-6xl mb-4">⚠️</div>
                        <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่มี EOC Session ที่เปิดอยู่</h3>
                        <p className="text-gray-600">กรุณาเปิด EOC Session ก่อนบันทึกข้อมูล</p>
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
                            <span className="text-4xl">🚗</span>
                            บันทึกอุบัติเหตุ
                        </h1>
                        <p className="text-gray-600">
                            EOC Session #{activeSession.session_number} - {activeSession.open_reason || '7 วันอันตราย'}
                        </p>
                    </div>
                    <button
                        onClick={() => { setEditingRecord(null); resetForm(); setShowModal(true); }}
                        className="bg-red-600 text-white px-6 py-3 rounded-lg hover:bg-red-700 flex items-center gap-2"
                    >
                        ➕ บันทึกอุบัติเหตุ
                    </button>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                    <div className="bg-white rounded-lg p-4 shadow border-l-4 border-red-500">
                        <div className="text-3xl font-bold text-red-600">{stats.total}</div>
                        <div className="text-sm text-gray-600">อุบัติเหตุทั้งหมด</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow border-l-4 border-gray-800">
                        <div className="text-3xl font-bold text-gray-800">{stats.deaths}</div>
                        <div className="text-sm text-gray-600">💀 เสียชีวิต</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow border-l-4 border-yellow-500">
                        <div className="text-3xl font-bold text-yellow-600">{stats.injuries}</div>
                        <div className="text-sm text-gray-600">🤕 บาดเจ็บ</div>
                    </div>
                    <div className="bg-white rounded-lg p-4 shadow border-l-4 border-purple-500">
                        <div className="text-3xl font-bold text-purple-600">{stats.drunk}</div>
                        <div className="text-sm text-gray-600">🍺 เมาแล้วขับ</div>
                    </div>
                </div>

                {/* Filters */}
                <div className="bg-white rounded-lg shadow p-4 mb-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">อำเภอ</label>
                            <select
                                value={filters.district}
                                onChange={(e) => setFilters({ ...filters, district: e.target.value })}
                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="all">ทั้งหมด</option>
                                {satunDistricts.map(d => (
                                    <option key={d.name} value={d.name}>{d.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่</label>
                            <input
                                type="date"
                                value={filters.date}
                                onChange={(e) => setFilters({ ...filters, date: e.target.value })}
                                className="text-gray-600 w-full px-3 py-2 border border-gray-300 rounded-lg"
                            />
                        </div>
                    </div>
                </div>

                {/* Table */}
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b">
                        <h3 className="font-bold text-gray-800">📋 รายการอุบัติเหตุ ({records.length} รายการ)</h3>
                    </div>

                    {loading ? (
                        <div className="text-center py-8">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-500 mx-auto mb-2"></div>
                            <p className="text-gray-600 text-sm">กำลังโหลด...</p>
                        </div>
                    ) : records.length === 0 ? (
                        <div className="text-center py-12">
                            <div className="text-6xl mb-4">📭</div>
                            <p className="text-gray-500">ยังไม่มีรายงานอุบัติเหตุ</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">#</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">วัน/เวลา</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ประเภท</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สถานที่</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ผลกระทบ</th>
                                        <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">สาเหตุ</th>
                                        <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">จัดการ</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {records.map((r, idx) => (
                                        <tr key={r.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 text-sm text-gray-500">{idx + 1}</td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium text-gray-900">
                                                    {r.report_date ? new Date(r.report_date).toLocaleDateString('th-TH') : '-'}
                                                </div>
                                                <div className="text-gray-500">{r.report_time || '-'}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="px-2 py-1 text-xs font-medium rounded-full bg-red-100 text-red-800">
                                                    {r.accident_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-sm">
                                                <div className="font-medium text-gray-900">{r.location_name || '-'}</div>
                                                <div className="text-gray-500">อ.{r.district} ต.{r.tambon}</div>
                                            </td>
                                            <td className="px-4 py-3">
                                                <div className="flex gap-2">
                                                    <span className="px-2 py-1 text-xs rounded bg-gray-100">💀 {r.deaths}</span>
                                                    <span className="px-2 py-1 text-xs rounded bg-yellow-100">🤕 {r.injuries}</span>
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-xs">
                                                <div className="flex flex-wrap gap-1">
                                                    {r.drunk_driving && <span className="px-1 py-0.5 bg-purple-100 text-purple-700 rounded">🍺 เมา</span>}
                                                    {r.no_helmet && <span className="px-1 py-0.5 bg-orange-100 text-orange-700 rounded">⛑ ไม่สวมหมวก</span>}
                                                    {r.speeding && <span className="px-1 py-0.5 bg-red-100 text-red-700 rounded">🚀 เร็ว</span>}
                                                </div>
                                            </td>
                                            <td className="px-4 py-3 text-center">
                                                <button onClick={() => handleEdit(r)} className="text-blue-600 hover:text-blue-800 mr-2">✏️</button>
                                                <button onClick={() => handleDelete(r.id)} className="text-red-600 hover:text-red-800">🗑️</button>
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
                                    {editingRecord ? 'แก้ไขข้อมูล' : '🚗 บันทึกอุบัติเหตุ'}
                                </h2>

                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ *</label>
                                            <input
                                                type="date"
                                                value={formData.report_date}
                                                onChange={(e) => setFormData({ ...formData, report_date: e.target.value })}
                                                required
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">เวลา</label>
                                            <input
                                                type="time"
                                                value={formData.report_time}
                                                onChange={(e) => setFormData({ ...formData, report_time: e.target.value })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ประเภท *</label>
                                            <select
                                                value={formData.accident_type}
                                                onChange={(e) => setFormData({ ...formData, accident_type: e.target.value })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            >
                                                {accidentTypes.map(t => <option key={t} value={t}>{t}</option>)}
                                            </select>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">สถานที่ / ถนน</label>
                                        <input
                                            type="text"
                                            value={formData.location_name}
                                            onChange={(e) => setFormData({ ...formData, location_name: e.target.value })}
                                            placeholder="เช่น ถนน 406 กม.5"
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

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ละติจูด</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.lat}
                                                onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                                                placeholder="6.xxxx"
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">ลองจิจูด</label>
                                            <input
                                                type="number"
                                                step="any"
                                                value={formData.lng}
                                                onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                                                placeholder="100.xxxx"
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">💀 จำนวนเสียชีวิต</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.deaths}
                                                onChange={(e) => setFormData({ ...formData, deaths: parseInt(e.target.value) || 0 })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">🤕 จำนวนบาดเจ็บ</label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.injuries}
                                                onChange={(e) => setFormData({ ...formData, injuries: parseInt(e.target.value) || 0 })}
                                                className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            />
                                        </div>
                                    </div>

                                    <div className="bg-gray-50 rounded-lg p-4">
                                        <label className="block text-sm font-medium text-gray-700 mb-3">สาเหตุ/ปัจจัยเสี่ยง</label>
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.drunk_driving}
                                                    onChange={(e) => setFormData({ ...formData, drunk_driving: e.target.checked })}
                                                    className="w-4 h-4 accent-purple-500"
                                                />
                                                <span className="text-sm">🍺 เมาแล้วขับ</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.no_helmet}
                                                    onChange={(e) => setFormData({ ...formData, no_helmet: e.target.checked })}
                                                    className="w-4 h-4 accent-orange-500"
                                                />
                                                <span className="text-sm">⛑ ไม่สวมหมวก</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.no_seatbelt}
                                                    onChange={(e) => setFormData({ ...formData, no_seatbelt: e.target.checked })}
                                                    className="w-4 h-4 accent-yellow-500"
                                                />
                                                <span className="text-sm">🪢 ไม่คาดเข็มขัด</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={formData.speeding}
                                                    onChange={(e) => setFormData({ ...formData, speeding: e.target.checked })}
                                                    className="w-4 h-4 accent-red-500"
                                                />
                                                <span className="text-sm">🚀 ขับเร็ว</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                                        <textarea
                                            value={formData.notes}
                                            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                            rows="2"
                                            className="text-gray-600 w-full px-3 py-2 border rounded-lg"
                                            placeholder="รายละเอียดเพิ่มเติม..."
                                        />
                                    </div>

                                    <div className="flex gap-2 justify-end pt-4">
                                        <button
                                            type="button"
                                            onClick={() => { setShowModal(false); setEditingRecord(null); resetForm(); }}
                                            className="px-6 py-2 bg-gray-500 rounded-lg text-white hover:bg-gray-600"
                                        >
                                            ยกเลิก
                                        </button>
                                        <button type="submit" className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700">
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
