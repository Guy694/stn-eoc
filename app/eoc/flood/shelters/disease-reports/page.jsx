"use client";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useEOC } from "@/context/EOCContext";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ShelterDiseaseReportsPage() {
    const { eocStatus } = useEOC();
    const [sessionId, setSessionId] = useState(null);
    const [activatedShelters, setActivatedShelters] = useState([]);
    const [reports, setReports] = useState([]);
    const [stats, setStats] = useState({});
    const [commonDiseases, setCommonDiseases] = useState([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
    const [showForm, setShowForm] = useState(false);
    const [formData, setFormData] = useState({
        shelter_id: '',
        disease_type: '',
        new_cases: 0,
        recovered: 0,
        hospitalized: 0,
        deaths: 0,
        severity: 'low',
        symptoms: '',
        treatment_given: '',
        notes: ''
    });

    const floodEOC = eocStatus?.flood;
    const isActive = floodEOC?.is_active;

    // ดึง session ID
    useEffect(() => {
        const fetchActiveSession = async () => {
            try {
                const response = await fetch('/api/eoc/flood/area-status');
                const result = await response.json();
                if (result.hasActiveSession && result.activeSession) {
                    setSessionId(result.activeSession.id);
                }
            } catch (error) {
                console.error('Error fetching active session:', error);
            }
        };
        fetchActiveSession();
    }, []);

    // ดึงรายการโรคจาก common_diseases table
    useEffect(() => {
        const fetchDiseases = async () => {
            try {
                const response = await fetch('/api/common/diseases');
                const result = await response.json();
                if (result.success && result.data) {
                    // เพิ่ม "อื่นๆ" ไว้ท้ายสุด
                    const diseases = result.data.filter(d => d.name !== 'อื่นๆ');
                    diseases.push({ name: 'อื่นๆ' });
                    setCommonDiseases(diseases);
                }
            } catch (error) {
                console.error('Error fetching diseases:', error);
                // ใช้รายการ default
                setCommonDiseases([
                    { name: 'ไข้เลือดออก' },
                    { name: 'โควิด-19' },
                    { name: 'มือเท้าปาก' },
                    { name: 'ไข้หวัดใหญ่' },
                    { name: 'อุจจาระร่วง' },
                    { name: 'โรคผิวหนัง' },
                    { name: 'อื่นๆ' }
                ]);
            }
        };
        fetchDiseases();
    }, []);

    // ดึงศูนย์พักพิงที่ activate และรายงานโรค
    useEffect(() => {
        if (!sessionId) return;

        const fetchData = async () => {
            setLoading(true);
            try {
                // ดึงศูนย์พักพิงที่ activate
                const sheltersRes = await fetch(`/api/eoc/shelter-activations?session_id=${sessionId}&eoc_type=flood`);
                const sheltersData = await sheltersRes.json();
                if (sheltersData.success) {
                    setActivatedShelters(sheltersData.data?.filter(s => s.is_activated_for_session) || []);
                }

                // ดึงรายงานโรค
                const reportsRes = await fetch(`/api/eoc/shelter-disease-reports?session_id=${sessionId}&report_date=${selectedDate}`);
                const reportsData = await reportsRes.json();
                if (reportsData.success) {
                    setReports(reportsData.data || []);
                    setStats(reportsData.stats || {});
                }
            } catch (error) {
                console.error('Error fetching data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [sessionId, selectedDate]);

    // บันทึกรายงาน
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.shelter_id || !formData.disease_type) {
            alert('กรุณาเลือกศูนย์พักพิงและประเภทโรค');
            return;
        }

        setSaving(true);
        try {
            const response = await fetch('/api/eoc/shelter-disease-reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ...formData,
                    session_id: sessionId,
                    report_date: selectedDate
                })
            });

            const result = await response.json();
            if (result.success) {
                // Refresh data
                const reportsRes = await fetch(`/api/eoc/shelter-disease-reports?session_id=${sessionId}&report_date=${selectedDate}`);
                const reportsData = await reportsRes.json();
                if (reportsData.success) {
                    setReports(reportsData.data || []);
                    setStats(reportsData.stats || {});
                }
                setShowForm(false);
                setFormData({
                    shelter_id: '',
                    disease_type: '',
                    new_cases: 0,
                    recovered: 0,
                    hospitalized: 0,
                    deaths: 0,
                    severity: 'low',
                    symptoms: '',
                    treatment_given: '',
                    notes: ''
                });
            } else {
                alert('เกิดข้อผิดพลาด: ' + result.message);
            }
        } catch (error) {
            console.error('Error saving report:', error);
            alert('เกิดข้อผิดพลาดในการบันทึก');
        } finally {
            setSaving(false);
        }
    };

    // ลบรายงาน
    const handleDelete = async (id) => {
        if (!confirm('ต้องการลบรายงานนี้หรือไม่?')) return;

        try {
            const response = await fetch(`/api/eoc/shelter-disease-reports?id=${id}`, { method: 'DELETE' });
            const result = await response.json();
            if (result.success) {
                setReports(reports.filter(r => r.id !== id));
            }
        } catch (error) {
            console.error('Error deleting report:', error);
        }
    };

    const severityColors = {
        low: 'bg-green-100 text-green-800',
        medium: 'bg-yellow-100 text-yellow-800',
        high: 'bg-orange-100 text-orange-800',
        critical: 'bg-red-100 text-red-800'
    };

    const severityLabels = {
        low: 'ต่ำ',
        medium: 'ปานกลาง',
        high: 'สูง',
        critical: 'วิกฤต'
    };

    if (!isActive) {
        return (
            <EOCLayout>
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
                    <span className="text-5xl mb-4 block">⚠️</span>
                    <h2 className="text-xl font-bold text-yellow-800 mb-2">ไม่มี EOC น้ำท่วมที่เปิดใช้งาน</h2>
                    <p className="text-yellow-700">กรุณาเปิด EOC ก่อนจึงจะสามารถบันทึกรายงานโรคได้</p>
                </div>
            </EOCLayout>
        );
    }

    return (
        <EOCLayout>
            <div className="space-y-6">
                {/* Header */}
                <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex items-center gap-4">
                            <div className="w-14 h-14 rounded-xl bg-red-100 flex items-center justify-center">
                                <span className="text-3xl">🦠</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">รายงานโรคในศูนย์พักพิง</h1>
                                <p className="text-gray-600">บันทึกสถานการณ์โรครายวันในศูนย์พักพิงชั่วคราว</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => setSelectedDate(e.target.value)}
                                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                            />
                            <button
                                onClick={() => setShowForm(!showForm)}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                            >
                                <span>➕</span>
                                <span>เพิ่มรายงาน</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-sm">รายงานทั้งหมด</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.total_reports || 0}</p>
                    </div>
                    <div className="bg-red-50 rounded-xl p-5 shadow-sm border border-red-100">
                        <p className="text-red-600 text-sm">ผู้ป่วยใหม่</p>
                        <p className="text-3xl font-bold text-red-700">{stats.total_new_cases || 0}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-5 shadow-sm border border-green-100">
                        <p className="text-green-600 text-sm">หายแล้ว</p>
                        <p className="text-3xl font-bold text-green-700">{stats.total_recovered || 0}</p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-5 shadow-sm border border-orange-100">
                        <p className="text-orange-600 text-sm">ส่งต่อ รพ.</p>
                        <p className="text-3xl font-bold text-orange-700">{stats.total_hospitalized || 0}</p>
                    </div>
                </div>

                {/* Add Form */}
                {showForm && (
                    <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4">เพิ่มรายงานโรค</h3>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ศูนย์พักพิง *</label>
                                    <select
                                        value={formData.shelter_id}
                                        onChange={(e) => setFormData({ ...formData, shelter_id: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">-- เลือกศูนย์พักพิง --</option>
                                        {activatedShelters.map(s => (
                                            <option key={s.id} value={s.id}>{s.sheltername} (ต.{s.tambon})</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ประเภทโรค *</label>
                                    <select
                                        value={formData.disease_type}
                                        onChange={(e) => setFormData({ ...formData, disease_type: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                        required
                                    >
                                        <option value="">-- เลือกประเภทโรค --</option>
                                        {commonDiseases.map((d, i) => (
                                            <option key={i} value={d.name}>{d.name}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ผู้ป่วยใหม่</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.new_cases}
                                        onChange={(e) => setFormData({ ...formData, new_cases: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">หายแล้ว</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.recovered}
                                        onChange={(e) => setFormData({ ...formData, recovered: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ส่งต่อ รพ.</label>
                                    <input
                                        type="number"
                                        min="0"
                                        value={formData.hospitalized}
                                        onChange={(e) => setFormData({ ...formData, hospitalized: parseInt(e.target.value) || 0 })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">ระดับความรุนแรง</label>
                                    <select
                                        value={formData.severity}
                                        onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="low">ต่ำ</option>
                                        <option value="medium">ปานกลาง</option>
                                        <option value="high">สูง</option>
                                        <option value="critical">วิกฤต</option>
                                    </select>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ</label>
                                <textarea
                                    value={formData.notes}
                                    onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                                    rows="2"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button
                                    type="submit"
                                    disabled={saving}
                                    className="px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                                >
                                    {saving ? '⏳ กำลังบันทึก...' : '💾 บันทึก'}
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setShowForm(false)}
                                    className="px-6 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    ยกเลิก
                                </button>
                            </div>
                        </form>
                    </div>
                )}

                {/* Reports List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    <div className="p-4 bg-gray-50 border-b border-gray-100">
                        <h3 className="font-semibold text-gray-800">รายงานวันที่ {new Date(selectedDate).toLocaleDateString('th-TH', { dateStyle: 'long' })}</h3>
                    </div>

                    {loading ? (
                        <div className="flex items-center justify-center h-48">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : reports.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <span className="text-4xl block mb-2">📋</span>
                            <p>ยังไม่มีรายงานโรคในวันนี้</p>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {reports.map((report) => (
                                <div key={report.id} className="p-4 hover:bg-gray-50">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-4">
                                            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                                                <span className="text-xl">🦠</span>
                                            </div>
                                            <div>
                                                <h4 className="font-semibold text-gray-800">{report.disease_type}</h4>
                                                <p className="text-sm text-gray-500">🏠 {report.sheltername}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4">
                                            <div className="text-right">
                                                <div className="flex items-center gap-3 text-sm">
                                                    <span className="text-red-600">ป่วยใหม่: {report.new_cases}</span>
                                                    <span className="text-green-600">หาย: {report.recovered}</span>
                                                    <span className="text-orange-600">รพ.: {report.hospitalized}</span>
                                                </div>
                                                <span className={`inline-block px-2 py-0.5 rounded text-xs mt-1 ${severityColors[report.severity]}`}>
                                                    {severityLabels[report.severity]}
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleDelete(report.id)}
                                                className="p-2 text-red-500 hover:bg-red-50 rounded-lg"
                                            >
                                                🗑️
                                            </button>
                                        </div>
                                    </div>
                                    {report.notes && (
                                        <p className="mt-2 text-sm text-gray-600 ml-16">📝 {report.notes}</p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </EOCLayout>
    );
}
