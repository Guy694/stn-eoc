"use client";
import EOCLayout from "@/components/layouts/EOCLayout";
import { useEOC } from "@/context/EOCContext";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function ManageSheltersPage() {
    const { eocStatus } = useEOC();
    const [sessionId, setSessionId] = useState(null);
    const [shelters, setShelters] = useState([]);
    const [stats, setStats] = useState({ total: 0, activated: 0, not_activated: 0, total_capacity: 0 });
    const [loading, setLoading] = useState(true);
    const [updating, setUpdating] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');

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
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
                        <p className="text-gray-500 text-sm">ทั้งหมด</p>
                        <p className="text-3xl font-bold text-gray-800">{stats.total}</p>
                    </div>
                    <div className="bg-green-50 rounded-xl p-5 shadow-sm border border-green-100">
                        <p className="text-green-600 text-sm">เปิดใช้งาน</p>
                        <p className="text-3xl font-bold text-green-700">{stats.activated}</p>
                    </div>
                    <div className="bg-gray-50 rounded-xl p-5 shadow-sm border border-gray-200">
                        <p className="text-gray-500 text-sm">ยังไม่เปิด</p>
                        <p className="text-3xl font-bold text-gray-600">{stats.not_activated}</p>
                    </div>
                    <div className="bg-blue-50 rounded-xl p-5 shadow-sm border border-blue-100">
                        <p className="text-blue-600 text-sm">ความจุรวม</p>
                        <p className="text-3xl font-bold text-blue-700">{stats.total_capacity} <span className="text-sm font-normal">คน</span></p>
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
                                    className={`p-4 flex items-center justify-between hover:bg-gray-50 transition-colors ${shelter.is_activated_for_session ? 'bg-green-50/50' : ''
                                        }`}
                                >
                                    <div className="flex items-center gap-4">
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center ${shelter.is_activated_for_session
                                                ? 'bg-green-100 text-green-600'
                                                : 'bg-gray-100 text-gray-400'
                                            }`}>
                                            <span className="text-2xl">🏠</span>
                                        </div>
                                        <div>
                                            <h3 className="font-semibold text-gray-800">{shelter.sheltername}</h3>
                                            <p className="text-sm text-gray-500">
                                                ต.{shelter.tambon} อ.{shelter.district_name} • ความจุ {shelter.shelter_capacity} คน
                                            </p>
                                            {shelter.is_activated_for_session && shelter.activated_at && (
                                                <p className="text-xs text-green-600 mt-1">
                                                    เปิดใช้งานเมื่อ: {new Date(shelter.activated_at).toLocaleString('th-TH')}
                                                </p>
                                            )}
                                        </div>
                                    </div>

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
                                                <span>กำลังดำเนินการ...</span>
                                            </span>
                                        ) : shelter.is_activated_for_session ? (
                                            <span>❌ ปิดใช้งาน</span>
                                        ) : (
                                            <span>✅ เปิดใช้งาน</span>
                                        )}
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </EOCLayout>
    );
}
