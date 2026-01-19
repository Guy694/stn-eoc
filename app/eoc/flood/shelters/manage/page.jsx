"use client";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useEOC } from "@/context/EOCContext";
import { useEffect, useState } from "react";
import Link from "next/link";
import { showSuccess, showError } from "@/lib/sweetAlert";

export default function ManageSheltersPage() {
    const { eocStatus } = useEOC();
    const [sessionId, setSessionId] = useState(null);
    const [shelters, setShelters] = useState([]);
    const [stats, setStats] = useState({ total: 0, activated: 0, not_activated: 0, total_capacity: 0, total_occupancy: 0 });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

    // State for occupancy edit modal
    const [showEditModal, setShowEditModal] = useState(false);
    const [editingShelter, setEditingShelter] = useState(null);
    const [editOccupancy, setEditOccupancy] = useState(0);
    const [editNotes, setEditNotes] = useState('');


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

    // ดึงรายการ shelter พร้อมสถานะ activation
    const fetchShelters = async () => {
        if (!sessionId) return;

        try {
            setLoading(true);
            const response = await fetch(`/api/eoc/shelter-activations?session_id=${sessionId}&eoc_type=flood`);
            const result = await response.json();

            if (result.success) {
                setShelters(result.data || []);
                setStats(result.stats || { total: 0, activated: 0, not_activated: 0, total_capacity: 0 });
            }
        } catch (error) {
            console.error('Error fetching shelters:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (sessionId) {
            fetchShelters();
        }
    }, [sessionId]);

    // Toggle activation
    const toggleActivation = async (shelterId, currentStatus) => {
        if (!sessionId) return;

        setUpdating(shelterId);
        try {
            const response = await fetch('/api/eoc/shelter-activations', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shelter_id: shelterId,
                    session_id: sessionId,
                    is_active: !currentStatus
                })
            });

            const result = await response.json();
            if (result.success) {
                // Refresh list
                await fetchShelters();
            } else {
                alert('เกิดข้อผิดพลาด: ' + result.message);
            }
        } catch (error) {
            console.error('Error toggling activation:', error);
            alert('เกิดข้อผิดพลาดในการเปลี่ยนสถานะ');
        } finally {
            setUpdating(null);
        }
    };

    // Activate all
    const activateAll = async () => {
        if (!sessionId || !confirm('ต้องการเปิดใช้งานศูนย์พักพิงทั้งหมดหรือไม่?')) return;

        setLoading(true);
        try {
            for (const shelter of shelters.filter(s => !s.is_activated_for_session)) {
                await fetch('/api/eoc/shelter-activations', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        shelter_id: shelter.id,
                        session_id: sessionId,
                        is_active: true
                    })
                });
            }
            await fetchShelters();
        } catch (error) {
            console.error('Error activating all:', error);
        } finally {
            setLoading(false);
        }
    };

    // Open edit occupancy modal
    const openEditModal = (shelter) => {
        setEditingShelter(shelter);
        setEditOccupancy(shelter.session_occupancy || 0);
        setEditNotes('');
        setShowEditModal(true);
    };

    // Update occupancy
    const updateOccupancy = async () => {
        if (!sessionId || !editingShelter) return;

        // ตรวจสอบว่าไม่เกินความจุ
        if (editOccupancy > editingShelter.shelter_capacity) {
            showError(`จำนวนผู้อพยพต้องไม่เกินความจุ ${editingShelter.shelter_capacity} คน`);
            return;
        }

        if (editOccupancy < 0) {
            showError('จำนวนผู้อพยพต้องไม่ติดลบ');
            return;
        }

        setUpdating(editingShelter.id);
        try {
            const response = await fetch('/api/eoc/shelter-activations', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    shelter_id: editingShelter.id,
                    session_id: sessionId,
                    current_occupancy: parseInt(editOccupancy),
                    notes: editNotes || null
                })
            });

            const result = await response.json();
            if (result.success) {
                showSuccess('อัพเดทจำนวนผู้อพยพสำเร็จ');
                setShowEditModal(false);
                await fetchShelters();
            } else {
                showError('เกิดข้อผิดพลาด: ' + result.message);
            }
        } catch (error) {
            console.error('Error updating occupancy:', error);
            showError('เกิดข้อผิดพลาดในการอัพเดทข้อมูล');
        } finally {
            setUpdating(null);
        }
    };

    // Filter shelters
    const filteredShelters = shelters.filter(s =>
        s.sheltername?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.tambon?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        s.district_name?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (!isActive) {
        return (
            <EOCLayout>
                <div className="bg-yellow-50 border-2 border-yellow-200 rounded-xl p-8 text-center">
                    <span className="text-5xl mb-4 block">⚠️</span>
                    <h2 className="text-xl font-bold text-yellow-800 mb-2">ไม่มี EOC น้ำท่วมที่เปิดใช้งาน</h2>
                    <p className="text-yellow-700">กรุณาเปิด EOC ก่อนจึงจะสามารถจัดการศูนย์พักพิงได้</p>
                    <Link href="/admin/eoc-management" className="mt-4 inline-block px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700">
                        ไปหน้าจัดการ EOC
                    </Link>
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
                            <div className="w-14 h-14 rounded-xl bg-blue-100 flex items-center justify-center">
                                <span className="text-3xl">⚙️</span>
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-gray-800">จัดการศูนย์พักพิงสำหรับ Session นี้</h1>
                                <p className="text-gray-600">เลือกศูนย์พักพิงที่จะเปิดใช้งานในช่วง EOC ปัจจุบัน</p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <Link
                                href="/eoc/flood/shelters"
                                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center gap-2"
                            >
                                <span>←</span>
                                <span>กลับ</span>
                            </Link>
                            <button
                                onClick={activateAll}
                                disabled={loading}
                                className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                <span>✅</span>
                                <span>เปิดทั้งหมด</span>
                            </button>
                        </div>
                    </div>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-6 gap-4">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-sm">ศูนย์ทั้งหมด</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-5 shadow-sm border border-green-100">
                        <p className="text-green-600 text-sm">เปิดใช้งาน</p>
                        <p className="text-3xl font-bold text-green-700">{stats.activated}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-5 shadow-sm border border-blue-100">
                        <p className="text-blue-600 text-sm">ความจุรวม</p>
                        <p className="text-3xl font-bold text-blue-700">{stats.total_capacity} <span className="text-sm font-normal">คน</span></p>
                    </div>
                    <div className="bg-orange-50 rounded-xl p-5 shadow-sm border border-orange-100">
                        <p className="text-orange-600 text-sm">ผู้อพยพปัจจุบัน</p>
                        <p className="text-3xl font-bold text-orange-700">{stats.total_occupancy || 0} <span className="text-sm font-normal">คน</span></p>
                    </div>
                    <div className="bg-purple-50 rounded-xl p-5 shadow-sm border border-purple-100">
                        <p className="text-purple-600 text-sm">คงเหลือ</p>
                        <p className="text-3xl font-bold text-purple-700">{(stats.total_capacity || 0) - (stats.total_occupancy || 0)} <span className="text-sm font-normal">คน</span></p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-200">
                        <p className="text-gray-500 text-sm">ยังไม่เปิด</p>
                        <p className="text-3xl font-bold text-gray-600">{stats.not_activated}</p>
                    </div>
                </div>

                {/* Search */}
                <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <input
                        type="text"
                        placeholder="🔍 ค้นหาศูนย์พักพิง..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                </div>

                {/* Shelter List */}
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                    {loading ? (
                        <div className="flex items-center justify-center h-64">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
                        </div>
                    ) : filteredShelters.length === 0 ? (
                        <div className="text-center py-12 text-gray-500">
                            <span className="text-4xl block mb-2">🏠</span>
                            <p>ไม่พบศูนย์พักพิง</p>
                            <Link href="/admin/shelter-center" className="text-blue-600 hover:underline">
                                เพิ่มศูนย์พักพิงใหม่
                            </Link>
                        </div>
                    ) : (
                        <div className="divide-y divide-gray-100">
                            {filteredShelters.map((shelter) => (
                                <div
                                    key={shelter.id}
                                    className={`p-4 hover:bg-gray-50 transition-colors ${shelter.is_activated_for_session ? 'bg-green-50/50' : ''
                                        }`}
                                >
                                    <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
                                        <div className="flex items-center gap-4 flex-1">
                                            <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${shelter.is_activated_for_session
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-gray-100 text-gray-400'
                                                }`}>
                                                <span className="text-2xl">🏠</span>
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <h3 className="font-semibold text-gray-800 truncate">{shelter.sheltername}</h3>
                                                <p className="text-sm text-gray-500">
                                                    ต.{shelter.tambon} อ.{shelter.district_name}
                                                </p>
                                                {shelter.is_activated_for_session && (
                                                    <div className="mt-2">
                                                        <div className="flex flex-wrap items-center gap-4 text-sm mt-1">
                                                            <span className="text-orange-600 font-medium">
                                                                👥 ผู้อพยพ: {shelter.session_occupancy || 0}/{shelter.shelter_capacity} คน
                                                            </span>
                                                            <span className="text-purple-600">
                                                                (คงเหลือ {(shelter.shelter_capacity || 0) - (shelter.session_occupancy || 0)} คน)
                                                            </span>
                                                            {shelter.contact_phone && (
                                                                <a href={`tel:${shelter.contact_phone}`} className="flex items-center gap-1 text-blue-600 hover:underline">
                                                                    <span>📞</span>
                                                                    <span>{shelter.contact_phone}</span>
                                                                </a>
                                                            )}
                                                            {shelter.lat && shelter.lon && (
                                                                <a
                                                                    href={`https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}`}
                                                                    target="_blank"
                                                                    rel="noopener noreferrer"
                                                                    className="flex items-center gap-1 text-green-600 hover:underline"
                                                                >
                                                                    <span>🗺️</span>
                                                                    <span>นำทาง</span>
                                                                </a>
                                                            )}
                                                        </div>
                                                        {/* Progress Bar */}
                                                        <div className="w-full bg-gray-200 rounded-full h-2 mt-2">
                                                            <div
                                                                className={`h-2 rounded-full ${((shelter.session_occupancy || 0) / (shelter.shelter_capacity || 1)) >= 0.9
                                                                    ? 'bg-red-500'
                                                                    : ((shelter.session_occupancy || 0) / (shelter.shelter_capacity || 1)) >= 0.7
                                                                        ? 'bg-orange-500'
                                                                        : 'bg-green-500'
                                                                    }`}
                                                                style={{ width: `${Math.min(100, ((shelter.session_occupancy || 0) / (shelter.shelter_capacity || 1)) * 100)}%` }}
                                                            ></div>
                                                        </div>
                                                    </div>
                                                )}
                                                {!shelter.is_activated_for_session && (
                                                    <div className="mt-1 flex flex-wrap gap-3 text-sm text-gray-400">
                                                        <span>ความจุ {shelter.shelter_capacity} คน</span>
                                                        {shelter.contact_phone && (
                                                            <span className="flex items-center gap-1">
                                                                <span>📞</span>
                                                                <span>{shelter.contact_phone}</span>
                                                            </span>
                                                        )}
                                                        {shelter.lat && shelter.lon && (
                                                            <a
                                                                href={`https://www.google.com/maps/dir/?api=1&destination=${shelter.lat},${shelter.lon}`}
                                                                target="_blank"
                                                                rel="noopener noreferrer"
                                                                className="flex items-center gap-1 hover:text-green-600"
                                                            >
                                                                <span>🗺️</span>
                                                                <span>นำทาง</span>
                                                            </a>
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2">
                                            {shelter.is_activated_for_session && (
                                                <button
                                                    onClick={() => openEditModal(shelter)}
                                                    className="px-3 py-2 bg-blue-100 text-blue-700 rounded-lg font-medium hover:bg-blue-200 transition-colors flex items-center gap-1"
                                                >
                                                    <span>✏️</span>
                                                    <span className="hidden sm:inline">แก้ไขจำนวน</span>
                                                </button>
                                            )}
                                            <button
                                                onClick={() => toggleActivation(shelter.id, shelter.is_activated_for_session)}
                                                disabled={updating === shelter.id}
                                                className={`px-4 py-2 rounded-lg font-medium transition-all ${updating === shelter.id
                                                    ? 'bg-gray-200 text-gray-500 cursor-wait'
                                                    : shelter.is_activated_for_session
                                                        ? 'bg-red-100 text-red-700 hover:bg-red-200'
                                                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                                                    }`}
                                            >
                                                {updating === shelter.id ? (
                                                    <span className="flex items-center gap-2">
                                                        <span className="animate-spin">⏳</span>
                                                        <span className="hidden sm:inline">กำลังดำเนินการ...</span>
                                                    </span>
                                                ) : shelter.is_activated_for_session ? (
                                                    <span>❌ ปิดใช้งาน</span>
                                                ) : (
                                                    <span>✅ เปิดใช้งาน</span>
                                                )}
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* Edit Occupancy Modal */}
            {showEditModal && editingShelter && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-xl max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                                <span>✏️</span>
                                <span>แก้ไขจำนวนผู้อพยพ</span>
                            </h3>
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="text-gray-400 hover:text-gray-600 text-2xl"
                            >
                                ×
                            </button>
                        </div>

                        <div className="mb-4 p-3 bg-blue-50 rounded-lg">
                            <h4 className="font-semibold text-blue-800">{editingShelter.sheltername}</h4>
                            <p className="text-sm text-blue-600">
                                ต.{editingShelter.tambon} อ.{editingShelter.district_name}
                            </p>
                            <p className="text-sm text-blue-600 mt-1">
                                ความจุสูงสุด: {editingShelter.shelter_capacity} คน
                            </p>
                        </div>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    จำนวนผู้อพยพปัจจุบัน
                                </label>
                                <div className="flex items-center gap-3">
                                    <input
                                        type="number"
                                        min="0"
                                        max={editingShelter.shelter_capacity}
                                        value={editOccupancy}
                                        onChange={(e) => setEditOccupancy(parseInt(e.target.value) || 0)}
                                        className="flex-1 px-4 py-3 border border-gray-300 rounded-lg text-xl font-bold text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    />
                                    <span className="text-gray-600">/ {editingShelter.shelter_capacity}</span>
                                </div>
                                <div className="mt-2 flex justify-between text-sm">
                                    <span className="text-gray-500">
                                        คงเหลือ: <span className="font-bold text-purple-600">{(editingShelter.shelter_capacity || 0) - (editOccupancy || 0)} คน</span>
                                    </span>
                                    {editOccupancy > editingShelter.shelter_capacity && (
                                        <span className="text-red-600 font-medium">⚠️ เกินความจุ!</span>
                                    )}
                                </div>
                                {/* Quick buttons */}
                                <div className="flex gap-2 mt-2">
                                    <button
                                        onClick={() => setEditOccupancy(prev => Math.max(0, prev - 10))}
                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                                    >
                                        -10
                                    </button>
                                    <button
                                        onClick={() => setEditOccupancy(prev => Math.max(0, prev - 1))}
                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                                    >
                                        -1
                                    </button>
                                    <button
                                        onClick={() => setEditOccupancy(0)}
                                        className="px-3 py-1 bg-red-100 text-red-700 rounded hover:bg-red-200 text-sm"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        onClick={() => setEditOccupancy(prev => Math.min(editingShelter.shelter_capacity, prev + 1))}
                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                                    >
                                        +1
                                    </button>
                                    <button
                                        onClick={() => setEditOccupancy(prev => Math.min(editingShelter.shelter_capacity, prev + 10))}
                                        className="px-3 py-1 bg-gray-100 text-gray-700 rounded hover:bg-gray-200 text-sm"
                                    >
                                        +10
                                    </button>
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                    หมายเหตุ (ถ้ามี)
                                </label>
                                <textarea
                                    value={editNotes}
                                    onChange={(e) => setEditNotes(e.target.value)}
                                    placeholder="เช่น อพยพเพิ่มจากหมู่ 5..."
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                    rows={2}
                                />
                            </div>
                        </div>

                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowEditModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200"
                            >
                                ยกเลิก
                            </button>
                            <button
                                onClick={updateOccupancy}
                                disabled={updating === editingShelter.id || editOccupancy > editingShelter.shelter_capacity}
                                className="flex-1 px-4 py-3 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                            >
                                {updating === editingShelter.id ? (
                                    <span className="flex items-center justify-center gap-2">
                                        <span className="animate-spin">⏳</span>
                                        <span>กำลังบันทึก...</span>
                                    </span>
                                ) : (
                                    <span>💾 บันทึก</span>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </EOCLayout>
    );
}
